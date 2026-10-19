## Why

O campo de busca da tela Plano de Contas não funciona de verdade: ele não tem o atributo `value` ligado ao estado, então a cada tecla digitada a reconstrução da tela (`render()` substitui todo o `innerHTML`) devolve o campo vazio — na prática é impossível digitar mais de um caractere por vez. A mesma tela também tem classes CSS corrompidas por aspas tipográficas (`”panel”`, `”tree”`, `”empty”`) desde 2026-10-06, que quebram o estilo da árvore. Além disso, a tela de Tarefas monta seu campo de busca à mão em vez de usar o componente padrão `barraDeFerramentas`, e a função que liga esses campos ao estado (`ligarBuscas`, em `main.ts`) usa uma lista de chaves fixa no código que já está desatualizada (esqueceu `buscaPlano`), um risco que se repete a cada novo campo de busca adicionado sem tocar nela.

## What Changes

- Plano de Contas passa a usar `cabecalhoDePagina` (título, descrição, botão "+ Nova Conta Raiz") seguido do componente `barraDeFerramentas` para o campo de busca, eliminando o `<input>` solto sem `value` e corrigindo o bug de digitação.
- Correção das classes CSS corrompidas (aspas tipográficas) na mesma tela, trocando o contêiner `.panel` por `.painel-lista` para ficar consistente com as demais listagens.
- Tarefas passa a usar `cabecalhoDePagina` e `barraDeFerramentas` para seu campo de busca, no lugar do `<input>` montado à mão dentro de `.tools`. O filtro por pessoa (`.seg`) continua como uma linha própria abaixo da barra de ferramentas, sem mudança de comportamento.
- `OpcoesCabecalho.descricao` (em `componentes.ts`) passa a aceitar `string | Safe`, para permitir que a descrição de Tarefas inclua o resumo com destaque em negrito (ex.: "3 atrasadas").
- `ligarBuscas` (em `main.ts`) deixa de depender de uma lista de chaves fixa no tipo; a chave vinda de `data-busca` passa a ser validada contra as chaves reais do objeto `ui`, cobrindo automaticamente qualquer campo de busca presente ou futuro.

## Capabilities

### New Capabilities
(nenhuma)

### Modified Capabilities
- `plano-contas-view`: a estrutura do cabeçalho muda — o campo de busca deixa de estar dentro do bloco de título e passa a ficar numa barra de ferramentas própria, imediatamente abaixo do cabeçalho e antes da árvore.
- `plano-contas-search`: fica explícito que o campo de busca preserva o texto digitado e a posição do cursor após cada nova renderização (o requisito já existia; esta mudança corrige a implementação que o violava).
- `componentes-crm`: o requisito de "Barra de ferramentas de listagem" passa a cobrir explicitamente listagens que não são tabelas (árvore, quadro kanban), e esclarece que outros filtros específicos da tela podem continuar numa linha própria, separada da barra de ferramentas, quando não cabem nela.

## Impact

- Código afetado: `frontend/src/features/financeiro/plano-contas.ts`, `frontend/src/features/tarefas.ts`, `frontend/src/ui/componentes.ts`, `frontend/src/main.ts`.
- Sem mudança de API de backend nem de schema de dados.
- Sem mudança de comportamento de negócio: filtros, ordenação e ações continuam iguais; só a montagem visual do campo de busca e do cabeçalho muda.
- Risco principal: regressão visual/acessível no cabeçalho das duas telas durante a migração — mitigado por verificação manual nos dois temas e em largura de celular.
