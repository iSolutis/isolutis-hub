-- Reverte a 0015 recriando as tabelas VAZIAS (os dados descartados não voltam).
CREATE TABLE categorias_despesa (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  empresa_id      uuid        NOT NULL DEFAULT app_empresa_id(),
  nome            citext      NOT NULL,
  ordem           integer     NOT NULL DEFAULT 0,
  ativo           boolean     NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  criado_por      uuid,
  atualizado_por  uuid,
  versao          integer     NOT NULL DEFAULT 1,
  CONSTRAINT pk_categorias_despesa PRIMARY KEY (id),
  CONSTRAINT uq_categorias_despesa_id_empresa UNIQUE (id, empresa_id),
  CONSTRAINT uq_categorias_despesa_empresa_nome UNIQUE (empresa_id, nome),
  CONSTRAINT ck_categorias_despesa_nome CHECK (btrim(nome) <> ''),
  CONSTRAINT fk_categorias_despesa_empresa FOREIGN KEY (empresa_id) REFERENCES empresa (id) ON DELETE RESTRICT
);

CREATE TABLE investidores (
  id              uuid        NOT NULL DEFAULT gen_random_uuid(),
  empresa_id      uuid        NOT NULL DEFAULT app_empresa_id(),
  nome            citext      NOT NULL,
  usuario_id      uuid,
  ativo           boolean     NOT NULL DEFAULT true,
  criado_em       timestamptz NOT NULL DEFAULT now(),
  atualizado_em   timestamptz NOT NULL DEFAULT now(),
  criado_por      uuid,
  atualizado_por  uuid,
  versao          integer     NOT NULL DEFAULT 1,
  CONSTRAINT pk_investidores PRIMARY KEY (id),
  CONSTRAINT uq_investidores_id_empresa UNIQUE (id, empresa_id),
  CONSTRAINT uq_investidores_empresa_nome UNIQUE (empresa_id, nome),
  CONSTRAINT ck_investidores_nome CHECK (btrim(nome) <> ''),
  CONSTRAINT fk_investidores_empresa FOREIGN KEY (empresa_id) REFERENCES empresa (id) ON DELETE RESTRICT,
  CONSTRAINT fk_investidores_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios (id) ON DELETE SET NULL
);
CREATE UNIQUE INDEX uq_investidores_empresa_usuario ON investidores (empresa_id, usuario_id) WHERE usuario_id IS NOT NULL;

CREATE TABLE despesas (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  empresa_id      uuid          NOT NULL DEFAULT app_empresa_id(),
  data            date          NOT NULL,
  descricao       text          NOT NULL,
  valor           numeric(14,2) NOT NULL,
  categoria_id    uuid          NOT NULL,
  status          text          NOT NULL DEFAULT 'a_pagar',
  pago_em         date,
  fornecedor      text,
  obs             text,
  grupo_id        uuid,
  parcela         integer,
  total_parcelas  integer,
  criado_em       timestamptz   NOT NULL DEFAULT now(),
  atualizado_em   timestamptz   NOT NULL DEFAULT now(),
  criado_por      uuid,
  atualizado_por  uuid,
  versao          integer       NOT NULL DEFAULT 1,
  CONSTRAINT pk_despesas PRIMARY KEY (id),
  CONSTRAINT uq_despesas_grupo_parcela UNIQUE (grupo_id, parcela),
  CONSTRAINT ck_despesas_descricao CHECK (btrim(descricao) <> ''),
  CONSTRAINT ck_despesas_valor CHECK (valor >= 0),
  CONSTRAINT ck_despesas_status CHECK (status IN ('pago', 'a_pagar')),
  CONSTRAINT ck_despesas_pago CHECK ((status = 'pago') = (pago_em IS NOT NULL)),
  CONSTRAINT ck_despesas_parcelas CHECK (
    (grupo_id IS NULL AND parcela IS NULL AND total_parcelas IS NULL)
    OR (grupo_id IS NOT NULL AND parcela IS NOT NULL AND total_parcelas IS NOT NULL
        AND parcela >= 1 AND parcela <= total_parcelas)),
  CONSTRAINT fk_despesas_empresa FOREIGN KEY (empresa_id) REFERENCES empresa (id) ON DELETE RESTRICT,
  CONSTRAINT fk_despesas_categoria FOREIGN KEY (categoria_id, empresa_id) REFERENCES categorias_despesa (id, empresa_id) ON DELETE RESTRICT
);
CREATE INDEX ix_despesas_data ON despesas (data);
CREATE INDEX ix_despesas_a_pagar ON despesas (data) WHERE status = 'a_pagar';

CREATE TABLE investimentos (
  id              uuid          NOT NULL DEFAULT gen_random_uuid(),
  empresa_id      uuid          NOT NULL DEFAULT app_empresa_id(),
  data            date          NOT NULL,
  descricao       text          NOT NULL,
  valor           numeric(14,2) NOT NULL,
  investidor_id   uuid          NOT NULL,
  forma           text          NOT NULL,
  obs             text,
  criado_em       timestamptz   NOT NULL DEFAULT now(),
  atualizado_em   timestamptz   NOT NULL DEFAULT now(),
  criado_por      uuid,
  atualizado_por  uuid,
  versao          integer       NOT NULL DEFAULT 1,
  CONSTRAINT pk_investimentos PRIMARY KEY (id),
  CONSTRAINT ck_investimentos_descricao CHECK (btrim(descricao) <> ''),
  CONSTRAINT ck_investimentos_valor CHECK (valor >= 0),
  CONSTRAINT ck_investimentos_forma CHECK (forma IN ('Dinheiro (aporte)', 'Equipamento', 'Pagamento de despesa da empresa', 'Outro')),
  CONSTRAINT fk_investimentos_empresa FOREIGN KEY (empresa_id) REFERENCES empresa (id) ON DELETE RESTRICT,
  CONSTRAINT fk_investimentos_investidor FOREIGN KEY (investidor_id, empresa_id) REFERENCES investidores (id, empresa_id) ON DELETE RESTRICT
);
CREATE INDEX ix_investimentos_data ON investimentos (data);
CREATE INDEX ix_investimentos_investidor_data ON investimentos (investidor_id, data);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categorias_despesa', 'investidores', 'despesas', 'investimentos'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY %I ON %I USING (empresa_id = app_empresa_id()) WITH CHECK (empresa_id = app_empresa_id())', 'tenant_' || t, t);
  END LOOP;
END
$$;
