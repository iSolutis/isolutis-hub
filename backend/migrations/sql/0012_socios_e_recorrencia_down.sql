-- Reverte a 0012. Os títulos gerados por recorrência continuam existindo, só perdem o vínculo.
DROP FUNCTION IF EXISTS recorrencias_para_renovar();
DROP INDEX IF EXISTS uq_titulo_financeiro_recorrencia_vencimento;
ALTER TABLE titulo_financeiro DROP CONSTRAINT IF EXISTS fk_titulo_financeiro_recorrencia;
ALTER TABLE titulo_financeiro DROP COLUMN IF EXISTS recorrencia_id;
DROP TABLE IF EXISTS recorrencia_titulo;
ALTER TABLE plano_contas DROP CONSTRAINT IF EXISTS ck_plano_contas_aporte;
ALTER TABLE plano_contas DROP COLUMN IF EXISTS aporte_socio;
DROP TABLE IF EXISTS parceiro_socio;
DELETE FROM parceiro_papel WHERE papel = 'socio';
DELETE FROM papel_parceiro WHERE codigo = 'socio';
