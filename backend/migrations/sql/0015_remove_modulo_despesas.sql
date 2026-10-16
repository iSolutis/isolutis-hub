-- 0015 · fim do módulo Despesas/Investimentos.
--
-- Despesas passam a ser títulos a pagar; investimentos, títulos a receber de um sócio (conta de aporte).
-- Os dados antigos eram fictícios e são descartados, sem migração (decisão registrada na change
-- parceiros-por-papel-e-fim-de-despesas). Ordem: dependentes antes das referenciadas.
DROP TABLE IF EXISTS investimentos;
DROP TABLE IF EXISTS despesas;
DROP TABLE IF EXISTS investidores;
DROP TABLE IF EXISTS categorias_despesa;
