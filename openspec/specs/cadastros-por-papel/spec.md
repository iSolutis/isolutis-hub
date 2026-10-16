# cadastros-por-papel Specification

## Purpose
TBD - created by archiving change parceiros-por-papel-e-fim-de-despesas. Update Purpose after archive.
## Requirements
### Requirement: Grupo de menu Cadastros
O menu SHALL exibir o grupo "Cadastros" com os itens Clientes, Fornecedores, Funcionários e Sócios, nessa ordem, e SHALL NOT exibir "Despesas" nem "Investimentos".

#### Scenario: Menu de um administrador
- **WHEN** um administrador abre a aplicação
- **THEN** o grupo "Cadastros" mostra os quatro itens
- **AND** não existe item "Despesas" no menu

#### Scenario: Item sem permissão
- **WHEN** um usuário não tem permissão para o cadastro de um papel
- **THEN** o item correspondente não aparece no menu

### Requirement: Tela de parceiros filtrada por papel
Cada item de Cadastros SHALL abrir a tela de parceiros filtrada pelo papel correspondente, com URL própria, busca por nome ou documento e ação "Novo" do papel.

#### Scenario: Abrir Fornecedores
- **WHEN** o usuário abre Cadastros › Fornecedores
- **THEN** a lista mostra apenas parceiros com o papel `fornecedor`
- **AND** a URL reflete o cadastro aberto

#### Scenario: Parceiro com dois papéis aparece nas duas listas
- **WHEN** um parceiro tem os papéis `cliente` e `fornecedor`
- **THEN** ele aparece em Clientes e em Fornecedores
- **AND** a linha exibe os dois papéis

### Requirement: Formulário com papéis múltiplos
O formulário de parceiro SHALL pré-selecionar o papel da tela de origem, permitir marcar papéis adicionais e exigir ao menos um papel.

#### Scenario: Novo fornecedor
- **WHEN** o usuário aciona "Novo fornecedor"
- **THEN** o formulário abre com o papel Fornecedor marcado
- **AND** os outros papéis podem ser marcados

#### Scenario: Nenhum papel marcado
- **WHEN** o usuário desmarca todos os papéis e salva
- **THEN** o sistema recusa o salvamento e indica o campo

#### Scenario: Acrescentar papel a parceiro existente
- **WHEN** o usuário edita um cliente e marca também Sócio
- **THEN** o parceiro passa a constar em Clientes e em Sócios sem duplicar o cadastro

