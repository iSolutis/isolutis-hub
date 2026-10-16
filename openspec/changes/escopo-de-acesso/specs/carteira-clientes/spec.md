# Spec Delta

## Purpose

Dar dono aos clientes e aos registros de trabalho, definir o que o dono do cliente enxerga e controlar quem pode criar, transferir ou retirar a posse de um registro.

## ADDED Requirements

### Requirement: Cliente com dono
O sistema SHALL permitir que cada cliente tenha um dono, que é uma pessoa com acesso à empresa. Um cliente sem dono SHALL ser tratado como registro sem dono.

#### Scenario: Cliente criado por um vendedor
- **WHEN** Bruno cadastra um cliente
- **THEN** Bruno é o dono do cliente

### Requirement: O dono do cliente vê tudo do cliente
O sistema SHALL permitir que quem enxerga um cliente pela posse (o dono ou um líder do dono) veja todos os negócios, orçamentos, projetos, etapas e tarefas desse cliente, mesmo que o responsável por eles seja outra pessoa. Ver por esse motivo SHALL NOT conceder edição desses registros.

#### Scenario: Negócio de outro vendedor no cliente da carteira
- **WHEN** Ana é dona do cliente X e Bruno é responsável por um negócio com X
- **THEN** Ana vê o negócio, seus orçamentos e projetos derivados
- **AND** Ana não pode editá-los, a menos que seja líder de Bruno ou admin

### Requirement: Cliente alheio aparece só pelo nome
O sistema SHALL mostrar apenas o nome de um cliente a quem enxerga um registro dele (negócio, projeto, tarefa) sem enxergar o próprio cliente. Documento, contato, telefone, e-mail, endereço e observações SHALL NOT ser entregues nesse caso, em nenhuma tela, documento gerado ou resposta da API.

#### Scenario: Vendedor com negócio em cliente de outro
- **WHEN** Bruno abre seu negócio com o cliente X, de que Ana é dona
- **THEN** Bruno vê "X" como cliente do negócio
- **AND** a tentativa de abrir o cadastro de X é recusada como registro inexistente

### Requirement: Quem edita clientes e negócios
O sistema SHALL permitir editar ou excluir um cliente, negócio ou orçamento somente ao seu dono, aos líderes do dono e a administradores. Um registro sem dono SHALL poder ser editado por qualquer pessoa com acesso à área, exceto para atribuir dono, que segue a regra de transferência.

#### Scenario: Líder edita negócio do liderado
- **WHEN** Ana, líder de Bruno, altera a etapa de um negócio de Bruno
- **THEN** a alteração é gravada

#### Scenario: Colega tenta editar
- **WHEN** Carla tenta alterar um negócio de Bruno que ela enxerga por ser dona do cliente
- **THEN** o sistema recusa a alteração

### Requirement: Vínculo só com clientes visíveis
O sistema SHALL permitir criar ou alterar negócios, orçamentos, projetos e tarefas vinculados a um cliente somente se a pessoa enxerga esse cliente; um identificador de cliente fora do escopo SHALL ser tratado como inexistente.

#### Scenario: Vendedor usa o cliente de outro
- **WHEN** Bruno tenta criar um negócio informando o identificador de um cliente de Carla
- **THEN** o sistema recusa com "cliente não encontrado"

### Requirement: Dono padrão de registros novos
O sistema SHALL definir como dono (responsável) de clientes, negócios, projetos e tarefas novos a pessoa que os cria, quando nenhum outro for informado. Só líderes e administradores SHALL poder criar ou deixar um desses registros sem dono, ou atribuí-lo a outra pessoa.

#### Scenario: Comercial tenta criar negócio sem responsável
- **WHEN** um comercial sem liderança cria um negócio sem informar responsável
- **THEN** o negócio é criado com ele como responsável

#### Scenario: Comercial tenta soltar o próprio cliente
- **WHEN** um comercial sem liderança tenta remover o dono do seu cliente
- **THEN** o sistema recusa a operação

### Requirement: Orçamento segue o negócio
O sistema SHALL considerar como dono de um orçamento o responsável pelo negócio a que ele está vinculado; um orçamento sem negócio SHALL pertencer a quem o criou. Transferir o negócio SHALL transferir junto os seus orçamentos.

#### Scenario: Negócio transferido
- **WHEN** um negócio de Bruno com dois orçamentos é transferido para Carla
- **THEN** Carla passa a ser dona dos dois orçamentos

### Requirement: Transferência de dono
O sistema SHALL permitir transferir o dono de um cliente, negócio, projeto ou tarefa somente a: (a) um líder, quando o dono atual e o novo dono são ele próprio ou seus liderados; (b) um administrador, entre quaisquer pessoas da empresa. A transferência SHALL registrar quem transferiu, de quem, para quem e quando.

#### Scenario: Líder redistribui a carteira
- **WHEN** Ana, líder de Bruno e Carla, transfere um cliente de Bruno para Carla
- **THEN** Carla passa a ser a dona e Bruno deixa de vê-lo (se não houver outro motivo)
- **AND** a transferência fica registrada

#### Scenario: Líder tenta transferir para fora da sua árvore
- **WHEN** Ana tenta transferir um cliente de Bruno para Diego, que não é seu liderado
- **THEN** o sistema recusa a operação

#### Scenario: Comercial tenta pegar um cliente
- **WHEN** Bruno tenta tornar-se dono de um cliente de Carla
- **THEN** o sistema recusa a operação

### Requirement: Donos dos clientes existentes
Na ativação desta funcionalidade, o sistema SHALL atribuir como dono de cada cliente existente o responsável pelo negócio mais recente com ele; clientes sem negócio com responsável SHALL ficar sem dono.

#### Scenario: Cliente com histórico de negócios
- **WHEN** o cliente X tem negócios de Bruno (2025) e de Carla (2026)
- **THEN** após a ativação, Carla é a dona de X
