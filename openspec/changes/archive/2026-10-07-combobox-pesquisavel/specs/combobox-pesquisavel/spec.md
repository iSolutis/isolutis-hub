## Purpose

Permitir escolher um item de uma lista longa digitando para filtrá-la, com teclado, toque e leitor de tela, em computador e em celular, sem abrir mão do contrato de formulário dos campos de seleção atuais.

## ADDED Requirements

### Requirement: Localizar item por digitação
O sistema SHALL permitir que o usuário digite no campo de seleção para filtrar as opções, sem diferenciar maiúsculas/minúsculas nem acentos, por rótulo, código e grupo, mostrando antes os itens cujo código ou nome começam pelo texto digitado.

#### Scenario: Filtrar conta do plano pelo nome
- **WHEN** o usuário digita "alug" no campo "Conta do plano de contas"
- **THEN** a lista mostra as contas cujo código, nome ou grupo contenham "alug", como "2.01.015 Aluguel"

#### Scenario: Filtrar pelo código
- **WHEN** o usuário digita "2.01"
- **THEN** a lista mostra as contas desse grupo

#### Scenario: Sem resultados
- **WHEN** nenhum item corresponde ao texto digitado
- **THEN** a lista exibe a mensagem "Nenhum resultado"

#### Scenario: Lista longa
- **WHEN** mais de 50 itens correspondem ao texto
- **THEN** a lista mostra os 50 primeiros e a orientação "Digite para refinar"

### Requirement: Valor sempre vem de uma opção
O sistema SHALL gravar apenas o identificador de uma opção existente; texto livre digitado e não escolhido NÃO SHALL ser enviado.

#### Scenario: Escolher opção
- **WHEN** o usuário seleciona uma opção
- **THEN** o campo exibe o rótulo e o formulário passa a carregar o identificador da opção

#### Scenario: Limpar o campo
- **WHEN** o usuário apaga todo o texto e sai do campo
- **THEN** a escolha é removida e o campo fica vazio

#### Scenario: Sair do campo sem escolher
- **WHEN** o usuário sai do campo com texto que não foi escolhido
- **THEN** o campo restaura o rótulo da opção selecionada ou fica vazio, e a validação de obrigatório se aplica

### Requirement: Operação por teclado e acessibilidade
O sistema SHALL permitir abrir, navegar (setas), escolher (Enter) e fechar (Esc) a lista pelo teclado e expor papéis ARIA de combobox e listbox.

#### Scenario: Escolher com o teclado
- **WHEN** o usuário digita, usa a seta para baixo e pressiona Enter
- **THEN** a opção destacada é selecionada e a lista fecha

#### Scenario: Esc fecha só a lista
- **WHEN** o campo está dentro de uma gaveta, a lista está aberta e o usuário pressiona Esc
- **THEN** a lista fecha, o valor anterior é mantido e a gaveta permanece aberta

#### Scenario: Enter não envia o formulário
- **WHEN** o usuário pressiona Enter com a lista aberta
- **THEN** o formulário não é enviado

### Requirement: Estados do campo
O sistema SHALL suportar os estados desabilitado, obrigatório, lista vazia e valor pré-selecionado na edição.

#### Scenario: Edição com valor existente
- **WHEN** a gaveta de edição abre para um registro com instituição já definida
- **THEN** o campo exibe o rótulo da instituição atual

### Requirement: Opções que mudam
O sistema SHALL permitir substituir a lista de opções de um campo já aberto, mantendo a escolha se o item continua disponível e limpando-a se deixou de valer.

#### Scenario: Trocar o tipo do título
- **WHEN** o usuário troca o tipo do título de "A receber" para "A pagar" com uma conta de receita escolhida
- **THEN** a lista passa a conter só contas de despesa e o campo da conta fica vazio

### Requirement: Valor definido por outro campo
O sistema SHALL permitir que o código da tela defina o valor de um campo de seleção e SHALL exibir o rótulo correspondente.

#### Scenario: Negócio escolhido preenche o cliente
- **WHEN** o usuário escolhe um negócio no formulário de projeto
- **THEN** o campo "Cliente" passa a exibir o cliente desse negócio e o formulário carrega o identificador dele

### Requirement: Ação fixa no fim da lista
O sistema SHALL permitir uma ação fixa no fim da lista, visível mesmo com filtro ativo, como "+ Novo cliente…".

#### Scenario: Criar cliente junto com o registro
- **WHEN** o usuário escolhe "+ Novo cliente…" no campo "Cliente"
- **THEN** o campo para o nome do novo cliente é exibido e o registro cria o cliente ao ser salvo

### Requirement: Lista não cortada pela gaveta
O sistema SHALL exibir a lista aberta por inteiro, sem ser cortada pela rolagem da gaveta ou da página, abrindo para cima quando faltar espaço abaixo.

#### Scenario: Campo no fim de uma gaveta rolável
- **WHEN** o usuário abre a lista de um campo perto do rodapé da gaveta
- **THEN** a lista aparece completa e navegável

### Requirement: Uso em tela pequena
O sistema SHALL, em telas estreitas, abrir a seleção como folha em tela cheia, com busca no topo, itens de toque de pelo menos 44 px, campo de busca de pelo menos 16 px, sem cobrir a lista com o teclado virtual e com o botão Voltar do aparelho fechando apenas a folha.

#### Scenario: Escolher no celular
- **WHEN** o usuário toca no campo "Conta do plano de contas" numa tela estreita, digita "alug" e toca num item
- **THEN** a folha abre em tela cheia, filtra a lista, fecha ao escolher e o campo mostra o item

#### Scenario: Teclado virtual
- **WHEN** o teclado do aparelho aparece com a folha aberta
- **THEN** a lista continua visível e rolável acima do teclado

#### Scenario: Voltar do aparelho
- **WHEN** a folha está aberta dentro de uma gaveta e o usuário aciona o Voltar do aparelho
- **THEN** só a folha fecha; a gaveta e a tela atual permanecem como estavam, com os dados digitados

#### Scenario: Sem zoom ao tocar
- **WHEN** o usuário toca no campo de busca da folha num iPhone
- **THEN** a página não dá zoom automático

### Requirement: Campos de poucas opções permanecem simples
O sistema SHALL manter o seletor nativo para enumerações pequenas e fixas, como situação, tipo, prioridade e UF.

#### Scenario: Campo de situação
- **WHEN** o usuário abre o campo "Situação" do título
- **THEN** a escolha usa o seletor nativo do navegador
