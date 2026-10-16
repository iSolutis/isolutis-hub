# socios-como-parceiros Specification

## Purpose
TBD - created by archiving change parceiros-por-papel-e-fim-de-despesas. Update Purpose after archive.
## Requirements
### Requirement: Papel sócio
O domínio de papéis de parceiro SHALL incluir o papel `socio` (rótulo "Sócio"), atribuível a pessoas físicas e jurídicas junto com qualquer outro papel.

#### Scenario: Sócio e funcionário ao mesmo tempo
- **WHEN** um parceiro recebe os papéis `socio` e `funcionario`
- **THEN** o cadastro é salvo com os dois papéis

### Requirement: Participação do sócio na empresa
O cadastro de um parceiro com o papel `socio` SHALL registrar a participação na empresa como percentual maior que 0 e até 100, e a soma das participações dos sócios da empresa SHALL NOT ultrapassar 100.

#### Scenario: Informar participação
- **WHEN** o usuário marca o papel Sócio e informa 40% de participação
- **THEN** o cadastro guarda 40% para esse sócio

#### Scenario: Soma acima de 100
- **WHEN** os sócios já somam 80% e o usuário informa 30% para outro
- **THEN** o sistema recusa o salvamento e informa o total já distribuído

#### Scenario: Soma abaixo de 100
- **WHEN** a soma das participações é menor que 100
- **THEN** o cadastro é aceito
- **AND** a tela de sócios exibe um aviso com o percentual não distribuído

#### Scenario: Remoção do papel
- **WHEN** o usuário remove o papel Sócio de um parceiro
- **THEN** a participação dele deixa de existir e não entra mais na soma

### Requirement: Aporte como recebimento
O aporte de um sócio SHALL ser registrado como título a receber cujo parceiro é um sócio, em conta do plano de contas destinada a aportes.

#### Scenario: Registrar aporte
- **WHEN** o usuário cria um título a receber na conta "Aporte de sócio" para um sócio
- **THEN** o título é aceito e, quando quitado, entra como entrada no fluxo de caixa

#### Scenario: Parceiro sem o papel
- **WHEN** o título na conta de aporte aponta para um parceiro sem o papel `socio`
- **THEN** o sistema recusa a operação com erro de validação

#### Scenario: Aporte fora da receita operacional
- **WHEN** um aporte é quitado
- **THEN** ele não compõe a receita operacional do painel nem dos relatórios
- **AND** aparece em separado como aporte

