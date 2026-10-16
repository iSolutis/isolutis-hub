## 1. Trava e botão no front

- [x] 1.1 Levantar todas as telas com botão de salvar próprio (`clientes`, `tarefas`, `faturamento`, `produtos`, `orcamentos`, `financeiro/*`, `parceiros`, `salvar-helper`) e registrar a lista no `design.md`; verificar com `grep` de `Salvando…`
- [x] 1.2 `gravar()` com trava por formulário e restauração do botão em `finally` (inclusive quando `tentar` devolve `null`); verificar com teste unitário: dois cliques → uma operação; erro → botão restaurado
- [x] 1.3 Migrar as telas do levantamento para `gravar()` removendo o spinner repetido e `salvar-helper.ts` delegando; verificar com teste de que o botão de clientes não fica preso após erro — clientes, produtos, negócios, faturamento, tarefas e orçamentos usam `comTrava`; as demais telas (`gravar` solto) travam sozinhas pelo `gravar()`; `salvar-helper.ts` não é usado por nenhuma tela e ficou como está; e2e cobre o botão de contas bancárias (duplo clique e erro)
- [x] 1.4 Enter no formulário aciona o mesmo caminho travado; verificar com teste de interação — as gavetas e formulários já impedem o envio por Enter (`submit` com `preventDefault`), então só o clique grava; nada a travar além do botão

## 2. Idempotência

- [x] 2.1 Migração 0016 com `idempotencia` (chave única empresa+usuário+chave, RLS de tenant) e down; verificar com `upgrade`/`downgrade` e teste SQL de isolamento entre empresas
- [x] 2.2 Dependência no backend para `POST` de criação: insert na mesma transação, reproduz resposta guardada, 422 para chave reutilizada em outra rota/corpo; verificar com teste de API: duas requisições com a mesma chave (sequenciais e concorrentes) criam um registro
- [x] 2.3 Limpeza de chaves com mais de 24 h (oportunista no caminho da reivindicação, sem depender do agendador); verificar lendo o código e a tabela
- [x] 2.4 `api/http.ts` envia `Idempotency-Key` nos `POST` de criação; chave por formulário, renovada só após sucesso; verificar com teste unitário e e2e (duplo clique grava uma vez)
- [x] 2.5 `resolverCliente()` reaproveita o cliente criado ao reenviar; verificar com teste: falha do registro principal e reenvio não duplica cliente

## 3. Velocidade

- [x] 3.1 Medir instruções e tempo de `POST`/`PUT` principais (negócios, clientes, títulos, tarefas) como linha de base; registrar em `docs/`
- [x] 3.2 Reduzir instruções redundantes (leituras repetidas de escopo/papel, `SELECT` após `INSERT`, `commit` intermediário) mantendo o contexto de RLS por transação; verificar com a mesma medição (meta ajustada: reduzir o que for redundante sem tocar no escopo; 15→12 no `POST /negocios`) e suíte de testes SQL de escopo verde
- [x] 3.3 `gravar()` fecha a gaveta e confirma antes de recarregar; erro de recarga vira aviso; verificar com teste unitário e e2e

## 4. Entrega

- [x] 4.1 Documentar em `docs/DEPLOY.md` a Function Region `gru1` e como medir antes/depois; verificar lendo o texto
- [ ] 4.2 Rodar testes do front e do back, tipos e e2e, e revisar o diff; verificar com tudo verde
- [ ] 4.3 Conferência do usuário em produção: mudar a região na Vercel, reimplantar, medir o tempo de salvar e testar duplo clique/toque duplo no celular
