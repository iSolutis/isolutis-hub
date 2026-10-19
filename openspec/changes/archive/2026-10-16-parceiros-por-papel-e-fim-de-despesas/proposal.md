## Why

O cadastro de pessoas e empresas está espalhado e com nomes enganosos: "Clientes" fica no topo do menu, o hub completo de parceiros aparece como "Fornecedores" dentro do Financeiro, e sócios existem só como `investidores`, uma tabela à parte. Ao mesmo tempo, "Despesas" (despesas + investimentos) duplica o que o módulo financeiro já faz com títulos: despesa é um título a pagar e investimento é um título a receber do sócio. O usuário quer cadastrar sócios (com a participação na empresa), fornecedores, clientes e funcionários, cada um com seu papel, podendo um mesmo parceiro ter mais de um, e quer cadastrar despesas e receitas recorrentes.

## What Changes

- Novo papel `socio` em `papel_parceiro`. O cadastro do sócio guarda a **participação na empresa** (percentual). A tabela `investidores` deixa de existir.
- Menu: novo grupo **Cadastros** com Clientes, Fornecedores, Funcionários e Sócios. Cada item abre a tela de parceiros já filtrada pelo papel; o formulário pré-seleciona esse papel e permite marcar outros.
- O item **Despesas** sai do menu e o módulo é removido: despesa passa a ser **título a pagar** e investimento passa a ser **título a receber** cujo parceiro é o sócio (o aporte entra como recebimento).
- **Títulos recorrentes**: cadastro de despesas e receitas que se repetem, com qualquer frequência usual e qualquer forma de término, gerando os títulos automaticamente. Pode haver várias recorrências.
- Relatórios e painel que somam `Despesa` passam a ler os títulos, sem contar aportes de sócio como receita operacional.
- **BREAKING**: remove as rotas `/despesas` e `/investimentos`, as telas e as tabelas `despesas`, `investimentos`, `investidores` e `categorias_despesa`. Os dados atuais são fictícios e serão descartados, sem migração.
- Permissões: Funcionários e Sócios só para `admin`; demais cadastros por papel (ver design).

## Capabilities

### New Capabilities
- `cadastros-por-papel`: grupo de menu "Cadastros" e telas de parceiros filtradas por papel, com formulário de papéis múltiplos.
- `socios-como-parceiros`: papel `socio`, participação na empresa no cadastro e aportes como títulos a receber.
- `despesas-no-financeiro`: despesas e investimentos como títulos; fim do módulo Despesas.
- `titulos-recorrentes`: cadastro de despesas e receitas recorrentes que geram títulos.

### Modified Capabilities
- `papeis-permissoes`: regra de acesso aos cadastros por papel de parceiro (sócio e funcionário restritos). O spec `menu-structure` já descreve a remoção de Despesas/Investimentos, mas o menu real ainda os exibe; esta mudança faz o código cumprir o que o spec dizia.

## Impact

- Frontend: `state/menu.ts`, `features/despesas.ts` (removida), `features/clientes.ts`, `features/financeiro/parceiros.ts`, `features/financeiro/titulos.ts` (recorrência), `features/parceiros/campos.ts` (participação do sócio), `api/endpoints.ts`, `main.ts`, rotas, ícones, testes e e2e (`casca`, `rotas`).
- Backend: migrations (papel `socio`, participação, recorrência, `recorrencia_id` no título, remoção das tabelas legadas), `routers/despesas.py` e `services/despesas.py` (removidos), `app/financeiro/*` (recorrência), `scheduler.py` (geração), `services/relatorios.py`, `services/painel.py`, `deps.py` (permissões), `openapi.json`.
- Banco: tabelas legadas removidas; `importar_legado.py` deixa de importar despesas e investimentos.
