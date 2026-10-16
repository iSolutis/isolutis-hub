-- Desfaz 0013: volta ao isolamento só por empresa. Equipes, participantes, donos de cliente e o registro de
-- transferências são descartados.
DROP TRIGGER IF EXISTS tg_parceiro_negocio_escopo ON parceiro_negocio;
DROP TRIGGER IF EXISTS tg_negocios_escopo ON negocios;
DROP TRIGGER IF EXISTS tg_orcamentos_escopo ON orcamentos;
DROP TRIGGER IF EXISTS tg_projetos_escopo ON projetos;
DROP TRIGGER IF EXISTS tg_projeto_etapas_escopo ON projeto_etapas;
DROP TRIGGER IF EXISTS tg_tarefas_escopo ON tarefas;

CREATE OR REPLACE VIEW vw_orcamentos_totais WITH (security_invoker = true) AS
SELECT o.id, o.numero, o.data, o.validade_dias, (o.data + o.validade_dias) AS validade_ate, o.status,
    ((o.status = 'enviado'::text) AND ((o.data + o.validade_dias) < CURRENT_DATE)) AS vencido,
    o.desconto, o.cliente_id, c.nome AS cliente_nome, o.negocio_id, o.aprovado_em,
    (COALESCE(t.qtd_itens, (0)::bigint))::integer AS qtd_itens,
    (COALESCE(t.soma_unicos, (0)::numeric))::numeric(14,2) AS subtotal_projeto,
    (GREATEST((0)::numeric, (COALESCE(t.soma_unicos, (0)::numeric) - o.desconto)))::numeric(14,2) AS total_projeto,
    (COALESCE(t.soma_mensal, (0)::numeric))::numeric(14,2) AS total_mensal
   FROM ((orcamentos o
     JOIN parceiro_negocio c ON ((c.id = o.cliente_id)))
     LEFT JOIN LATERAL ( SELECT count(*) AS qtd_itens,
            sum(i.subtotal) FILTER (WHERE (NOT i.mensal)) AS soma_unicos,
            sum(i.subtotal) FILTER (WHERE i.mensal) AS soma_mensal
           FROM orcamento_itens i
          WHERE (i.orcamento_id = o.id)) t ON (true));

DO $$
DECLARE t text; p record;
BEGIN
  FOREACH t IN ARRAY ARRAY['parceiro_negocio', 'negocios', 'orcamentos', 'orcamento_itens', 'projetos',
                           'projeto_etapas', 'tarefas', 'tarefa_checklist'] LOOP
    FOR p IN SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = t LOOP
      EXECUTE format('DROP POLICY %I ON %I', p.policyname, t);
    END LOOP;
    EXECUTE format('CREATE POLICY %I ON %I USING (empresa_id = app_empresa_id()) WITH CHECK (empresa_id = app_empresa_id())',
                   'tenant_' || t, t);
  END LOOP;
END
$$;

DROP TABLE IF EXISTS transferencia_dono, projeto_participante, equipe_lider, equipe_membro, equipe;

DROP FUNCTION IF EXISTS app_validar_escopo() CASCADE;
DROP FUNCTION IF EXISTS app_pode_vincular_cliente(uuid, uuid, uuid), app_pode_atribuir_dono(uuid, uuid, boolean),
  app_projetos_referencia(), app_clientes_referencia(), app_pode_editar_cliente(uuid), app_pode_editar_etapa(uuid),
  app_pode_editar_tarefa(uuid), app_regra_editar_tarefa(uuid, uuid, uuid), app_regra_editar_etapa(uuid, uuid),
  app_pode_editar_orcamento(uuid), app_regra_editar_orcamento(uuid, uuid, uuid), app_pode_editar_projeto(uuid),
  app_pode_editar_negocio(uuid), app_regra_editar_projeto(uuid, uuid, uuid), app_regra_editar_negocio(uuid, uuid),
  app_regra_editar_cliente(uuid), app_pode_ver_tarefa(uuid), app_pode_ver_orcamento(uuid),
  app_regra_ver_tarefa(uuid, uuid, uuid), app_regra_ver_orcamento(uuid, uuid, uuid), app_pode_ver_projeto(uuid),
  app_pode_ver_negocio(uuid), app_pode_ver_cliente(uuid), app_regra_ver_projeto(uuid, uuid, uuid),
  app_regra_ver_negocio(uuid, uuid), app_regra_ver_cliente(uuid), app_e_participante(uuid, uuid),
  app_tem_participantes(uuid), app_participa_projeto(uuid), app_nome_cliente(uuid), app_dono_cliente(uuid),
  app_definir_escopo(), app_no_escopo(uuid), app_lider(), app_ve_financeiro(), app_ve_tudo(), app_usuarios_visiveis();

DROP INDEX IF EXISTS ix_projetos_empresa_cliente_escopo, ix_tarefas_empresa_cliente,
  ix_projeto_etapas_projeto_responsavel, ix_parceiro_empresa_responsavel;
ALTER TABLE parceiro_negocio DROP COLUMN IF EXISTS responsavel_id;
