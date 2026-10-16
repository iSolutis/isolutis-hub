## 1. Trava e botão no front

- [ ] 1.1 Levantar todas as telas com botão de salvar próprio (`clientes`, `tarefas`, `faturamento`, `produtos`, `orcamentos`, `financeiro/*`, `parceiros`, `salvar-helper`) e registrar a lista no `design.md`; verificar com `grep` de `Salvando…`
- [ ] 1.2 `gravar()` com trava por formulário e restauração do botão em `finally` (inclusive quando `tentar` devolve `null`); verificar com teste unitário: dois cliques → uma operação; erro → botão restaurado
- [ ] 1.3 Migrar as telas do levantamento para `gravar()` removendo o spinner repetido e `salvar-helper.ts` delegando; verificar com teste de que o botão de clientes não fica preso após erro
- [ ] 1.4 Enter no formulário aciona o mesmo caminho travado; verificar com teste de interação

## 2. Idempotência

- [ ] 2.1 Migração 0014 com `idempotencia` (chave única empresa+usuário+chave, RLS de tenant) e down; verificar com `upgrade`/`downgrade` e teste SQL de isolamento entre empresas
- [ ] 2.2 Dependência no backend para `POST` de criação: insert na mesma transação, reproduz resposta guardada, 422 para chave reutilizada em outra rota/corpo; verificar com teste de API: duas requisições com a mesma chave (sequenciais e concorrentes) criam um registro
- [ ] 2.3 Limpeza de chaves com mais de 24 h no agendador; verificar com teste
- [ ] 2.4 `api/http.ts` envia `Idempotency-Key` nos `POST` de criação; chave por formulário, renovada só após sucesso; verificar com teste unitário e e2e (duplo clique grava uma vez)
- [ ] 2.5 `resolverCliente()` reaproveita o cliente criado ao reenviar; verificar com teste: falha do registro principal e reenvio não duplica cliente

## 3. Velocidade

- [ ] 3.1 Medir instruções e tempo de `POST`/`PUT` principais (negócios, clientes, títulos, tarefas) como linha de base; registrar em `docs/`
- [ ] 3.2 Reduzir instruções redundantes (leituras repetidas de escopo/papel, `SELECT` após `INSERT`, `commit` intermediário) mantendo o contexto de RLS por transação; verificar com a mesma medição (meta: metade das instruções no `POST /negocios`) e suíte de testes SQL de escopo verde
- [ ] 3.3 `gravar()` fecha a gaveta e confirma antes de recarregar; erro de recarga vira aviso; verificar com teste unitário e e2e

## 4. Entrega

- [ ] 4.1 Documentar em `docs/DEPLOY.md` a Function Region `gru1` e como medir antes/depois; verificar lendo o texto
- [ ] 4.2 Rodar testes do front e do back, tipos e e2e, e revisar o diff; verificar com tudo verde
- [ ] 4.3 Conferência do usuário em produção: mudar a região na Vercel, reimplantar, medir o tempo de salvar e testar duplo clique/toque duplo no celular
