# visibilidade-por-escopo Specification

## Purpose

Definir o que cada pessoa enxerga dentro das áreas que o seu papel libera, combinando posse dos registros e liderança de equipes, de forma consistente em todas as saídas do sistema.

## Requirements

### Requirement: Regra de visibilidade
Dentro de uma área liberada pelo papel, o sistema SHALL entregar somente os clientes, negócios, orçamentos, projetos, etapas e tarefas que: (a) não têm dono; (b) têm a própria pessoa como dono; (c) têm como dono um liderado dela; ou (d) são concedidos por outra regra desta mudança (dono do cliente, participação em projeto). Administradores SHALL ver todos. Quem não tem a área pelo papel não vê nada dela.

#### Scenario: Comercial sem liderança
- **WHEN** Bruno, comercial, lista os negócios
- **THEN** recebe os negócios dele e os sem responsável
- **AND** não recebe os negócios de Carla

#### Scenario: Líder comercial
- **WHEN** Ana, comercial que lidera Bruno e Carla, lista os negócios
- **THEN** recebe os dela, os de Bruno, os de Carla e os sem responsável

#### Scenario: Administrador
- **WHEN** a administradora lista qualquer área
- **THEN** recebe todos os registros da empresa

### Requirement: Registro sem dono herda do registro acima
O sistema SHALL tratar como visível a todos da área apenas o registro sem dono cujos registros acima (o cliente de um negócio, orçamento, projeto ou tarefa; o projeto de uma etapa ou tarefa) também não têm dono. Um registro sem dono abaixo de outro com dono SHALL seguir a visibilidade desse outro.

#### Scenario: Registro sem dono
- **WHEN** existe uma tarefa sem responsável e sem projeto
- **THEN** todas as pessoas com acesso à área de tarefas a veem

#### Scenario: Registro sem dono dentro de outro com dono
- **WHEN** existe uma tarefa sem responsável no projeto P, de Diego
- **THEN** a tarefa é vista por quem vê P, e não por todos

### Requirement: Registro fora do escopo é inexistente
O sistema SHALL responder a qualquer leitura, alteração ou exclusão de um registro fora do escopo da pessoa exatamente como responde a um registro que não existe, sem revelar sua existência, título ou dono.

#### Scenario: Acesso direto pelo endereço
- **WHEN** Bruno abre o endereço de um negócio de Carla
- **THEN** recebe "registro não encontrado"

### Requirement: Escopo em todas as saídas
O sistema SHALL aplicar a mesma regra de visibilidade a listas, detalhes, buscas, contagens e totais do painel, relatórios, documentos gerados (orçamento, plano de entrega) e avisos de tempo real. Nenhum total ou contagem SHALL incluir registros que a pessoa não enxerga.

#### Scenario: Painel de um vendedor
- **WHEN** Bruno abre o painel
- **THEN** o funil, os fechamentos e os orçamentos exibidos somam apenas o que Bruno enxerga

#### Scenario: Documento de orçamento alheio
- **WHEN** Bruno pede o PDF de um orçamento de Carla
- **THEN** recebe "registro não encontrado"

### Requirement: Referências de clientes mínimas
O sistema SHALL entregar na lista de referências de clientes (usada para exibir nomes) apenas os clientes que a pessoa enxerga ou que estão vinculados a algum registro que ela enxerga, e somente o identificador e o nome deles.

#### Scenario: Membro com uma tarefa
- **WHEN** um membro cujo único registro visível é uma tarefa do cliente X pede as referências de clientes
- **THEN** recebe apenas X, com identificador e nome

### Requirement: Garantia independente da aplicação
O sistema SHALL impor a regra de visibilidade também na camada de dados, de modo que uma consulta que esqueça o filtro na aplicação continue limitada ao escopo da pessoa da requisição.

#### Scenario: Consulta sem filtro
- **WHEN** um trecho da aplicação consulta todos os negócios sem filtrar por dono
- **THEN** o resultado contém apenas os negócios do escopo da pessoa da requisição

### Requirement: Área financeira sem escopo por dono
O sistema SHALL manter a área financeira (títulos, contas, fluxo de caixa, faturamento, despesas, relatórios financeiros e hub de parceiros) visível por inteiro a quem tem o papel financeiro ou administrador, sem filtro por dono nesta versão. Quem acessa o cadastro de um cliente pelo hub financeiro SHALL NOT ganhar por isso acesso aos negócios, orçamentos, projetos ou tarefas desse cliente.

#### Scenario: Financeiro consulta o parceiro
- **WHEN** uma pessoa do financeiro abre o parceiro X no hub financeiro
- **THEN** vê o cadastro completo de X
- **AND** não passa a ver os negócios de X na área comercial (que o papel financeiro não libera)
