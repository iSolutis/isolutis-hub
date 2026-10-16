# scrollable-sidebar-menu Specification

## Purpose
Comportamento do menu lateral de navegação: rolagem interna, largura e visibilidade dos blocos de presença e conta.
## Requirements
### Requirement: Menu lateral com scroll quando expande
O menu de navegação (`#nav`) SHALL ocupar o espaço vertical restante da barra lateral, definido por layout flexível e sem altura calculada à mão, e permitir scroll interno quando os itens expandidos excedem esse espaço.

#### Scenario: Menu expande sem ocultar presença
- **WHEN** usuário clica para expandir um grupo de menu (ex: Financeiro)
- **THEN** os itens filhos aparecem visíveis
- **AND** a seção "Usando agora" permanece visível no final da sidebar

#### Scenario: Menu com scroll quando cresce muito
- **WHEN** múltiplos grupos estão expandidos simultaneamente
- **THEN** o menu exibe scroll bar vertical se exceder o espaço disponível
- **AND** a seção "Usando agora" continua acessível sem scroll

#### Scenario: Presença e sincronização ficam fixas
- **WHEN** usuário faz scroll no menu lateral
- **THEN** o `.online` (Usando agora) permanece visível no final
- **AND** a indicação de sincronização permanece visível
- **AND** esses elementos não são ocultados pelo menu

#### Scenario: Conta do usuário fora da barra lateral
- **WHEN** o usuário procura suas informações de conta e as ações de trocar senha e sair
- **THEN** elas estão no menu do usuário da barra superior
- **AND** a barra lateral não exibe mais um bloco de conta

#### Scenario: Bloco de presença cresce
- **WHEN** muitas pessoas estão online e o bloco "Usando agora" ocupa mais altura
- **THEN** o menu reduz a própria altura visível automaticamente
- **AND** nenhum item de menu fica coberto pelos blocos fixos

### Requirement: Layout responsivo mantém presença visível
Em qualquer tamanho de tela ou quantidade de itens de menu, a seção de presença do usuário SHALL permanecer acessível.

#### Scenario: Desktop com menu grande
- **WHEN** na visualização desktop com todos os grupos expandidos
- **THEN** o menu faz scroll interno para caber na altura da viewport
- **AND** "Usando agora" é sempre alcançável sem scroll da página

#### Scenario: Mobile com menu em painel
- **WHEN** em tela pequena, com o painel de menu aberto
- **THEN** o menu faz scroll interno dentro do painel
- **AND** a presença continua visível e acessível na ordem correta

### Requirement: Largura ampliada da barra lateral
A barra lateral de navegação SHALL ter 272px de largura quando expandida, em telas acima do ponto de quebra móvel (860px), de modo que nomes longos de itens de menu não sejam truncados, e SHALL ter largura reduzida quando recolhida a somente ícones.

#### Scenario: Largura em desktop
- **WHEN** a aplicação é exibida em viewport com mais de 860px de largura e a barra lateral está expandida
- **THEN** a barra lateral tem 272px de largura
- **AND** a área de conteúdo ocupa o restante da largura

#### Scenario: Barra lateral recolhida
- **WHEN** a barra lateral está recolhida em viewport com mais de 860px de largura
- **THEN** a barra lateral tem a largura reduzida definida para o estado recolhido
- **AND** a área de conteúdo ocupa o espaço liberado

#### Scenario: Layout móvel em painel
- **WHEN** a aplicação é exibida em viewport com até 860px de largura
- **THEN** a barra lateral fica oculta e abre como painel sobreposto por um botão da barra superior
- **AND** a largura de 272px não é aplicada à área de conteúdo

### Requirement: Barra de rolagem do menu discreta e no tema
A barra de rolagem do menu lateral SHALL ser fina e usar cores derivadas dos tokens do tema, de forma que acompanhe o tema claro e o escuro.

#### Scenario: Aparência da barra de rolagem
- **WHEN** o menu excede o espaço disponível e exibe rolagem
- **THEN** a barra de rolagem é fina
- **AND** suas cores vêm de variáveis de `tokens.css`, sem valores de cor fixos nos estilos do menu

#### Scenario: Troca de tema
- **WHEN** o usuário alterna entre tema claro e escuro
- **THEN** a barra de rolagem do menu acompanha as cores do tema ativo

#### Scenario: Navegador sem suporte a barra personalizada
- **WHEN** o navegador não suporta a personalização da barra de rolagem
- **THEN** o menu continua rolável com a barra nativa
