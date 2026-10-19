## Context

- `gravar()` (`ui/gravacao.ts`) executa a operação via `tentar()`, que trata o erro e devolve `null`; telas como `clientes.ts` só destravam o botão num `catch` que nunca dispara. Outras telas (`tarefas`, `faturamento`, `produtos`, `orcamentos`) repetem o mesmo código de "Salvando…". Há ainda `salvar-helper.ts`, com versão própria.
- O `POST` de criação executa em torno de 10 instruções SQL (contexto de sessão e escopo reaplicados por transação, leitura de permissão, insert, leituras de retorno); cada uma é uma ida e volta ao banco.
- Hoje Vercel (Washington) → Neon (São Paulo): ~120 ms por instrução, ou seja, >1 s só em rede por gravação, fora a partida a frio.
- `gravar()` aguarda `recarregar()` antes de fechar a gaveta e confirmar.

## Goals / Non-Goals

**Goals:**
- Uma tentativa de salvar cria no máximo um registro, mesmo com cliques/toques repetidos, reenvio do navegador ou rede lenta.
- O botão nunca fica preso, e o usuário vê retorno imediato ao clicar.
- Reduzir o tempo de gravação medido (instruções e latência).

**Non-Goals:**
- Fila offline ou reenvio automático em segundo plano.
- Idempotência de `PUT`/`DELETE` (já são idempotentes por versão/id).
- Mudar o banco de região ou de provedor.

## Decisions

### 1. Trava única em `gravar()`, não por tela
`gravar()` recebe o botão (ou o encontra pelo formulário em `data-salvar`), mantém um conjunto de gravações em andamento por formulário e ignora chamadas enquanto houver uma. Usa `try/finally` para restaurar o botão, de modo que erro tratado (`null`) também destrava. As telas passam a só chamar `gravar()`; o código repetido de spinner sai delas. `salvar-helper.ts` passa a delegar a `gravar()`.
- *Alternativa descartada:* desabilitar o botão em cada tela — é o que gerou o botão preso e a divergência entre telas.

### 2. Chave de idempotência gerada no front, honrada no servidor
- Front: cada clique em Salvar abre uma *tentativa* (`comTrava`) com uma chave-base (`crypto.randomUUID()`) guardada no botão; cada `POST` feito dentro da tentativa envia `Idempotency-Key: <base>:<ordem>:<hash do corpo>`. A chave-base só é descartada depois de sucesso: reenviar após um erro repete as mesmas chaves (e, por isso, `resolverCliente` reaproveita o cliente já criado), e corpo editado entre as tentativas gera outra chave.
- Servidor: tabela `idempotencia(empresa_id, usuario_id, chave, rota, corpo_hash, estado, codigo_http, resposta)` com chave primária `(empresa_id, usuario_id, chave)` e RLS. Dependência `idempotencia` nos routers de dados (depois da checagem de permissão): `INSERT … ON CONFLICT DO NOTHING` e **commit imediato** da reivindicação (estado `em_andamento`). Os serviços já fazem commit próprio, então não há como gravar a resposta na mesma transação do registro; o desenho é o de reivindicar antes, concluir depois.
  - Chave já `concluida` → devolve a resposta guardada (cabeçalho `Idempotent-Replay: true`).
  - Chave `em_andamento` → espera até 15 s; passado o prazo, 409 `gravacao_em_andamento`. Tentativa parada há mais de 60 s é considerada abandonada e pode ser assumida.
  - Rota ou corpo diferentes com a mesma chave → 422 `chave_reutilizada`.
  - Middleware ASGI `ProtegerPosts` (o mais interno, na tarefa da rota) guarda a resposta de sucesso antes do último trecho da resposta, ou apaga a reivindicação quando a requisição falha, para o reenvio gravar.
- Sem a chave o comportamento é o atual. A limpeza (>24 h) é oportunista, no próprio caminho da reivindicação, porque não há processo fixo na Vercel.
- *Alternativa descartada:* constraint de unicidade por dados (ex.: nome do cliente) — bloqueia cadastros legítimos iguais e não cobre todas as entidades.

### 3. Fechar antes de recarregar
Depois que o servidor confirma, `gravar()` atualiza o registro gravado no estado local quando a resposta já traz a linha, fecha a gaveta, mostra o aviso e dispara `recarregar()` sem `await` bloqueante para o fechamento (erros de recarga viram aviso discreto). O usuário percebe a gravação como concluída ao fim de uma ida e volta, não de três.
- *Risco:* lista exibida alguns instantes desatualizada → aceitável; a recarga termina em seguida e o tempo real também avisa.

### 4. Menos instruções por requisição
Medir com a contagem de instruções (como a medição de latência feita na análise) e remover o que for redundante: leituras repetidas de papel/escopo na mesma transação, `SELECT` de retorno após `INSERT` quando `RETURNING` basta, `commit` intermediário que reaplica o contexto da sessão. Resultado: usuário, empresa e escopo passam a ser definidos numa só chamada (`app_iniciar_contexto`), na requisição e a cada nova transação: `POST /negocios` de 15 para 12 instruções, `POST /clientes` de 17 para 14. A meta inicial (metade) não foi atingida porque o restante (vínculo com o cliente, dono padrão, leitura do registro gravado) é o que sustenta o escopo de acesso; o contexto de segurança continua sendo definido em toda transação.

### 5. Cliente criado junto com outro registro
`resolverCliente()` cria o cliente e depois o registro principal. Para não duplicar o cliente se a segunda etapa falhar, o id do cliente criado fica guardado no formulário e o reenvio reutiliza esse id em vez de criar outro. O `POST` do cliente também leva a chave.

### 6. Região da função na Vercel
Configuração do projeto (Settings → Functions → Function Region = São Paulo/`gru1`) e novo deploy. Não há código; entra em `docs/DEPLOY.md` com o motivo e como conferir (latência dos `/api/v1/health` antes e depois).

## Risks / Trade-offs

- [Chave presa a uma resposta antiga] → a chave só vale 24 h e é por usuário/empresa; o front troca a chave após sucesso.
- [Insert extra de idempotência soma uma instrução nos `POST`] → compensado pelo item 4; medir.
- [Trava impede um reenvio legítimo] → destrava no `finally`; erro de validação (antes de chamar `gravar`) nunca trava.
- [Recarga em segundo plano com erro silencioso] → aviso discreto e botão de atualizar já existente.
- [Região `gru1` indisponível no plano] → alternativa: manter Washington e aceitar só as melhorias de código; reavaliar.

## Migration Plan

1. Migração 0016 (tabela `idempotencia` + RLS), compatível com o app antigo (tabela só é lida pelo código novo).
2. Deploy do backend, depois do frontend (o backend ignora a chave ausente).
3. Usuário muda a Function Region para `gru1` e reimplanta.
4. Reversão: remover o cabeçalho no front e, se necessário, `0016_down` (apaga a tabela); as demais mudanças são só de código.

## Open Questions

- Quais telas além de clientes mantêm um botão de salvar próprio com spinner (levantamento na tarefa 1.1).
