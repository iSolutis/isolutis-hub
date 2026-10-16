# Spec Delta

## Purpose

Organizar as pessoas de uma empresa em equipes com líderes, definindo de quem cada líder enxerga e administra os registros, inclusive em hierarquias de vários níveis.

## ADDED Requirements

### Requirement: Equipes com membros e líderes
O sistema SHALL permitir que a empresa tenha equipes, cada uma com nome, um ou mais líderes e zero ou mais membros. Uma pessoa SHALL poder pertencer e liderar várias equipes da mesma empresa. Equipes, membros e líderes SHALL pertencer a uma única empresa e nunca ser visíveis para outra.

#### Scenario: Pessoa em duas equipes
- **WHEN** Bruno é membro da Equipe Sul e da Equipe Varejo
- **THEN** os líderes das duas equipes enxergam os registros de Bruno

#### Scenario: Equipe com dois líderes
- **WHEN** Ana e Carlos são líderes da Equipe Sul
- **THEN** ambos enxergam os registros de todos os membros da Equipe Sul

### Requirement: Liderança aninhada
O sistema SHALL considerar como liderados de uma pessoa todos os membros das equipes que ela lidera e, recursivamente, os liderados desses membros, em qualquer número de níveis. Ciclos na estrutura SHALL NOT causar erro nem repetição.

#### Scenario: Três níveis
- **WHEN** a diretora lidera a equipe da qual Ana é membro, e Ana lidera a equipe da qual Bruno é membro
- **THEN** a diretora enxerga os registros de Ana e de Bruno
- **AND** Ana enxerga os de Bruno, mas não os da diretora

#### Scenario: Ciclo
- **WHEN** Ana lidera uma equipe com Bruno e Bruno lidera uma equipe com Ana
- **THEN** cada um enxerga os registros do outro e o sistema responde normalmente

### Requirement: Administração das equipes
O sistema SHALL permitir criar, renomear e excluir equipes e incluir ou retirar membros e líderes somente a administradores da empresa. Toda alteração na estrutura SHALL valer a partir da requisição seguinte de cada pessoa afetada.

#### Scenario: Não administrador tenta alterar equipe
- **WHEN** um líder que não é administrador tenta incluir uma pessoa na sua equipe
- **THEN** o sistema recusa a operação

#### Scenario: Pessoa retirada da equipe
- **WHEN** o administrador retira Bruno da Equipe Sul
- **THEN** na requisição seguinte, os líderes da Equipe Sul deixam de enxergar os registros de Bruno (exceto os sem dono)

#### Scenario: Pessoa que deixa a empresa
- **WHEN** o acesso de uma pessoa à empresa é desativado
- **THEN** ela deixa de enxergar qualquer registro da empresa, inclusive como líder
- **AND** os registros de que ela é dona continuam visíveis aos líderes dela até serem transferidos
