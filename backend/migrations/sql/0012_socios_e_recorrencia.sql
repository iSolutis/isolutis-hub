-- 0012 · sócios como parceiros, aporte no plano de contas e títulos recorrentes.
--
-- 1. Papel `socio` no hub de parceiros e participação do sócio na empresa (1:1 com o parceiro).
-- 2. plano_contas.aporte_socio: marca a conta (analítica, de receita) em que entram os aportes de sócios.
-- 3. recorrencia_titulo: modelo de uma despesa/receita que se repete; os títulos são gerados em titulo_financeiro
--    com recorrencia_id (um por vencimento).

-- ---------------------------------------------------------------------------
-- 1. Sócios
-- ---------------------------------------------------------------------------
INSERT INTO papel_parceiro (codigo, nome) VALUES ('socio', 'Sócio') ON CONFLICT (codigo) DO NOTHING;

CREATE TABLE parceiro_socio (
  empresa_id              uuid          NOT NULL DEFAULT app_empresa_id(),
  parceiro_id             uuid          NOT NULL,
  participacao_percentual numeric(5,2)  NOT NULL,
  created_at              timestamptz   NOT NULL DEFAULT now(),
  updated_at              timestamptz,
  CONSTRAINT pk_parceiro_socio PRIMARY KEY (empresa_id, parceiro_id),
  CONSTRAINT ck_parceiro_socio_participacao CHECK (participacao_percentual > 0 AND participacao_percentual <= 100),
  CONSTRAINT fk_parceiro_socio_empresa FOREIGN KEY (empresa_id) REFERENCES empresa (id) ON DELETE RESTRICT,
  CONSTRAINT fk_parceiro_socio_parceiro FOREIGN KEY (parceiro_id, empresa_id) REFERENCES parceiro_negocio (id, empresa_id) ON DELETE CASCADE
);
CREATE TRIGGER tg_parceiro_socio_updated BEFORE UPDATE ON parceiro_socio
  FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();
COMMENT ON TABLE parceiro_socio IS 'Participação (%) de cada parceiro com o papel `socio` na empresa. A soma por empresa não passa de 100 (validada pelo serviço).';

ALTER TABLE parceiro_socio ENABLE ROW LEVEL SECURITY;
ALTER TABLE parceiro_socio FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_parceiro_socio ON parceiro_socio
  USING (empresa_id = app_empresa_id()) WITH CHECK (empresa_id = app_empresa_id());

-- ---------------------------------------------------------------------------
-- 2. Conta de aporte no plano de contas
-- ---------------------------------------------------------------------------
ALTER TABLE plano_contas ADD COLUMN aporte_socio boolean NOT NULL DEFAULT false;
ALTER TABLE plano_contas ADD CONSTRAINT ck_plano_contas_aporte
  CHECK (NOT aporte_socio OR (tipo_conta = 'A' AND natureza = 'R'));
COMMENT ON COLUMN plano_contas.aporte_socio IS 'Conta em que entram os aportes de sócios: só analítica e de receita. Títulos nela exigem um parceiro com o papel `socio`.';

-- Empresas que já têm o plano padrão: marca "Aportes de Capital" (7.02.001).
UPDATE plano_contas SET aporte_socio = true
WHERE codigo = '7.02.001' AND tipo_conta = 'A' AND natureza = 'R';

-- ---------------------------------------------------------------------------
-- 3. Recorrência de títulos
-- ---------------------------------------------------------------------------
CREATE TABLE recorrencia_titulo (
  id                 uuid          NOT NULL DEFAULT gen_random_uuid(),
  empresa_id         uuid          NOT NULL DEFAULT app_empresa_id(),
  tipo_conta         char(1)       NOT NULL,
  conta_bancaria_id  uuid          NOT NULL,
  plano_conta_id     uuid          NOT NULL,
  parceiro_id        uuid          NOT NULL,
  valor_titulo       numeric(13,2) NOT NULL,
  anotacao           text,
  frequencia         text          NOT NULL,
  data_inicio        date          NOT NULL,
  termino            text          NOT NULL,
  data_fim           date,
  quantidade         integer,
  ativa              boolean       NOT NULL DEFAULT true,
  gerado_ate         date,
  encerrada_em       timestamptz,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz,
  CONSTRAINT pk_recorrencia_titulo PRIMARY KEY (id),
  CONSTRAINT uq_recorrencia_titulo_id_empresa UNIQUE (id, empresa_id),
  CONSTRAINT ck_recorrencia_titulo_tipo CHECK (tipo_conta IN ('P', 'R')),
  CONSTRAINT ck_recorrencia_titulo_valor CHECK (valor_titulo > 0),
  CONSTRAINT ck_recorrencia_titulo_frequencia CHECK (
    frequencia IN ('semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  CONSTRAINT ck_recorrencia_titulo_termino CHECK (
    (termino = 'data' AND data_fim IS NOT NULL AND quantidade IS NULL AND data_fim >= data_inicio)
    OR (termino = 'quantidade' AND quantidade IS NOT NULL AND quantidade > 0 AND data_fim IS NULL)
    OR (termino = 'sem_fim' AND data_fim IS NULL AND quantidade IS NULL)),
  CONSTRAINT fk_recorrencia_titulo_empresa FOREIGN KEY (empresa_id) REFERENCES empresa (id) ON DELETE RESTRICT,
  CONSTRAINT fk_recorrencia_titulo_conta_bancaria FOREIGN KEY (conta_bancaria_id, empresa_id) REFERENCES conta_bancaria (id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT fk_recorrencia_titulo_plano_conta FOREIGN KEY (plano_conta_id, empresa_id) REFERENCES plano_contas (id, empresa_id) ON DELETE RESTRICT,
  CONSTRAINT fk_recorrencia_titulo_parceiro FOREIGN KEY (parceiro_id, empresa_id) REFERENCES parceiro_negocio (id, empresa_id) ON DELETE RESTRICT
);
COMMENT ON COLUMN recorrencia_titulo.gerado_ate IS 'Último vencimento já gerado. A renovação só cria vencimentos depois dele, então título apagado à mão não reaparece.';
COMMENT ON TABLE recorrencia_titulo IS 'Modelo de despesa (P) ou receita (R) recorrente. Os títulos são gerados em titulo_financeiro (recorrencia_id) num horizonte móvel; o dia do vencimento é o dia de data_inicio (mês curto cai no último dia).';
CREATE TRIGGER tg_recorrencia_titulo_updated BEFORE UPDATE ON recorrencia_titulo
  FOR EACH ROW EXECUTE FUNCTION fin_touch_updated_at();
CREATE INDEX ix_recorrencia_titulo_empresa ON recorrencia_titulo (empresa_id, ativa);
CREATE INDEX ix_recorrencia_titulo_parceiro ON recorrencia_titulo (parceiro_id);

ALTER TABLE recorrencia_titulo ENABLE ROW LEVEL SECURITY;
ALTER TABLE recorrencia_titulo FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_recorrencia_titulo ON recorrencia_titulo
  USING (empresa_id = app_empresa_id()) WITH CHECK (empresa_id = app_empresa_id());

ALTER TABLE titulo_financeiro ADD COLUMN recorrencia_id uuid;
ALTER TABLE titulo_financeiro ADD CONSTRAINT fk_titulo_financeiro_recorrencia
  FOREIGN KEY (recorrencia_id, empresa_id) REFERENCES recorrencia_titulo (id, empresa_id) ON DELETE SET NULL (recorrencia_id);
CREATE UNIQUE INDEX uq_titulo_financeiro_recorrencia_vencimento
  ON titulo_financeiro (recorrencia_id, data_vencimento) WHERE recorrencia_id IS NOT NULL;

-- O job que renova o horizonte das recorrências sem fim roda sem empresa ativa (RLS forçada): esta função
-- só lista (id, empresa) das recorrências a renovar; a geração em si roda dentro do contexto de cada empresa.
CREATE FUNCTION recorrencias_para_renovar() RETURNS TABLE (id uuid, empresa_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
SET row_security = off
AS $$
  SELECT r.id, r.empresa_id FROM public.recorrencia_titulo r WHERE r.ativa AND r.termino = 'sem_fim'
$$;
REVOKE ALL ON FUNCTION recorrencias_para_renovar() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION recorrencias_para_renovar() TO hub_runtime;
