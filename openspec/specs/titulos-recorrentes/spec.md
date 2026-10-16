# titulos-recorrentes Specification

## Purpose
TBD - created by archiving change parceiros-por-papel-e-fim-de-despesas. Update Purpose after archive.
## Requirements
### Requirement: Cadastro de recorrência
O sistema SHALL permitir cadastrar quantas recorrências forem necessárias de título a pagar (despesa) ou a receber (receita), informando parceiro, conta do plano de contas, conta bancária, valor maior que zero, frequência, dia de vencimento, data de início e término.

#### Scenario: Despesa mensal
- **WHEN** o usuário cadastra um aluguel de R$ 3.000 todo dia 5, de janeiro a dezembro
- **THEN** o sistema cria os títulos a pagar com vencimento no dia 5 de cada mês do período
- **AND** cada título referencia a recorrência de origem

#### Scenario: Receita recorrente
- **WHEN** o usuário cadastra uma mensalidade de cliente como recorrência a receber
- **THEN** os títulos gerados são a receber, para o parceiro e a conta de receita informados

#### Scenario: Várias recorrências
- **WHEN** a empresa cadastra recorrências de aluguel, internet e mensalidade
- **THEN** cada uma gera seus próprios títulos sem interferir nas outras

#### Scenario: Dados inválidos
- **WHEN** falta parceiro, data de início ou valor maior que zero
- **THEN** o sistema recusa o cadastro e indica os campos

### Requirement: Frequências
O sistema SHALL oferecer as frequências semanal, quinzenal, mensal, bimestral, trimestral, semestral e anual.

#### Scenario: Trimestral
- **WHEN** a recorrência é trimestral com início em 10/01
- **THEN** os vencimentos são 10/01, 10/04, 10/07 e 10/10

#### Scenario: Semanal
- **WHEN** a recorrência é semanal com início numa segunda-feira
- **THEN** os vencimentos caem toda segunda-feira

### Requirement: Término da recorrência
O sistema SHALL aceitar exatamente uma forma de término: data final, quantidade de ocorrências ou sem fim.

#### Scenario: Por quantidade
- **WHEN** a recorrência mensal tem 6 ocorrências
- **THEN** são gerados exatamente 6 títulos

#### Scenario: Por data final
- **WHEN** a recorrência tem data final em 30/06
- **THEN** nenhum título é gerado com vencimento após 30/06

#### Scenario: Sem fim
- **WHEN** a recorrência não tem término
- **THEN** os títulos são gerados até o fim do horizonte e renovados continuamente

#### Scenario: Mais de uma forma de término
- **WHEN** o cadastro informa data final e quantidade ao mesmo tempo
- **THEN** o sistema recusa com erro de validação

### Requirement: Geração contínua e idempotente
O sistema SHALL manter títulos gerados em um horizonte futuro móvel e SHALL NOT criar dois títulos para a mesma recorrência e o mesmo vencimento.

#### Scenario: Término finito gera tudo na gravação
- **WHEN** a recorrência tem término por data ou por quantidade
- **THEN** todas as ocorrências são geradas ao gravar, sem depender do job

#### Scenario: Título apagado não reaparece
- **WHEN** o usuário apaga um título gerado e o job de renovação roda
- **THEN** o título apagado não é recriado

#### Scenario: Renovação do horizonte
- **WHEN** o job de geração roda e a recorrência não tem término
- **THEN** são criados os títulos que faltam até o fim do horizonte

#### Scenario: Execução repetida
- **WHEN** o job roda duas vezes seguidas
- **THEN** nenhum título é duplicado

#### Scenario: Mês curto
- **WHEN** o dia de vencimento é 31 e o mês tem 30 dias
- **THEN** o título vence no último dia do mês

### Requirement: Edição, pausa e encerramento da recorrência
Alterar, pausar ou encerrar uma recorrência SHALL afetar somente títulos futuros ainda abertos; títulos quitados ou cancelados SHALL NOT ser alterados.

#### Scenario: Reajuste de valor
- **WHEN** o usuário altera o valor da recorrência
- **THEN** os títulos futuros abertos passam ao novo valor
- **AND** os títulos já quitados mantêm o valor original

#### Scenario: Pausar
- **WHEN** o usuário pausa a recorrência
- **THEN** nenhum título novo é gerado enquanto estiver pausada
- **AND** os títulos já gerados permanecem

#### Scenario: Encerrar
- **WHEN** o usuário encerra a recorrência
- **THEN** os títulos futuros abertos são removidos
- **AND** os quitados permanecem

#### Scenario: Editar um título isolado
- **WHEN** o usuário altera apenas um título gerado
- **THEN** a recorrência e os demais títulos não mudam

### Requirement: Recorrências na interface
A tela de títulos SHALL identificar títulos oriundos de recorrência e SHALL listar as recorrências com estado vazio, carregamento e erro.

#### Scenario: Identificação
- **WHEN** o usuário vê a lista de títulos
- **THEN** os títulos gerados por recorrência exibem um indicador e levam ao modelo de origem

#### Scenario: Sem recorrências
- **WHEN** a empresa não tem recorrências
- **THEN** a lista mostra o estado vazio com ação para cadastrar a primeira

