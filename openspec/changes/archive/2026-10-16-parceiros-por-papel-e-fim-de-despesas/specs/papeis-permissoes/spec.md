## ADDED Requirements

### Requirement: Acesso aos cadastros por papel de parceiro
O backend SHALL restringir a listagem e a edição de parceiros conforme o papel de parceiro e o papel do usuário: Clientes para `comercial` e `financeiro`; Fornecedores para `financeiro`; Funcionários e Sócios somente para `admin`. A restrição SHALL ser imposta no servidor, não só no menu.

#### Scenario: Comercial tenta ver sócios
- **WHEN** um usuário `comercial` consulta parceiros com o papel `socio`
- **THEN** o sistema recusa com erro de permissão

#### Scenario: Parceiro com vários papéis
- **WHEN** um parceiro é cliente e funcionário e um `comercial` lista clientes
- **THEN** o parceiro aparece como cliente
- **AND** os dados exclusivos do papel funcionário não são expostos
