-- 0013 · Escopo de acesso dentro da empresa: equipes, dono do cliente, participantes de projeto e RLS por escopo.
--
-- Visão geral (ver openspec/changes/escopo-de-acesso/design.md):
--   * app_definir_escopo() calcula UMA vez por transação o conjunto V = {eu} ∪ liderados (árvore de equipes)
--     e grava GUCs locais: app.usuarios_visiveis, app.ve_tudo (admin), app.ve_financeiro, app.lider.
--   * As políticas tenant_* das tabelas escopadas viram RESTRICTIVE (isolamento entre empresas continua
--     obrigatório) e ganham políticas permissivas de leitura (escopo_ver) e de escrita (escopo_editar...).
--   * Regras que dependem do valor anterior (troca de dono, vínculo com cliente) ficam em gatilhos.
--   * Funções SECURITY DEFINER leem tabelas sem RLS e por isso SEMPRE filtram por app_empresa_id().
--   * Sem GUCs de escopo (rota que não chamou app_definir_escopo) tudo falha fechado: V = ∅, sem admin.

-- ============================================================================================ 1. estrutura
ALTER TABLE parceiro_negocio ADD COLUMN responsavel_id uuid REFERENCES usuarios (id) ON DELETE SET NULL;
CREATE INDEX ix_parceiro_empresa_responsavel ON parceiro_negocio (empresa_id, responsavel_id)
  WHERE responsavel_id IS NOT NULL;
CREATE INDEX ix_projeto_etapas_projeto_responsavel ON projeto_etapas (projeto_id, responsavel_id)
  WHERE responsavel_id IS NOT NULL;
CREATE INDEX ix_tarefas_empresa_cliente ON tarefas (empresa_id, cliente_id) WHERE cliente_id IS NOT NULL;
CREATE INDEX ix_projetos_empresa_cliente_escopo ON projetos (empresa_id, cliente_id);

CREATE TABLE equipe (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT app_empresa_id() REFERENCES empresa (id) ON DELETE CASCADE,
  nome text NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_equipe PRIMARY KEY (id),
  CONSTRAINT uq_equipe_id_empresa UNIQUE (id, empresa_id),
  CONSTRAINT uq_equipe_empresa_nome UNIQUE (empresa_id, nome),
  CONSTRAINT ck_equipe_nome CHECK (btrim(nome) <> '' AND char_length(nome) <= 100)
);

CREATE TABLE equipe_membro (
  empresa_id uuid NOT NULL DEFAULT app_empresa_id(),
  equipe_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  CONSTRAINT pk_equipe_membro PRIMARY KEY (equipe_id, usuario_id),
  CONSTRAINT fk_equipe_membro_equipe FOREIGN KEY (equipe_id, empresa_id) REFERENCES equipe (id, empresa_id) ON DELETE CASCADE,
  CONSTRAINT fk_equipe_membro_vinculo FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuario_empresa (empresa_id, usuario_id) ON DELETE CASCADE
);
CREATE INDEX ix_equipe_membro_empresa_usuario ON equipe_membro (empresa_id, usuario_id);

CREATE TABLE equipe_lider (
  empresa_id uuid NOT NULL DEFAULT app_empresa_id(),
  equipe_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  CONSTRAINT pk_equipe_lider PRIMARY KEY (equipe_id, usuario_id),
  CONSTRAINT fk_equipe_lider_equipe FOREIGN KEY (equipe_id, empresa_id) REFERENCES equipe (id, empresa_id) ON DELETE CASCADE,
  CONSTRAINT fk_equipe_lider_vinculo FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuario_empresa (empresa_id, usuario_id) ON DELETE CASCADE
);
CREATE INDEX ix_equipe_lider_empresa_usuario ON equipe_lider (empresa_id, usuario_id);

CREATE TABLE projeto_participante (
  empresa_id uuid NOT NULL DEFAULT app_empresa_id(),
  projeto_id uuid NOT NULL,
  usuario_id uuid NOT NULL,
  incluido_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_projeto_participante PRIMARY KEY (projeto_id, usuario_id),
  CONSTRAINT fk_projeto_participante_projeto FOREIGN KEY (projeto_id, empresa_id)
    REFERENCES projetos (id, empresa_id) ON DELETE CASCADE,
  CONSTRAINT fk_projeto_participante_vinculo FOREIGN KEY (empresa_id, usuario_id)
    REFERENCES usuario_empresa (empresa_id, usuario_id) ON DELETE CASCADE
);
CREATE INDEX ix_projeto_participante_empresa_usuario ON projeto_participante (empresa_id, usuario_id);

CREATE TABLE transferencia_dono (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL DEFAULT app_empresa_id() REFERENCES empresa (id) ON DELETE CASCADE,
  entidade text NOT NULL,
  registro_id uuid NOT NULL,
  de uuid,
  para uuid,
  por uuid,
  em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_transferencia_dono PRIMARY KEY (id),
  CONSTRAINT ck_transferencia_dono_entidade CHECK (entidade IN ('cliente', 'negocio', 'projeto', 'tarefa'))
);
CREATE INDEX ix_transferencia_dono_registro ON transferencia_dono (empresa_id, entidade, registro_id, em);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['equipe', 'equipe_membro', 'equipe_lider', 'projeto_participante', 'transferencia_dono'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO hub_runtime', t);
  END LOOP;
END
$$;

-- ============================================================================================ 2. escopo
CREATE FUNCTION app_usuarios_visiveis() RETURNS uuid[] LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('app.usuarios_visiveis', true), '')::uuid[], ARRAY[]::uuid[])
$$;
CREATE FUNCTION app_ve_tudo() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.ve_tudo', true), '') = '1'
$$;
CREATE FUNCTION app_ve_financeiro() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.ve_financeiro', true), '') = '1'
$$;
CREATE FUNCTION app_lider() RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT coalesce(current_setting('app.lider', true), '') = '1'
$$;
-- Usuário dentro do escopo (eu ou liderado). NULL nunca está no escopo.
CREATE FUNCTION app_no_escopo(p_usuario uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT p_usuario IS NOT NULL AND p_usuario = ANY (app_usuarios_visiveis())
$$;

CREATE FUNCTION app_definir_escopo() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
DECLARE
  v_usuario uuid := public.app_usuario_id();
  v_empresa uuid := public.app_empresa_id();
  v_papel text;
  v_visiveis uuid[];
  v_lider boolean;
BEGIN
  PERFORM set_config('app.usuarios_visiveis', '', true);
  PERFORM set_config('app.ve_tudo', '', true);
  PERFORM set_config('app.ve_financeiro', '', true);
  PERFORM set_config('app.lider', '', true);
  IF v_usuario IS NULL OR v_empresa IS NULL THEN
    RETURN;
  END IF;
  SELECT ue.papel INTO v_papel FROM public.usuario_empresa ue
   WHERE ue.empresa_id = v_empresa AND ue.usuario_id = v_usuario AND ue.ativo;
  IF v_papel IS NULL THEN
    RETURN;  -- sem vínculo ativo: nenhum escopo, nem como líder
  END IF;
  -- Árvore de liderança: membros das equipes que lidero e, recursivamente, os liderados deles.
  -- UNION (não UNION ALL) deduplica e encerra ciclos.
  WITH RECURSIVE arvore (usuario_id) AS (
    SELECT v_usuario
    UNION
    SELECT m.usuario_id
      FROM arvore a
      JOIN public.equipe_lider l ON l.usuario_id = a.usuario_id AND l.empresa_id = v_empresa
      JOIN public.equipe_membro m ON m.equipe_id = l.equipe_id AND m.empresa_id = v_empresa
  )
  SELECT array_agg(usuario_id) INTO v_visiveis FROM arvore;
  SELECT EXISTS (SELECT 1 FROM public.equipe_lider l WHERE l.empresa_id = v_empresa AND l.usuario_id = v_usuario)
    INTO v_lider;
  PERFORM set_config('app.usuarios_visiveis', v_visiveis::text, true);
  PERFORM set_config('app.ve_tudo', CASE WHEN v_papel = 'admin' THEN '1' ELSE '' END, true);
  PERFORM set_config('app.ve_financeiro', CASE WHEN v_papel IN ('admin', 'financeiro') THEN '1' ELSE '' END, true);
  PERFORM set_config('app.lider', CASE WHEN v_lider THEN '1' ELSE '' END, true);
END
$$;

-- ============================================================================================ 3. regras
-- Leituras auxiliares (ignoram RLS, mas sempre restritas à empresa ativa).
CREATE FUNCTION app_dono_cliente(p_cliente uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT c.responsavel_id FROM public.parceiro_negocio c WHERE c.id = p_cliente AND c.empresa_id = public.app_empresa_id()
$$;

CREATE FUNCTION app_nome_cliente(p_cliente uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT c.nome FROM public.parceiro_negocio c WHERE c.id = p_cliente AND c.empresa_id = public.app_empresa_id()
$$;

CREATE FUNCTION app_participa_projeto(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.projeto_etapas e
                  WHERE e.projeto_id = p_projeto AND e.empresa_id = public.app_empresa_id()
                    AND e.responsavel_id = ANY (public.app_usuarios_visiveis()))
      OR EXISTS (SELECT 1 FROM public.projeto_participante pp
                  WHERE pp.projeto_id = p_projeto AND pp.empresa_id = public.app_empresa_id()
                    AND pp.usuario_id = ANY (public.app_usuarios_visiveis()))
$$;

CREATE FUNCTION app_tem_participantes(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT EXISTS (SELECT 1 FROM public.projeto_etapas e
                  WHERE e.projeto_id = p_projeto AND e.empresa_id = public.app_empresa_id() AND e.responsavel_id IS NOT NULL)
      OR EXISTS (SELECT 1 FROM public.projeto_participante pp
                  WHERE pp.projeto_id = p_projeto AND pp.empresa_id = public.app_empresa_id())
$$;

-- Uma pessoa (não o conjunto V) é participante do projeto: responsável, responsável de etapa ou incluída.
CREATE FUNCTION app_e_participante(p_projeto uuid, p_usuario uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT p_usuario IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = p_projeto AND p.empresa_id = public.app_empresa_id()
                                              AND p.responsavel_id = p_usuario)
    OR EXISTS (SELECT 1 FROM public.projeto_etapas e WHERE e.projeto_id = p_projeto
                 AND e.empresa_id = public.app_empresa_id() AND e.responsavel_id = p_usuario)
    OR EXISTS (SELECT 1 FROM public.projeto_participante pp WHERE pp.projeto_id = p_projeto
                 AND pp.empresa_id = public.app_empresa_id() AND pp.usuario_id = p_usuario))
$$;

-- Regras por colunas (usadas pelas políticas, que já têm a linha) ------------------------------------
CREATE FUNCTION app_regra_ver_cliente(p_dono uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo() OR app_ve_financeiro() OR p_dono IS NULL OR app_no_escopo(p_dono)
$$;

CREATE FUNCTION app_regra_ver_negocio(p_resp uuid, p_cliente uuid) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE d uuid;
BEGIN
  IF app_ve_tudo() OR app_no_escopo(p_resp) THEN RETURN true; END IF;
  d := app_dono_cliente(p_cliente);
  RETURN app_no_escopo(d) OR (p_resp IS NULL AND d IS NULL);
END
$$;

CREATE FUNCTION app_regra_ver_projeto(p_id uuid, p_resp uuid, p_cliente uuid) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE d uuid;
BEGIN
  IF app_ve_tudo() OR app_no_escopo(p_resp) THEN RETURN true; END IF;
  d := app_dono_cliente(p_cliente);
  IF app_no_escopo(d) OR app_participa_projeto(p_id) THEN RETURN true; END IF;
  RETURN p_resp IS NULL AND d IS NULL AND NOT app_tem_participantes(p_id);
END
$$;

-- Leituras por id (ignoram RLS; aplicam a regra explicitamente) -------------------------------------
CREATE FUNCTION app_pode_ver_cliente(p_cliente uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_ver_cliente(c.responsavel_id) FROM public.parceiro_negocio c
                    WHERE c.id = p_cliente AND c.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_pode_ver_negocio(p_negocio uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_ver_negocio(n.responsavel_id, n.cliente_id) FROM public.negocios n
                    WHERE n.id = p_negocio AND n.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_pode_ver_projeto(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_ver_projeto(p.id, p.responsavel_id, p.cliente_id) FROM public.projetos p
                    WHERE p.id = p_projeto AND p.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_regra_ver_orcamento(p_negocio uuid, p_criador uuid, p_cliente uuid) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE d uuid;
BEGIN
  IF app_ve_tudo() THEN RETURN true; END IF;
  IF p_negocio IS NOT NULL THEN RETURN app_pode_ver_negocio(p_negocio); END IF;
  IF app_no_escopo(p_criador) THEN RETURN true; END IF;
  d := app_dono_cliente(p_cliente);
  RETURN app_no_escopo(d) OR (p_criador IS NULL AND d IS NULL);
END
$$;

CREATE FUNCTION app_regra_ver_tarefa(p_resp uuid, p_cliente uuid, p_projeto uuid) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
DECLARE d uuid;
BEGIN
  IF app_ve_tudo() OR app_no_escopo(p_resp) THEN RETURN true; END IF;
  IF p_projeto IS NOT NULL AND app_pode_ver_projeto(p_projeto) THEN RETURN true; END IF;
  d := CASE WHEN p_cliente IS NULL THEN NULL ELSE app_dono_cliente(p_cliente) END;
  IF app_no_escopo(d) THEN RETURN true; END IF;
  RETURN p_projeto IS NULL AND p_resp IS NULL AND d IS NULL;
END
$$;

CREATE FUNCTION app_pode_ver_orcamento(p_orcamento uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_ver_orcamento(o.negocio_id, o.criado_por, o.cliente_id) FROM public.orcamentos o
                    WHERE o.id = p_orcamento AND o.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_pode_ver_tarefa(p_tarefa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_ver_tarefa(t.responsavel_id, t.cliente_id, t.projeto_id) FROM public.tarefas t
                    WHERE t.id = p_tarefa AND t.empresa_id = public.app_empresa_id()), false)
$$;

-- Edição ---------------------------------------------------------------------------------------------
-- Dono no escopo (eu ou liderado) edita; registro sem dono é editável por quem o vê; admin edita tudo.
CREATE FUNCTION app_regra_editar_cliente(p_dono uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo() OR app_ve_financeiro() OR p_dono IS NULL OR app_no_escopo(p_dono)
$$;

CREATE FUNCTION app_regra_editar_negocio(p_resp uuid, p_cliente uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo() OR app_no_escopo(p_resp) OR (p_resp IS NULL AND app_regra_ver_negocio(p_resp, p_cliente))
$$;

CREATE FUNCTION app_regra_editar_projeto(p_id uuid, p_resp uuid, p_cliente uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo() OR app_no_escopo(p_resp) OR (p_resp IS NULL AND app_regra_ver_projeto(p_id, p_resp, p_cliente))
$$;

CREATE FUNCTION app_pode_editar_negocio(p_negocio uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_editar_negocio(n.responsavel_id, n.cliente_id) FROM public.negocios n
                    WHERE n.id = p_negocio AND n.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_pode_editar_projeto(p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_editar_projeto(p.id, p.responsavel_id, p.cliente_id) FROM public.projetos p
                    WHERE p.id = p_projeto AND p.empresa_id = public.app_empresa_id()), false)
$$;

-- Orçamento: o dono é o responsável do negócio (se houver negócio) ou quem o criou.
CREATE FUNCTION app_regra_editar_orcamento(p_negocio uuid, p_criador uuid, p_cliente uuid) RETURNS boolean
LANGUAGE plpgsql STABLE AS $$
BEGIN
  IF app_ve_tudo() THEN RETURN true; END IF;
  IF p_negocio IS NOT NULL THEN RETURN app_pode_editar_negocio(p_negocio); END IF;
  RETURN app_no_escopo(p_criador) OR (p_criador IS NULL AND app_regra_ver_orcamento(p_negocio, p_criador, p_cliente));
END
$$;

CREATE FUNCTION app_pode_editar_orcamento(p_orcamento uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_editar_orcamento(o.negocio_id, o.criado_por, o.cliente_id) FROM public.orcamentos o
                    WHERE o.id = p_orcamento AND o.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_regra_editar_etapa(p_projeto uuid, p_resp uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo() OR app_no_escopo(p_resp) OR app_pode_editar_projeto(p_projeto)
$$;

CREATE FUNCTION app_regra_editar_tarefa(p_resp uuid, p_cliente uuid, p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo() OR app_no_escopo(p_resp)
      OR (p_projeto IS NOT NULL AND app_pode_editar_projeto(p_projeto))
      OR (p_resp IS NULL AND app_regra_ver_tarefa(p_resp, p_cliente, p_projeto))
$$;

CREATE FUNCTION app_pode_editar_tarefa(p_tarefa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_editar_tarefa(t.responsavel_id, t.cliente_id, t.projeto_id) FROM public.tarefas t
                    WHERE t.id = p_tarefa AND t.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_pode_editar_etapa(p_etapa uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_editar_etapa(e.projeto_id, e.responsavel_id) FROM public.projeto_etapas e
                    WHERE e.id = p_etapa AND e.empresa_id = public.app_empresa_id()), false)
$$;

CREATE FUNCTION app_pode_editar_cliente(p_cliente uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT coalesce((SELECT public.app_regra_editar_cliente(c.responsavel_id) FROM public.parceiro_negocio c
                    WHERE c.id = p_cliente AND c.empresa_id = public.app_empresa_id()), false)
$$;

-- Referências mínimas: clientes visíveis ou ligados a algo visível; projetos de tarefas visíveis -------
CREATE FUNCTION app_clientes_referencia() RETURNS TABLE (id uuid, nome text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT c.id, c.nome FROM public.parceiro_negocio c
   WHERE c.empresa_id = public.app_empresa_id()
     AND EXISTS (SELECT 1 FROM public.parceiro_papel pp WHERE pp.parceiro_id = c.id AND pp.papel = 'cliente')
     AND ( public.app_regra_ver_cliente(c.responsavel_id)
        OR EXISTS (SELECT 1 FROM public.negocios n WHERE n.cliente_id = c.id AND n.empresa_id = c.empresa_id
                     AND public.app_regra_ver_negocio(n.responsavel_id, n.cliente_id))
        OR EXISTS (SELECT 1 FROM public.orcamentos o WHERE o.cliente_id = c.id AND o.empresa_id = c.empresa_id
                     AND public.app_regra_ver_orcamento(o.negocio_id, o.criado_por, o.cliente_id))
        OR EXISTS (SELECT 1 FROM public.projetos p WHERE p.cliente_id = c.id AND p.empresa_id = c.empresa_id
                     AND public.app_regra_ver_projeto(p.id, p.responsavel_id, p.cliente_id))
        OR EXISTS (SELECT 1 FROM public.tarefas t WHERE t.cliente_id = c.id AND t.empresa_id = c.empresa_id
                     AND public.app_regra_ver_tarefa(t.responsavel_id, t.cliente_id, t.projeto_id)))
   ORDER BY c.nome
$$;

CREATE FUNCTION app_projetos_referencia() RETURNS TABLE (id uuid, titulo text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT p.id, p.titulo FROM public.projetos p
   WHERE p.empresa_id = public.app_empresa_id()
     AND ( public.app_regra_ver_projeto(p.id, p.responsavel_id, p.cliente_id)
        OR EXISTS (SELECT 1 FROM public.tarefas t WHERE t.projeto_id = p.id AND t.empresa_id = p.empresa_id
                     AND public.app_regra_ver_tarefa(t.responsavel_id, t.cliente_id, t.projeto_id)))
   ORDER BY p.titulo
$$;

-- ============================================================================================ 4. políticas
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['parceiro_negocio', 'negocios', 'orcamentos', 'orcamento_itens', 'projetos',
                           'projeto_etapas', 'tarefas', 'tarefa_checklist'] LOOP
    EXECUTE format('DROP POLICY %I ON %I', 'tenant_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE USING (empresa_id = app_empresa_id()) '
                   'WITH CHECK (empresa_id = app_empresa_id())', 'tenant_' || t, t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['equipe', 'equipe_membro', 'equipe_lider', 'projeto_participante', 'transferencia_dono'] LOOP
    EXECUTE format('CREATE POLICY %I ON %I AS RESTRICTIVE USING (empresa_id = app_empresa_id()) '
                   'WITH CHECK (empresa_id = app_empresa_id())', 'tenant_' || t, t);
  END LOOP;
END
$$;

-- clientes (parceiro_negocio): o hub financeiro e o admin veem e editam todos
CREATE POLICY escopo_ver ON parceiro_negocio FOR SELECT USING (app_regra_ver_cliente(responsavel_id));
CREATE POLICY escopo_incluir ON parceiro_negocio FOR INSERT WITH CHECK (app_regra_editar_cliente(responsavel_id));
CREATE POLICY escopo_alterar ON parceiro_negocio FOR UPDATE USING (app_regra_editar_cliente(responsavel_id))
  WITH CHECK (true);  -- troca de dono validada pelo gatilho
CREATE POLICY escopo_excluir ON parceiro_negocio FOR DELETE USING (app_regra_editar_cliente(responsavel_id));

-- negócios
CREATE POLICY escopo_ver ON negocios FOR SELECT USING (app_regra_ver_negocio(responsavel_id, cliente_id));
CREATE POLICY escopo_incluir ON negocios FOR INSERT WITH CHECK (app_regra_editar_negocio(responsavel_id, cliente_id));
CREATE POLICY escopo_alterar ON negocios FOR UPDATE USING (app_regra_editar_negocio(responsavel_id, cliente_id))
  WITH CHECK (true);  -- troca de responsável validada pelo gatilho (precisa do valor anterior)
CREATE POLICY escopo_excluir ON negocios FOR DELETE USING (app_regra_editar_negocio(responsavel_id, cliente_id));

-- orçamentos e itens
CREATE POLICY escopo_ver ON orcamentos FOR SELECT USING (app_regra_ver_orcamento(negocio_id, criado_por, cliente_id));
CREATE POLICY escopo_incluir ON orcamentos FOR INSERT WITH CHECK (app_regra_editar_orcamento(negocio_id, criado_por, cliente_id));
CREATE POLICY escopo_alterar ON orcamentos FOR UPDATE USING (app_regra_editar_orcamento(negocio_id, criado_por, cliente_id))
  WITH CHECK (app_regra_editar_orcamento(negocio_id, criado_por, cliente_id));
CREATE POLICY escopo_excluir ON orcamentos FOR DELETE USING (app_regra_editar_orcamento(negocio_id, criado_por, cliente_id));
CREATE POLICY escopo_ver ON orcamento_itens FOR SELECT USING (app_pode_ver_orcamento(orcamento_id));
CREATE POLICY escopo_editar ON orcamento_itens FOR ALL USING (app_pode_editar_orcamento(orcamento_id))
  WITH CHECK (app_pode_editar_orcamento(orcamento_id));

-- projetos, etapas e participantes
CREATE POLICY escopo_ver ON projetos FOR SELECT USING (app_regra_ver_projeto(id, responsavel_id, cliente_id));
CREATE POLICY escopo_incluir ON projetos FOR INSERT WITH CHECK (app_ve_tudo() OR responsavel_id IS NULL OR app_no_escopo(responsavel_id));
CREATE POLICY escopo_alterar ON projetos FOR UPDATE USING (app_regra_editar_projeto(id, responsavel_id, cliente_id))
  WITH CHECK (true);
CREATE POLICY escopo_excluir ON projetos FOR DELETE USING (app_regra_editar_projeto(id, responsavel_id, cliente_id));

CREATE POLICY escopo_ver ON projeto_etapas FOR SELECT USING (app_pode_ver_projeto(projeto_id));
CREATE POLICY escopo_incluir ON projeto_etapas FOR INSERT WITH CHECK (app_pode_editar_projeto(projeto_id));
CREATE POLICY escopo_alterar ON projeto_etapas FOR UPDATE USING (app_regra_editar_etapa(projeto_id, responsavel_id))
  WITH CHECK (true);
CREATE POLICY escopo_excluir ON projeto_etapas FOR DELETE USING (app_pode_editar_projeto(projeto_id));

CREATE POLICY escopo_ver ON projeto_participante FOR SELECT USING (app_pode_ver_projeto(projeto_id));
CREATE POLICY escopo_editar ON projeto_participante FOR ALL USING (app_pode_editar_projeto(projeto_id))
  WITH CHECK (app_pode_editar_projeto(projeto_id));

-- tarefas e checklist
CREATE POLICY escopo_ver ON tarefas FOR SELECT USING (app_regra_ver_tarefa(responsavel_id, cliente_id, projeto_id));
CREATE POLICY escopo_incluir ON tarefas FOR INSERT WITH CHECK (
  app_ve_tudo()
  OR (projeto_id IS NOT NULL AND app_pode_ver_projeto(projeto_id))
  OR (projeto_id IS NULL AND (responsavel_id IS NULL OR app_no_escopo(responsavel_id))));
CREATE POLICY escopo_alterar ON tarefas FOR UPDATE USING (app_regra_editar_tarefa(responsavel_id, cliente_id, projeto_id))
  WITH CHECK (true);
CREATE POLICY escopo_excluir ON tarefas FOR DELETE USING (app_regra_editar_tarefa(responsavel_id, cliente_id, projeto_id));
CREATE POLICY escopo_ver ON tarefa_checklist FOR SELECT USING (app_pode_ver_tarefa(tarefa_id));
CREATE POLICY escopo_editar ON tarefa_checklist FOR ALL USING (app_pode_editar_tarefa(tarefa_id))
  WITH CHECK (app_pode_editar_tarefa(tarefa_id));

-- equipes: todos da empresa leem (a casca mostra o nome); só admin altera
CREATE POLICY escopo_ver ON equipe FOR SELECT USING (true);
CREATE POLICY escopo_editar ON equipe FOR ALL USING (app_ve_tudo()) WITH CHECK (app_ve_tudo());
CREATE POLICY escopo_ver ON equipe_membro FOR SELECT USING (true);
CREATE POLICY escopo_editar ON equipe_membro FOR ALL USING (app_ve_tudo()) WITH CHECK (app_ve_tudo());
CREATE POLICY escopo_ver ON equipe_lider FOR SELECT USING (true);
CREATE POLICY escopo_editar ON equipe_lider FOR ALL USING (app_ve_tudo()) WITH CHECK (app_ve_tudo());

-- transferências: só o admin lê; quem grava é o gatilho de dono
CREATE POLICY escopo_ver ON transferencia_dono FOR SELECT USING (app_ve_tudo());
CREATE POLICY escopo_incluir ON transferencia_dono FOR INSERT WITH CHECK (por = app_usuario_id());

-- ============================================================================================ 5. gatilhos
-- Quem pode deixar `p_novo` como dono (inclusive ninguém) de um registro de topo, vindo de `p_antigo`.
CREATE FUNCTION app_pode_atribuir_dono(p_antigo uuid, p_novo uuid, p_inclusao boolean) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT app_ve_tudo()
      OR (p_inclusao AND p_novo IS NOT NULL AND p_novo = app_usuario_id())
      OR (app_lider() AND (p_inclusao OR p_antigo IS NULL OR app_no_escopo(p_antigo))
                      AND (p_novo IS NULL OR app_no_escopo(p_novo)))
$$;

-- Vínculo com cliente: o cliente é visível, ou vem de um negócio/projeto visível do mesmo cliente.
CREATE FUNCTION app_pode_vincular_cliente(p_cliente uuid, p_negocio uuid, p_projeto uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public SET row_security = off AS $$
  SELECT p_cliente IS NULL
      OR public.app_pode_ver_cliente(p_cliente)
      OR (p_negocio IS NOT NULL AND public.app_pode_ver_negocio(p_negocio)
          AND EXISTS (SELECT 1 FROM public.negocios n WHERE n.id = p_negocio AND n.cliente_id = p_cliente
                        AND n.empresa_id = public.app_empresa_id()))
      OR (p_projeto IS NOT NULL AND public.app_pode_ver_projeto(p_projeto)
          AND EXISTS (SELECT 1 FROM public.projetos p WHERE p.id = p_projeto AND p.cliente_id = p_cliente
                        AND p.empresa_id = public.app_empresa_id()))
$$;

CREATE FUNCTION app_validar_escopo() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_entidade text := TG_ARGV[0];
  v_inclusao boolean := TG_OP = 'INSERT';
  -- As tabelas têm colunas diferentes: lê os campos pela representação jsonb da linha.
  n jsonb := to_jsonb(NEW);
  o jsonb := CASE WHEN TG_OP = 'INSERT' THEN '{}'::jsonb ELSE to_jsonb(OLD) END;
  v_cliente uuid := (n ->> 'cliente_id')::uuid;
  v_negocio uuid := (n ->> 'negocio_id')::uuid;
  v_projeto uuid := (n ->> 'projeto_id')::uuid;
  v_antigo uuid := (o ->> 'responsavel_id')::uuid;
  v_novo uuid := (n ->> 'responsavel_id')::uuid;
  v_ok boolean;
BEGIN
  -- Scripts do operador e migrações rodam sem usuário: as regras de escopo valem para requisições.
  IF app_usuario_id() IS NULL THEN
    RETURN NEW;
  END IF;

  -- 1. vínculos (FKs ignoram RLS): cliente e negócio precisam estar no escopo de quem grava
  IF v_entidade IN ('negocio', 'orcamento', 'projeto', 'tarefa')
     AND (v_inclusao OR v_cliente IS DISTINCT FROM (o ->> 'cliente_id')::uuid)
     AND NOT app_pode_vincular_cliente(v_cliente,
               CASE WHEN v_entidade IN ('orcamento', 'projeto') THEN v_negocio END,
               CASE WHEN v_entidade = 'tarefa' THEN v_projeto END) THEN
    RAISE EXCEPTION 'cliente fora do escopo' USING ERRCODE = 'insufficient_privilege', HINT = 'escopo_cliente';
  END IF;
  IF v_entidade IN ('orcamento', 'projeto') AND v_negocio IS NOT NULL
     AND (v_inclusao OR v_negocio IS DISTINCT FROM (o ->> 'negocio_id')::uuid)
     AND NOT app_pode_ver_negocio(v_negocio) THEN
    RAISE EXCEPTION 'negócio fora do escopo' USING ERRCODE = 'insufficient_privilege', HINT = 'escopo_cliente';
  END IF;
  IF v_entidade = 'orcamento' THEN
    RETURN NEW;  -- o dono do orçamento é o do negócio (ou quem criou)
  END IF;

  -- 2. dono
  IF NOT v_inclusao AND v_novo IS NOT DISTINCT FROM v_antigo THEN
    RETURN NEW;
  END IF;
  IF v_entidade = 'etapa' THEN
    v_ok := v_novo IS NULL OR app_ve_tudo() OR app_pode_editar_projeto(v_projeto)
            OR (app_lider() AND app_no_escopo(v_novo));
  ELSIF v_entidade = 'tarefa' AND v_projeto IS NOT NULL THEN
    -- dentro de projeto: participante atribui a si ou a outro participante; quem edita o projeto, a qualquer um
    v_ok := v_novo IS NULL OR v_novo = app_usuario_id() OR app_ve_tudo()
            OR app_pode_editar_projeto(v_projeto)
            OR (app_pode_ver_projeto(v_projeto) AND app_e_participante(v_projeto, v_novo))
            OR (app_lider() AND app_no_escopo(v_novo));
  ELSE
    v_ok := app_pode_atribuir_dono(v_antigo, v_novo, v_inclusao);
  END IF;
  IF NOT v_ok THEN
    RAISE EXCEPTION 'atribuição de responsável não permitida' USING ERRCODE = 'insufficient_privilege', HINT = 'escopo_dono';
  END IF;

  IF NOT v_inclusao AND v_entidade IN ('cliente', 'negocio', 'projeto', 'tarefa') THEN
    INSERT INTO transferencia_dono (empresa_id, entidade, registro_id, de, para, por)
    VALUES ((n ->> 'empresa_id')::uuid, v_entidade, (n ->> 'id')::uuid, v_antigo, v_novo, app_usuario_id());
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER tg_parceiro_negocio_escopo BEFORE INSERT OR UPDATE ON parceiro_negocio
  FOR EACH ROW EXECUTE FUNCTION app_validar_escopo('cliente');
CREATE TRIGGER tg_negocios_escopo BEFORE INSERT OR UPDATE ON negocios
  FOR EACH ROW EXECUTE FUNCTION app_validar_escopo('negocio');
CREATE TRIGGER tg_orcamentos_escopo BEFORE INSERT OR UPDATE ON orcamentos
  FOR EACH ROW EXECUTE FUNCTION app_validar_escopo('orcamento');
CREATE TRIGGER tg_projetos_escopo BEFORE INSERT OR UPDATE ON projetos
  FOR EACH ROW EXECUTE FUNCTION app_validar_escopo('projeto');
CREATE TRIGGER tg_projeto_etapas_escopo BEFORE INSERT OR UPDATE ON projeto_etapas
  FOR EACH ROW EXECUTE FUNCTION app_validar_escopo('etapa');
CREATE TRIGGER tg_tarefas_escopo BEFORE INSERT OR UPDATE ON tarefas
  FOR EACH ROW EXECUTE FUNCTION app_validar_escopo('tarefa');

-- A view de totais lia o nome pelo JOIN com parceiro_negocio; com RLS por dono, quem vê o orçamento
-- de um cliente alheio perderia a linha. O nome passa a vir de app_nome_cliente (só o nome).
CREATE OR REPLACE VIEW vw_orcamentos_totais WITH (security_invoker = true) AS
SELECT o.id,
    o.numero,
    o.data,
    o.validade_dias,
    (o.data + o.validade_dias) AS validade_ate,
    o.status,
    ((o.status = 'enviado'::text) AND ((o.data + o.validade_dias) < CURRENT_DATE)) AS vencido,
    o.desconto,
    o.cliente_id,
    app_nome_cliente(o.cliente_id)::varchar(150) AS cliente_nome,
    o.negocio_id,
    o.aprovado_em,
    (COALESCE(t.qtd_itens, (0)::bigint))::integer AS qtd_itens,
    (COALESCE(t.soma_unicos, (0)::numeric))::numeric(14,2) AS subtotal_projeto,
    (GREATEST((0)::numeric, (COALESCE(t.soma_unicos, (0)::numeric) - o.desconto)))::numeric(14,2) AS total_projeto,
    (COALESCE(t.soma_mensal, (0)::numeric))::numeric(14,2) AS total_mensal
   FROM orcamentos o
     LEFT JOIN LATERAL ( SELECT count(*) AS qtd_itens,
            sum(i.subtotal) FILTER (WHERE (NOT i.mensal)) AS soma_unicos,
            sum(i.subtotal) FILTER (WHERE i.mensal) AS soma_mensal
           FROM orcamento_itens i
          WHERE (i.orcamento_id = o.id)) t ON (true);

-- ============================================================================================ 6. permissões
DO $$
DECLARE f text;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure::text FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('app_usuarios_visiveis', 'app_ve_tudo', 'app_ve_financeiro', 'app_lider', 'app_no_escopo',
         'app_definir_escopo', 'app_dono_cliente', 'app_nome_cliente', 'app_participa_projeto', 'app_tem_participantes',
         'app_e_participante', 'app_regra_ver_cliente', 'app_regra_ver_negocio', 'app_regra_ver_projeto',
         'app_pode_ver_cliente', 'app_pode_ver_negocio', 'app_pode_ver_projeto', 'app_regra_ver_orcamento',
         'app_regra_ver_tarefa', 'app_pode_ver_orcamento', 'app_pode_ver_tarefa', 'app_regra_editar_cliente',
         'app_regra_editar_negocio', 'app_regra_editar_projeto', 'app_pode_editar_negocio', 'app_pode_editar_projeto',
         'app_regra_editar_orcamento', 'app_pode_editar_orcamento', 'app_regra_editar_etapa', 'app_regra_editar_tarefa',
         'app_pode_editar_tarefa', 'app_pode_editar_etapa', 'app_pode_editar_cliente', 'app_clientes_referencia',
         'app_projetos_referencia', 'app_pode_atribuir_dono', 'app_pode_vincular_cliente')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO hub_runtime', f);
  END LOOP;
END
$$;

-- ============================================================================================ 7. dados
-- Dono de cada cliente: responsável do negócio mais recente com ele (sem negócio com responsável: sem dono).
UPDATE parceiro_negocio c
   SET responsavel_id = ult.responsavel_id
  FROM (SELECT DISTINCT ON (n.empresa_id, n.cliente_id) n.empresa_id, n.cliente_id, n.responsavel_id
          FROM negocios n
         WHERE n.responsavel_id IS NOT NULL
         ORDER BY n.empresa_id, n.cliente_id, n.criado_em DESC, n.id DESC) ult
 WHERE c.id = ult.cliente_id AND c.empresa_id = ult.empresa_id
   AND EXISTS (SELECT 1 FROM usuario_empresa ue WHERE ue.empresa_id = c.empresa_id AND ue.usuario_id = ult.responsavel_id);
