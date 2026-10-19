# cadastro-rapido Specification

## Purpose
Criar o item relacionado que falta (cliente, parceiro, conta bancária, negócio, projeto) a partir do campo de relação, num formulário reduzido em gaveta empilhada, sem abandonar a tela em preenchimento.
## Requirements
### Requirement: Opção de cadastro rápido no campo de relação
O sistema SHALL oferecer, ao fim da lista de um campo de relação habilitado para cadastro rápido, a opção "+ Novo <entidade>…", visível mesmo com filtro ativo. Quando houver texto digitado na busca, a opção SHALL mostrar "+ Cadastrar “<texto>”…". A opção SHALL funcionar na lista suspensa (telas largas) e na folha de seleção (telas estreitas), por clique, toque ou teclado.

#### Scenario: Campo sem texto digitado
- **WHEN** o usuário abre a lista do campo "Parceiro de negócio" sem digitar nada
- **THEN** a última opção da lista é "+ Novo parceiro…"

#### Scenario: Busca sem resultado
- **WHEN** o usuário digita "Acme" no campo e nenhum parceiro corresponde
- **THEN** a lista mostra "Nenhum resultado" e a opção "+ Cadastrar “Acme”…"

#### Scenario: Escolha pelo teclado
- **WHEN** o usuário navega com as setas até a opção de cadastro rápido e pressiona Enter
- **THEN** o cadastro rápido abre e o formulário de origem não é enviado

#### Scenario: Tela estreita
- **WHEN** o usuário escolhe a opção de cadastro rápido na folha de seleção do celular
- **THEN** a folha fecha e o cadastro rápido abre

### Requirement: Cadastro em gaveta empilhada sem perder a tela de origem
O sistema SHALL abrir o cadastro rápido numa gaveta empilhada sobre a tela de origem, que permanece montada e com todos os valores digitados. Enquanto a gaveta empilhada estiver aberta, só ela SHALL receber foco, Esc e o botão Voltar do aparelho. Fechá-la SHALL devolver o foco ao campo de relação de origem.

#### Scenario: Valores preservados
- **WHEN** o usuário preenche valor e vencimento de um novo título, abre "+ Novo parceiro…" e depois fecha ou salva a gaveta empilhada
- **THEN** valor, vencimento e os demais campos do título continuam como estavam

#### Scenario: Esc fecha só a gaveta de cima
- **WHEN** a gaveta de cadastro rápido está aberta e o usuário pressiona Esc
- **THEN** só a gaveta de cadastro rápido fecha, sem criar nada, e a gaveta do título continua aberta

#### Scenario: Voltar do aparelho
- **WHEN** a gaveta de cadastro rápido está aberta no celular e o usuário usa o botão Voltar do aparelho
- **THEN** só a gaveta de cadastro rápido fecha e a navegação não muda de tela

#### Scenario: Origem em formulário em página
- **WHEN** o usuário está no formulário em página de um orçamento e cria um cliente pelo cadastro rápido
- **THEN** o formulário do orçamento mantém os valores e não acusa alterações perdidas nem conflito de edição

### Requirement: Item criado selecionado na origem
Ao salvar com sucesso, o sistema SHALL fechar a gaveta de cadastro rápido, incluir o item criado nas opções do campo de origem e selecioná-lo, notificando a mudança do campo como uma escolha do usuário. Se o salvamento falhar, a gaveta SHALL permanecer aberta com os valores digitados e o erro exibido.

#### Scenario: Parceiro criado no título
- **WHEN** o usuário salva um novo parceiro pelo cadastro rápido do título
- **THEN** a gaveta fecha e o campo "Parceiro de negócio" do título mostra o parceiro criado

#### Scenario: Dependentes reagem à escolha
- **WHEN** o usuário cria um cliente pelo cadastro rápido no orçamento
- **THEN** o cliente fica selecionado e a lista de negócios do orçamento é atualizada para esse cliente, como numa escolha manual

#### Scenario: Erro ao salvar
- **WHEN** o servidor recusa o cadastro rápido
- **THEN** a mensagem de erro é exibida, a gaveta continua aberta com os valores e nada é selecionado na origem

#### Scenario: Salvar sem duplicar
- **WHEN** o usuário clica em Salvar várias vezes no cadastro rápido
- **THEN** um único item é criado

### Requirement: Formulário reduzido por entidade
O cadastro rápido SHALL mostrar apenas os campos obrigatórios ou chave de cada entidade, com as mesmas validações do cadastro completo para esses campos. Os demais dados SHALL ficar para o cadastro completo da entidade.

| Entidade | Campos |
|---|---|
| Cliente | Nome / Razão social, Tipo de pessoa, CPF/CNPJ |
| Parceiro de negócio | Nome / Razão social, Tipo de pessoa, CPF/CNPJ, Papéis e, com o papel Sócio, Participação (%) |
| Conta bancária | Instituição financeira, Nome da conta, Saldo inicial |
| Negócio | Título, Cliente |
| Projeto | Nome, Cliente |

#### Scenario: Cliente reduzido
- **WHEN** o usuário abre "+ Novo cliente…"
- **THEN** a gaveta mostra somente Nome / Razão social, Tipo de pessoa e CPF/CNPJ, com a máscara de documento conforme o tipo de pessoa

#### Scenario: Validação mantida
- **WHEN** o usuário tenta salvar um parceiro sem nome ou sem papel
- **THEN** o sistema avisa o que falta e não cria o parceiro

#### Scenario: Sócio exige participação
- **WHEN** o usuário marca o papel Sócio no cadastro rápido de parceiro
- **THEN** o campo Participação (%) aparece e é exigido, como no cadastro completo

### Requirement: Contexto da tela de origem
O sistema SHALL pré-preencher o formulário reduzido com o contexto da origem: o texto digitado na busca vai para o nome/título; o parceiro criado a partir de um título ou recorrência já vem com o papel compatível (fornecedor para a pagar, cliente para a receber, sócio quando a conta do plano for de aporte de sócio); o negócio criado no orçamento e o projeto criado na tarefa já vêm com o cliente escolhido na origem, quando houver. O item criado SHALL ser compatível com os filtros do campo de origem ou o sistema SHALL avisar que ele não pode ser usado ali.

#### Scenario: Nome a partir da busca
- **WHEN** o usuário escolhe "+ Cadastrar “Acme”…"
- **THEN** o campo Nome / Razão social abre preenchido com "Acme"

#### Scenario: Papel conforme o título
- **WHEN** o usuário abre "+ Novo parceiro…" num título a pagar
- **THEN** o papel Fornecedor vem marcado

#### Scenario: Papel de sócio na conta de aporte
- **WHEN** a conta do plano escolhida no título é de aporte de sócio e o usuário abre "+ Novo parceiro…"
- **THEN** o papel Sócio vem marcado e o campo Participação (%) aparece

#### Scenario: Item incompatível com a origem
- **WHEN** o usuário desmarca o papel sugerido e salva um parceiro que não atende ao filtro do título
- **THEN** o parceiro é criado, o sistema avisa que ele não pode ser usado neste título e o campo de origem não muda

#### Scenario: Negócio com o cliente da origem
- **WHEN** o orçamento já tem cliente escolhido e o usuário abre "+ Novo negócio…"
- **THEN** o cliente do negócio é o cliente do orçamento, mostrado sem edição

#### Scenario: Orçamento sem cliente
- **WHEN** o orçamento ainda não tem cliente escolhido
- **THEN** o campo "Negócio" não oferece "+ Novo negócio…" (o negócio pertence ao cliente do orçamento)

### Requirement: Permissão para cadastrar
O sistema SHALL mostrar a opção de cadastro rápido somente a quem pode criar a entidade: cliente e negócio exigem permissão do comercial; conta bancária exige permissão do financeiro; projeto exige a permissão de criar projetos; parceiro exige a permissão de ao menos um papel compatível com a origem (fornecedor e cliente pelo financeiro; sócio e funcionário pela administração). Usuários em modo somente leitura SHALL não ver a opção. O servidor continua sendo a autoridade sobre a permissão.

#### Scenario: Sem permissão
- **WHEN** um usuário sem permissão do comercial abre o campo "Cliente" de uma tarefa
- **THEN** a lista não mostra "+ Novo cliente…"

#### Scenario: Papel sem permissão
- **WHEN** um usuário só com permissão do financeiro abre "+ Novo parceiro…" num título de conta de aporte de sócio
- **THEN** a opção não é exibida, porque só sócios são aceitos ali e criar sócio exige administração

#### Scenario: Servidor recusa
- **WHEN** a permissão do usuário mudou e o servidor recusa a criação
- **THEN** o erro é exibido na gaveta e nada é selecionado na origem

### Requirement: Um único nível de cadastro rápido
O sistema SHALL permitir no máximo uma gaveta de cadastro rápido por vez. Campos de relação dentro de um formulário de cadastro rápido SHALL não oferecer a opção de cadastro rápido.

#### Scenario: Projeto criado na tarefa
- **WHEN** o usuário abre "+ Novo projeto…" na tarefa
- **THEN** o campo Cliente do projeto lista os clientes existentes sem a opção "+ Novo cliente…"

### Requirement: Campos e telas atendidos
O cadastro rápido SHALL estar disponível nos seguintes campos: Parceiro de negócio e Conta bancária em títulos e recorrências; Cliente em negócios, orçamentos, projetos, faturamento e tarefas; Negócio em orçamentos; Projeto em tarefas. Não SHALL estar disponível em: conta do plano de contas, conta pai do plano, "Negócio vendido" do projeto, instituição financeira, município e pessoas da equipe.

#### Scenario: Recorrência
- **WHEN** o usuário abre o campo "Conta bancária" de uma nova recorrência
- **THEN** o campo é pesquisável e oferece "+ Nova conta bancária…"

#### Scenario: Plano de contas fora
- **WHEN** o usuário abre o campo "Conta do plano de contas" do título
- **THEN** não há opção de cadastro rápido

#### Scenario: Negócio vendido fora
- **WHEN** o usuário abre o campo "Negócio vendido" do projeto
- **THEN** não há opção de cadastro rápido

