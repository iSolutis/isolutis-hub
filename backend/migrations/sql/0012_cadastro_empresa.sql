-- 0012 · Cadastro completo da empresa, logomarca e paleta de cores.
--
-- Todas as colunas são anuláveis: empresas existentes continuam válidas e completam o cadastro pela tela
-- "Dados da empresa". `nome` segue como nome de exibição no Hub.
-- A logomarca fica no próprio banco (bytea, até 512 KB; PNG, JPEG ou WebP — SVG fica de fora por poder
-- carregar script). A paleta é um JSON {"primaria": "#rrggbb", "destaque": "#rrggbb"}; nula = paleta padrão.

ALTER TABLE empresa
  ADD COLUMN tipo_inscricao varchar(4),
  ADD COLUMN inscricao varchar(14),
  ADD COLUMN razao_social varchar(150),
  ADD COLUMN nome_fantasia varchar(150),
  ADD COLUMN inscricao_estadual varchar(20),
  ADD COLUMN inscricao_municipal varchar(20),
  ADD COLUMN cnae_codigo varchar(10),
  ADD COLUMN cnae_descricao varchar(200),
  ADD COLUMN regime_tributario varchar(20),
  ADD COLUMN data_abertura date,
  ADD COLUMN email varchar(150),
  ADD COLUMN telefone varchar(20),
  ADD COLUMN site varchar(150),
  ADD COLUMN cep varchar(8),
  ADD COLUMN logradouro varchar(150),
  ADD COLUMN numero varchar(20),
  ADD COLUMN complemento varchar(100),
  ADD COLUMN bairro varchar(100),
  ADD COLUMN municipio_id uuid REFERENCES municipio (id),
  ADD COLUMN logo bytea,
  ADD COLUMN logo_tipo varchar(20),
  ADD COLUMN logo_atualizada_em timestamptz,
  ADD COLUMN paleta jsonb;

ALTER TABLE empresa ADD CONSTRAINT ck_empresa_tipo_inscricao CHECK (tipo_inscricao IN ('CNPJ', 'CPF'));
ALTER TABLE empresa ADD CONSTRAINT ck_empresa_inscricao CHECK (
  inscricao IS NULL
  OR (tipo_inscricao = 'CNPJ' AND inscricao ~ '^[0-9]{14}$')
  OR (tipo_inscricao = 'CPF' AND inscricao ~ '^[0-9]{11}$')
);
ALTER TABLE empresa ADD CONSTRAINT ck_empresa_regime_tributario
  CHECK (regime_tributario IN ('mei', 'simples_nacional', 'lucro_presumido', 'lucro_real'));
ALTER TABLE empresa ADD CONSTRAINT ck_empresa_cep CHECK (cep ~ '^[0-9]{8}$');
ALTER TABLE empresa ADD CONSTRAINT ck_empresa_logo CHECK (
  (logo IS NULL AND logo_tipo IS NULL)
  OR (logo IS NOT NULL AND logo_tipo IN ('image/png', 'image/jpeg', 'image/webp') AND octet_length(logo) <= 524288)
);
ALTER TABLE empresa ADD CONSTRAINT ck_empresa_paleta CHECK (paleta IS NULL OR jsonb_typeof(paleta) = 'object');

CREATE UNIQUE INDEX uq_empresa_inscricao ON empresa (tipo_inscricao, inscricao) WHERE inscricao IS NOT NULL;
