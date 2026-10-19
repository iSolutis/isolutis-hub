## Why

Hoje os campos de valor em reais (valor de título, desconto, multa, juros, preço, saldo inicial, valor do projeto etc.) são `input` de texto comuns com `inputmode="decimal"`: aceitam qualquer caractere digitado e não agrupam milhar nem fixam duas casas decimais enquanto o usuário digita. O resultado só fica claro (ex.: `1.500,00`) depois de salvo e reaberto, o que facilita erros de digitação (esquecer a vírgula, digitar "150000" pensando em R$ 1.500,00 e gravar R$ 150.000,00) e é inconsistente com a máscara que o CPF/CNPJ já recebe (ver `mascara-documento`). Seguindo o mesmo padrão já estabelecido para documentos, todo campo monetário deve ganhar uma máscara de apresentação enquanto o usuário digita.

## What Changes

- Novo módulo de máscara monetária (`ui/moeda.ts`) com a função de máscara "estilo caixa eletrônico": os dígitos digitados são sempre os centavos mais recentes, o campo mostra separador de milhar e vírgula decimal (`150000` → `1.500,00`), análogo ao `ui/documento.ts` existente para CPF/CNPJ.
- Extração do utilitário genérico que reaplica a máscara preservando a posição do cursor (hoje vive em `ui/documento.ts`) para um local compartilhado, reaproveitado tanto pela máscara de documento quanto pela nova máscara monetária.
- Novo helper `inpMoeda` em `ui/campos.ts` para marcar e renderizar um campo monetário (substitui o uso de `inp(...)` com `inputmode="decimal"` nos campos que representam dinheiro).
- Ligação automática da máscara monetária em `ui/gaveta.ts` (ponto único por onde todo formulário em gaveta passa), para que nenhuma tela precise ligar a máscara manualmente — mesmo em campos já existentes.
- Ligação explícita da máscara nos pontos que criam campos monetários fora do ciclo de montagem da gaveta: a linha de item do orçamento (`orcamentos.ts`, recriada a cada edição) e as linhas de produto do onboarding (`ui/onboarding.ts`, fora do fluxo de gaveta).
- Aplicação do novo helper/máscara em todos os campos monetários existentes: valor e mensalidade de negócio, desconto e valor unitário de item do orçamento, preço de produto, saldo inicial de conta bancária, valor/desconto/multa/juros/quitação de título, valor de recorrência, valor único/mensal do lançamento em lote de faturamento, preço de produto no onboarding.
- Os campos de quantidade (`qtd` do orçamento) e de percentual (participação societária) **NÃO** recebem a máscara monetária — continuam como estão hoje.
- O valor enviado ao servidor continua sendo o número (via `numero()`, que já interpreta separador de milhar e vírgula decimal); nenhuma mudança de contrato com o backend.

## Capabilities

### New Capabilities
- `mascara-monetaria`: máscara de apresentação para todo campo de entrada de valor em reais, aplicada durante a digitação, sem alterar o valor numérico enviado ao salvar.

### Modified Capabilities
_Nenhuma — não há spec existente de comportamento de campo monetário sendo alterada; este é um comportamento novo._

## Impact

- **Frontend (`frontend/src`)**:
  - Novo: `ui/moeda.ts` (máscara monetária, valor inicial formatado).
  - Possível novo módulo compartilhado para `reaplicarMascara` (ou extração dentro de `ui/documento.ts` mantendo compatibilidade), usado por `ui/moeda.ts` e `ui/documento.ts`.
  - Alterado: `ui/campos.ts` (`inpMoeda`), `ui/gaveta.ts` (ligação automática).
  - Alterado: `features/negocios.ts`, `features/orcamentos.ts`, `features/produtos.ts`, `features/faturamento.ts`, `features/financeiro/contas-bancarias.ts`, `features/financeiro/recorrencias.ts`, `features/financeiro/titulos.ts`, `ui/onboarding.ts`.
- **Backend**: nenhum impacto — a máscara é só de apresentação; o valor segue chegando como número.
- **Testes**: novos testes unitários para `mascararMoeda`/formatação inicial, nos moldes de `ui/documento.test.ts`.
