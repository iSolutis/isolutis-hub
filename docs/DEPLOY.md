# Deploy e desempenho de gravação

## Região da função na Vercel

A API roda como função da Vercel e o banco está no Neon. **As duas precisam estar na mesma região**: com a função em
Washington (`iad1`) e o banco em São Paulo, cada instrução SQL custa ~120 ms de ida e volta e uma gravação faz uma
dúzia delas, então salvar passa de um segundo só em rede.

1. Neon: Project → Settings → região do projeto (hoje São Paulo, `aws-sa-east-1`).
2. Vercel: Project → Settings → Functions → **Function Region** = São Paulo (`gru1`).
3. Faça um novo deploy (a mudança só vale para deploys novos).
4. Conferir: abra a aba Network do navegador e compare o tempo de um `POST` de criação antes e depois.

## Gravações: instruções por requisição

`backend/tests/test_instrucoes_gravacao.py` conta as instruções SQL de um `POST` e serve de linha de base.

| Requisição | Antes | Depois |
| --- | --- | --- |
| `POST /negocios` | 15 | 12 |
| `POST /clientes` | 17 | 14 |

O ganho veio de reunir usuário, empresa e escopo numa só chamada (`app_iniciar_contexto`, migração 0014), tanto no
início da requisição quanto a cada nova transação. O restante (verificação de vínculo com o cliente, dono padrão,
leitura do registro gravado) fica como está para não enfraquecer o escopo de acesso.

## Idempotência de gravações (migração 0014)

- O front envia `Idempotency-Key` nos `POST` de criação; a tabela `idempotencia` guarda a resposta por 24 h
  (limpeza oportunista a cada ~100 gravações com chave, pois não há processo fixo em ambiente sem servidor).
- Ordem de deploy: **migração 0014 → backend → frontend**. O backend ignora a chave quando ela não vem, então um
  frontend antigo continua funcionando.
- Aplicar no Neon: `alembic upgrade head` com a URL do dono do banco (a migração cria a tabela, concede ao
  `hub_runtime` e cria `app_iniciar_contexto`). Reversão: `alembic downgrade 0013`.
