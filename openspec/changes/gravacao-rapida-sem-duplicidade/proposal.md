## Why

Salvar demora (um a vários segundos) e o usuário, sem retorno, clica de novo: o mesmo cadastro é criado duas vezes. A demora vem de três causas medidas: a função da Vercel roda em Washington enquanto o banco Neon está em São Paulo (cada ida e volta ao banco custa ~120 ms e uma gravação faz várias), o `POST` faz ~10 instruções SQL em sequência, e a gaveta só fecha depois de recarregar as listas. A duplicidade tem duas fontes no código: nem todo botão de salvar se trava durante a gravação e, nas telas que travam, `gravar()` devolve `null` em erro sem destravar (o botão de clientes fica em "Salvando…" para sempre).

## What Changes

- **Trava de envio único no front**: a gravação em andamento de um formulário ignora novos cliques e Enter; o botão mostra "Salvando…" e **sempre** volta ao normal se a gravação falhar (corrige o botão preso em clientes). Centralizada em `gravar()`, em vez de repetida por tela.
- **Chave de idempotência** (`Idempotency-Key`) nos `POST` de criação: o front gera uma chave por tentativa de salvar do formulário; o servidor devolve a mesma resposta para a mesma chave em vez de criar outro registro (cobre duplo clique que escapou, reenvio automático do navegador e toque duplo no celular).
- **Resposta percebida mais rápida**: a gaveta fecha e o aviso "salvo" aparece assim que o servidor confirma, e as listas recarregam em seguida (sem bloquear o fechamento).
- **Menos idas ao banco** nos `POST`/`PUT` mais usados, medindo antes e depois com `medir.py`-style de contagem de instruções.
- **Região da função (operacional, feita pelo usuário)**: mover a Function Region da Vercel para São Paulo (`gru1`) e reimplantar; documentado em `docs/`.
- Inclui o caso do "+ Novo cliente…" dentro de negócio/orçamento/projeto: o cliente criado junto com o registro não pode duplicar se a segunda etapa falhar e o usuário tentar de novo.

## Capabilities

### New Capabilities
- `gravacao-sem-duplicidade`: uma tentativa de salvar produz no máximo um registro, o usuário recebe retorno imediato do estado da gravação e o botão nunca fica preso.

### Modified Capabilities
<!-- nenhuma: não há spec anterior sobre gravação -->

## Impact

- Frontend: `ui/gravacao.ts` (`gravar`, `excluir`), `ui/salvar-helper.ts`, `api/http.ts` (cabeçalho), telas com botão de salvar próprio (`clientes`, `tarefas`, `faturamento`, `produtos`, `orcamentos`, `financeiro/*`, `parceiros`), `ui/formularios.ts` (`resolverCliente`), testes unitários e e2e.
- Backend: middleware/dependência de idempotência nos `POST` de criação, nova tabela `idempotencia` (migração 0016, RLS de tenant, limpeza por validade), ajustes de serviços para reduzir instruções.
- Infra: Function Region da Vercel (configuração manual); sem mudança de banco além da tabela nova.
- Sem mudança de contrato para clientes que não enviam a chave (continua funcionando como hoje).
