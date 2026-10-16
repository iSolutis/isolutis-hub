# Spec Delta

## Purpose

Definir quem participa de um projeto e separar o que cada participante pode ver do que pode editar em projetos, etapas e tarefas.

## ADDED Requirements

### Requirement: Participantes do projeto
O sistema SHALL considerar participantes de um projeto: o responsável do projeto, os responsáveis de suas etapas e as pessoas incluídas explicitamente como participantes. Incluir ou retirar participantes SHALL ser permitido ao responsável do projeto, aos líderes dele e a administradores.

#### Scenario: Responsável de etapa
- **WHEN** Diego é responsável pela etapa "Implantação" do projeto P
- **THEN** Diego é participante de P

#### Scenario: Inclusão explícita
- **WHEN** o responsável do projeto inclui Elisa como participante
- **THEN** Elisa passa a ser participante de P

### Requirement: Participante vê o projeto inteiro
O sistema SHALL permitir que qualquer participante veja o projeto, todas as suas etapas e todas as suas tarefas.

#### Scenario: Responsável de uma etapa vê as demais
- **WHEN** Diego, responsável pela etapa "Implantação", abre o projeto P
- **THEN** vê todas as etapas e tarefas de P

### Requirement: Cada um atua no que é seu
O sistema SHALL permitir editar:
- o projeto, todas as etapas e todas as tarefas: ao responsável do projeto, aos líderes dele e a administradores;
- uma etapa e as tarefas dela: também ao responsável da etapa e aos líderes dele;
- uma tarefa: também ao responsável da tarefa e aos líderes dele.
Os demais participantes SHALL ver sem editar. Excluir um projeto ou etapa SHALL seguir a mesma regra de edição do respectivo registro.

#### Scenario: Responsável de etapa edita outra etapa
- **WHEN** Diego tenta alterar a etapa "Treinamento", de Elisa
- **THEN** o sistema recusa a alteração e a etapa permanece como estava

#### Scenario: Participante sem responsabilidade
- **WHEN** Elisa, participante sem etapa nem tarefa, abre o projeto
- **THEN** vê tudo, mas a interface não oferece edição e a API recusa alterações

### Requirement: Criação de tarefas no projeto
O sistema SHALL permitir que qualquer participante crie tarefas no projeto, atribuídas a si mesmo ou a outro participante. Atribuir uma tarefa a quem não participa do projeto SHALL ser permitido apenas ao responsável do projeto, aos líderes dele e a administradores.

#### Scenario: Participante atribui a quem não participa
- **WHEN** Diego, responsável de etapa, cria uma tarefa no projeto P atribuída a Fábio, que não participa de P
- **THEN** o sistema recusa a atribuição

#### Scenario: Responsável do projeto delega a alguém de fora
- **WHEN** o responsável do projeto P atribui uma tarefa a Fábio, que não participa de P
- **THEN** a tarefa é criada e Fábio passa a executá-la como executor de tarefa avulsa

### Requirement: Executor de tarefa avulsa
O sistema SHALL permitir que quem é responsável por uma tarefa de um projeto, sem ser participante desse projeto, veja e edite somente essa tarefa; do projeto, SHALL receber apenas o identificador e o título.

#### Scenario: Prestador com uma tarefa
- **WHEN** Fábio é responsável apenas pela tarefa T do projeto P
- **THEN** Fábio vê e edita T
- **AND** vê "P" como projeto da tarefa, mas a abertura de P é recusada como registro inexistente
