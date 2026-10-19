## MODIFIED Requirements

### Requirement: Barra de ferramentas de listagem
Listagens com busca ou filtros SHALL agrupar o campo de busca numa barra de ferramentas acima do conteúdo da listagem — seja ele uma tabela, uma árvore ou um quadro —, com a contagem de resultados quando aplicável. Filtros específicos de uma tela que não caibam na barra (por exemplo, uma lista de botões por pessoa que cresce com o tamanho da equipe) PODEM continuar numa linha própria, separada da barra de ferramentas.

#### Scenario: Busca e contagem numa listagem em tabela
- **WHEN** o usuário digita no campo de busca de uma listagem em tabela
- **THEN** a tabela mostra apenas os resultados correspondentes
- **AND** a barra informa a quantidade de resultados exibidos

#### Scenario: Busca numa listagem em árvore
- **WHEN** o usuário digita no campo de busca de uma listagem em árvore
- **THEN** a árvore mostra apenas os nós correspondentes, mantendo a hierarquia
- **AND** o campo de busca fica na barra de ferramentas, imediatamente acima da árvore

#### Scenario: Filtro adicional fora da barra de ferramentas
- **WHEN** uma tela tem, além da busca, um filtro que não cabe na barra (por exemplo, um filtro por pessoa com um botão por membro da equipe)
- **THEN** esse filtro pode ser exibido numa linha própria, abaixo da barra de ferramentas
- **AND** a busca continua funcionando normalmente dentro da barra de ferramentas
