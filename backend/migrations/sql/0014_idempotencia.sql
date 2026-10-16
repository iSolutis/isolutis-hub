-- Idempotência de gravações: um POST repetido com a mesma chave devolve o resultado da primeira tentativa.
-- A chave vale por empresa e por pessoa; a linha guarda a resposta enviada para repeti-la sem criar de novo.

CREATE TABLE idempotencia (
  empresa_id uuid NOT NULL DEFAULT app_empresa_id() REFERENCES empresa (id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL DEFAULT app_usuario_id(),
  chave text NOT NULL,
  rota text NOT NULL,
  corpo_hash text NOT NULL,
  estado text NOT NULL DEFAULT 'em_andamento',
  codigo_http integer,
  resposta text,
  criada_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pk_idempotencia PRIMARY KEY (empresa_id, usuario_id, chave),
  CONSTRAINT ck_idempotencia_chave CHECK (char_length(chave) BETWEEN 1 AND 200),
  CONSTRAINT ck_idempotencia_estado CHECK (estado IN ('em_andamento', 'concluida'))
);
CREATE INDEX ix_idempotencia_criada_em ON idempotencia (criada_em);

ALTER TABLE idempotencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE idempotencia FORCE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON idempotencia TO hub_runtime;
CREATE POLICY tenant_idempotencia ON idempotencia
  USING (empresa_id = app_empresa_id() AND usuario_id = app_usuario_id())
  WITH CHECK (empresa_id = app_empresa_id() AND usuario_id = app_usuario_id());

-- Contexto da requisição numa só ida ao banco (antes eram três: usuário, empresa e escopo). Roda como quem chama:
-- só grava as mesmas variáveis locais à transação que a aplicação já gravava e chama app_definir_escopo().
CREATE FUNCTION app_iniciar_contexto(p_usuario uuid, p_empresa uuid, p_escopo boolean) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF p_usuario IS NOT NULL THEN PERFORM set_config('app.usuario_id', p_usuario::text, true); END IF;
  IF p_empresa IS NOT NULL THEN PERFORM set_config('app.empresa_id', p_empresa::text, true); END IF;
  IF p_escopo AND p_usuario IS NOT NULL AND p_empresa IS NOT NULL THEN PERFORM app_definir_escopo(); END IF;
END
$$;
REVOKE ALL ON FUNCTION app_iniciar_contexto(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_iniciar_contexto(uuid, uuid, boolean) TO hub_runtime;
