## Context

- O hub existe: `parceiro_negocio` + `parceiro_papel` (N:N) + `papel_parceiro` (domínio editável por `INSERT`). Papéis atuais: cliente, fornecedor, funcionário.
- `titulo_financeiro` já aponta para `parceiro_id`, `plano_conta_id` e `conta_bancaria_id`, com `tipo_conta` (`P` pagar / `R` receber), `status` (`A` aberto, `Q` quitado, `C` cancelado) e pagamento. Não existe recorrência. A regra RN04 exige conta de despesa em título a pagar e conta de receita em título a receber.
- "Clientes" (permissão `comercial`) e "Fornecedores"/hub (permissão `financeiro`) são duas telas sobre o mesmo cadastro; `parceiros/campos.ts` já é compartilhado.
- `despesas`, `investimentos`, `investidores` e `categorias_despesa` são o módulo legado; `relatorios.py` e o painel somam `Despesa`.
- Decisões do usuário: despesas e investimentos **são títulos**; sócio tem participação no cadastro; aporte entra como recebimento no título; despesas e receitas recorrentes, com todas as frequências e formas de término, e várias recorrências; os dados atuais são fictícios e podem ser descartados; Funcionários e Sócios só para `admin`.

## Goals / Non-Goals

**Goals:**
- Um cadastro único de parceiros acessível por papel (Cadastros › Clientes/Fornecedores/Funcionários/Sócios), com papéis múltiplos.
- Sócio como papel do hub, com participação percentual.
- Aporte de sócio como título a receber.
- Cadastro de despesas e receitas recorrentes.
- Fim do módulo Despesas, com relatórios e painel lendo títulos.

**Non-Goals:**
- Migrar dados legados (são fictícios).
- Distribuição de lucros, apuração de quotas e histórico de alterações societárias (só o percentual atual).
- Folha de pagamento e login de funcionário.
- Reajuste automático por índice em recorrências.
- Alterar Equipe (usuários do sistema).

## Decisions

1. **Papel `socio` por `INSERT` em `papel_parceiro`** (sem mudar schema). Alternativa: tabela própria de sócios — descartada, duplica o hub.
2. **Participação do sócio em tabela 1:1 `parceiro_socio` (`parceiro_id`, `participacao_percentual numeric(5,2)`)**, não em coluna de `parceiro_negocio`, para que só sócios carreguem o dado. Regras: 0 < percentual ≤ 100; a soma dos sócios da empresa não pode passar de 100 (validada no serviço, com aviso quando a soma é menor que 100). O campo aparece no formulário quando o papel Sócio está marcado e é apagado quando o papel é removido.
3. **Menu "Cadastros" com quatro itens que apontam para a mesma tela com filtro de papel**, cada um com rota própria e ação "Novo …" no "+ Novo"/paleta. Alternativa: uma única tela "Parceiros" com abas — mais simples, mas perde ações rápidas e URL por papel.
4. **Formulário**: abre com o papel da tela pré-marcado; os demais continuam selecionáveis. Salvar exige ao menos um papel (regra do backend já existente).
5. **Despesa = título a pagar** (`tipo_conta = P`) com fornecedor e conta de despesa do plano de contas. O módulo antigo e a sua tabela de categorias são removidos; o plano de contas passa a ser a única classificação.
6. **Aporte de sócio = título a receber** (`tipo_conta = R`) cujo `parceiro_id` é um parceiro com o papel `socio`, numa conta do plano de contas marcada com `plano_contas.aporte_socio` (só analítica e de receita, para respeitar a RN04). O plano padrão marca `7.02.001 Aportes de Capital`; o usuário pode marcar outras. A forma do aporte (dinheiro, equipamento…) vai para `anotacao`. O serviço recusa título nessa conta cujo parceiro não seja sócio, e recusa tirar o papel de sócio de quem tem aportes.
7. **Aporte não é receita operacional**: o DRE e os relatórios já calculam receita a partir do faturamento (`lancamentos_receita`), então aportes nunca entram nela; o fluxo de caixa dos títulos soma os aportes ao saldo mas os mostra em colunas próprias (`aportes_*`, `total_aportes`), fora de `entradas_*`. No DRE, os custos pagos excluem as raízes `7` e `8` do plano padrão (entradas e saídas não operacionais, como retiradas de sócios).
8. **Recorrência por modelo + títulos materializados**: nova tabela `recorrencia_titulo` guarda o modelo (tipo P/R, parceiro, plano de contas, conta bancária, valor, `frequencia`, `data_inicio`, término e `gerado_ate`). Os títulos são **gerados** como linhas reais em `titulo_financeiro` com `recorrencia_id`, únicos por (`recorrencia_id`, vencimento). Término por data ou quantidade gera todas as ocorrências na gravação (teto de 600); `sem_fim` gera até um horizonte de 12 meses e é renovada por um job diário (02:30) em `scheduler.py`. `gerado_ate` guarda o último vencimento criado: a renovação só cria os seguintes, então um título apagado à mão não reaparece. Alternativa: calcular ocorrências em memória, sem gravar — descartada, quebra fluxo de caixa, quitação e relatórios, que leem títulos.
9. **Frequências**: semanal (7 dias), quinzenal (15 dias), mensal, bimestral, trimestral, semestral e anual (em meses). O vencimento de cada ocorrência é calculado a partir do início (nunca da anterior), então o dia 31 cai no último dia dos meses curtos sem arrastar os seguintes; o "dia do vencimento" é o dia de `data_inicio`. **Término**: por data final, por quantidade de ocorrências ou sem fim (apenas um dos três).
10. **Várias recorrências**: não há limite; cada uma é independente, com seu modelo, e uma recorrência pode ser pausada (`ativa = false`) sem apagar os títulos já gerados.
11. **Edição de recorrência**: alterar o modelo afeta só os títulos futuros ainda abertos; títulos quitados ou cancelados nunca são tocados. Tipo, frequência e início são fixos (para mudá-los, encerra-se e cria-se outra). Encerrar remove os títulos futuros abertos e a recorrência não pode mais ser editada; retomar uma pausada não cria o que venceria durante a pausa. Editar um título isolado não altera o modelo.
12. **Relatórios/painel** passam a somar títulos a pagar quitados por `data_pagamento`.
13. **Permissão**: Clientes `comercial` e `financeiro`; Fornecedores `financeiro`; Funcionários e Sócios apenas `admin`. O backend impõe por papel de parceiro (`PAPEIS_DE_PARCEIRO_POR_PAPEL`): listagem, criação, edição, exclusão, tags e `/parceiros/papeis` só enxergam os papéis permitidos; parceiros com um papel oculto aparecem sem ele e o preservam ao serem editados. A participação do sócio só sai para quem vê sócios. A tela Clientes continua sob `comercial`; o `financeiro` alcança clientes pela opção "Mostrar todos os parceiros" das telas de Cadastros. Recorrências seguem a permissão `financeiro`.
13a. **Título a pagar aceita fornecedor, funcionário ou sócio** (não só fornecedor): o plano padrão tem contas de pagamento a funcionários e de retirada de sócios, que ficariam impossíveis de lançar. Título a pagar para quem é só cliente é recusado.
13b. **URLs antigas**: `/despesas`, `/investimentos` e `/fin-parceiros` abrem Títulos Financeiros e Fornecedores, e a barra de endereços é corrigida.
14. **Dados legados descartados**: sem rotina de migração. Uma migration remove `despesas`, `investimentos`, `investidores` e `categorias_despesa`. Ambientes com dados reais não existem hoje; se surgirem antes da implantação, esta decisão precisa ser revista.

## Risks / Trade-offs

- [Remoção irreversível de tabelas] → migration com `down` que recria o esquema vazio e backup antes de aplicar; ação confirmada pelo usuário (dados fictícios).
- [Aporte inflar a receita nos relatórios] → conta de aporte marcada e excluída da receita operacional; teste cobrindo o painel e o relatório anual.
- [Soma de participações diferente de 100] → validar teto de 100 e exibir aviso quando faltar; não bloquear cadastro parcial.
- [Job de recorrência duplicar ou deixar buracos] → geração idempotente por chave (`recorrencia_id`, vencimento), horizonte renovado a cada execução e geração também na gravação do modelo.
- [Recorrência sem fim gerar volume] → o horizonte móvel limita as linhas geradas; o limite fica configurável.
- [Filtro de permissão por papel esconder parceiros usados em negócios] → o filtro vale para as telas de Cadastros; os seletores de cliente seguem o papel `cliente`.
- [Rotas antigas em favoritos/e2e] → redirecionar a URL de despesas para Financeiro › Títulos.

## Migration Plan

1. Migration aditiva: papel `socio`; `parceiro_socio`; `recorrencia_titulo`; `recorrencia_id` no título; conta de aporte no plano de contas.
2. Trocar relatórios/painel para ler títulos e validar.
3. Remover menu/tela/rotas de Despesas; criar o grupo Cadastros e o recurso de recorrência.
4. Migration que remove `despesas`, `investimentos`, `investidores` e `categorias_despesa`. Rollback: o `down` recria as tabelas vazias; os dados fictícios não são restaurados.

## Open Questions

1. Funcionário é só cadastro, sem login, distinto de Equipe? (assumido que sim; confirmar se virar necessidade)
2. O horizonte de geração de recorrências (12 meses) atende, ou o usuário prefere outro período?
3. O `financeiro` vê no módulo de títulos o nome e o valor de títulos de funcionários e sócios (salários, aportes), já que títulos são do módulo financeiro. Só a participação e os papéis ocultos ficam restritos ao admin. Se for preciso esconder também esses títulos, é uma regra nova.
