## ADDED Requirements

### Requirement: Despesa como título a pagar
Despesas SHALL ser registradas como títulos a pagar vinculados a um parceiro com o papel `fornecedor`, `funcionario` ou `socio` (quem pode receber um pagamento da empresa) e a uma conta de despesa do plano de contas. Título a pagar para um parceiro que seja apenas cliente SHALL ser recusado.

#### Scenario: Nova despesa
- **WHEN** o usuário cria um título a pagar para um fornecedor
- **THEN** o título entra no fluxo de caixa e nos relatórios como despesa

#### Scenario: Pagamento a quem é só cliente
- **WHEN** o usuário cria um título a pagar para um parceiro que só tem o papel `cliente`
- **THEN** o sistema recusa a operação e pede um fornecedor, funcionário ou sócio

#### Scenario: Despesa quitada
- **WHEN** um título a pagar é quitado
- **THEN** o valor é contado como despesa paga no mês da data de pagamento

### Requirement: Relatórios e painel baseados em títulos
Relatórios e painel SHALL calcular despesas a partir dos títulos a pagar quitados e SHALL NOT depender das tabelas do módulo Despesas.

#### Scenario: Despesas no relatório anual
- **WHEN** existem títulos a pagar quitados em março
- **THEN** o relatório anual soma esses valores como despesa de março

### Requirement: Fim do módulo Despesas
O sistema SHALL NOT oferecer tela, rotas de API, atalhos nem tabelas de Despesas, Investimentos, Investidores e Categorias de despesa. Os dados antigos são descartados.

#### Scenario: Menu sem Despesas
- **WHEN** o usuário abre o menu
- **THEN** não existe item "Despesas" nem "Investimentos"

#### Scenario: Rota antiga
- **WHEN** o usuário acessa a URL antiga de despesas
- **THEN** é redirecionado para Financeiro › Títulos

#### Scenario: API antiga
- **WHEN** um cliente chama as rotas antigas `/despesas` ou `/investimentos`
- **THEN** o sistema responde que o recurso não existe
