## Context

Hoje existem 4 campos de busca no app (`busca`, `tarefaBusca`, `buscaFin`, `buscaPlano`), ligados por `ligarBuscas()` em `main.ts`. Como o `render()` do app (`state/nucleo.ts`) substitui todo o `innerHTML` da tela a cada renderização, qualquer campo de busca precisa declarar `value="${estado}"` no próprio template — senão o valor digitado se perde no próximo render. Clientes e Parceiros já usam o componente compartilhado `barraDeFerramentas` (`ui/componentes.ts`), que sempre inclui esse `value`. Plano de Contas e Tarefas montam o campo à mão; Plano de Contas esqueceu o `value` (bug real: o campo se esvazia a cada tecla) e Tarefas, embora tenha o `value` certo, duplica markup que já existe no componente compartilhado.

`ligarBuscas()` também lê `data-busca` e faz `as "busca" | "tarefaBusca" | "buscaFin" | undefined` — uma lista fixa que já esqueceu `buscaPlano`. Funciona em runtime porque é apenas uma anotação de tipo sem checagem (a atribuição em `ui[chave]` é feita dinamicamente), mas qualquer novo campo de busca pode repetir o mesmo problema sem o TypeScript avisar.

## Goals / Non-Goals

**Goals:**
- Corrigir o bug de digitação em Plano de Contas (campo que se esvazia a cada tecla).
- Unificar os 4 campos de busca existentes sob `cabecalhoDePagina` + `barraDeFerramentas`, removendo os dois `<input>` montados à mão.
- Corrigir as classes CSS corrompidas por aspas tipográficas em `plano-contas.ts`.
- Eliminar a lista de chaves fixa em `ligarBuscas`, validando a chave contra as chaves reais de `ui`.
- Permitir que `cabecalhoDePagina` receba descrição com HTML controlado (`Safe`), sem perder a tipagem segura por padrão do sistema de templates.

**Non-Goals:**
- Não implementa busca "inteligente" (multi-termo, ranking, acento-insensível) — fica para uma proposta seguinte, que pode reaproveitar `filtrarOpcoes` de `ui/combobox.ts`.
- Não adiciona busca a telas que hoje não têm (Negócios, Orçamentos, Produtos, Projetos, Equipe).
- Não altera o comportamento de filtragem em si (os critérios de busca de cada tela continuam os mesmos); só a montagem da UI do campo.

## Decisions

### 1. `OpcoesCabecalho.descricao` aceita `string | Safe`
Tarefas monta a descrição do cabeçalho com um trecho em negrito (`<b>N atrasadas</b>`), condicional. O motor de templates (`core/html.ts`) já trata qualquer valor `Safe` como HTML confiável em qualquer posição onde é interpolado — então basta alargar o tipo do campo; não é preciso mudar `cabecalhoDePagina`. Alternativa descartada: manter `descricao: string` e mover o resumo com negrito para um elemento separado abaixo do cabeçalho — rejeitada por fragmentar visualmente o que hoje é uma frase única.

### 2. Filtro por pessoa em Tarefas continua fora do `barraDeFerramentas`
O slot `filtros` do `barraDeFerramentas` aceita qualquer `Safe`, então tecnicamente o bloco `.seg` (um botão por membro da equipe) poderia entrar lá. Decisão: mantê-lo como linha própria abaixo da barra de ferramentas, sem mudança de comportamento. Motivo: a lista de pessoas cresce com o tamanho da equipe (pode ultrapassar 10+ botões) e o `.seg` já tem `flex-wrap` pensado para isso; comprimir isso na mesma linha da busca e da contagem apertaria a barra em telas estreitas. Alternativa descartada: mover para dentro do `filtros` — rejeitada por esse motivo.

### 3. Plano de Contas troca `.panel` por `.painel-lista`
`.painel-lista` é a classe usada por Clientes e Parceiros para envolver `barraDeFerramentas` + conteúdo da listagem (sem padding próprio, com borda inferior na barra). `.panel` tem padding uniforme pensado para conteúdo sem barra de ferramentas interna. Trocar para `.painel-lista` mantém a árvore visualmente consistente com as demais listagens que usam busca.

### 4. `ligarBuscas` valida a chave contra `ui` em vez de um union hardcoded
Troca `campo.dataset.busca as "busca" | "tarefaBusca" | "buscaFin" | undefined` por uma checagem como `const chave = campo.dataset.busca; if (!chave || !(chave in ui)) return;`, com a chave tipada via `keyof typeof ui` após a checagem. Isso remove a lista fixa sem exigir nenhuma mudança quando um novo campo de busca for criado — a validação passa a ser sobre o próprio objeto `ui`, a fonte de verdade.

## Risks / Trade-offs

- [Risco] Mover o campo de busca para fora do `.head` em Plano de Contas e Tarefas pode mudar sutilmente o espaçamento visual aprendido pelos usuários → Mitigação: reaproveitar exatamente as classes (`.painel-lista`, `.tbar`) já usadas e validadas em Clientes/Parceiros, então o resultado visual é o padrão já conhecido no resto do app, não algo novo.
- [Risco] Alargar `OpcoesCabecalho.descricao` para `string | Safe` pode mascarar, no futuro, a passagem acidental de HTML não escapado por engano → Mitigação: `Safe` só é produzido por `html` ou `raw()`, nunca por concatenação de string crua; o risco de escape esquecido já é coberto pelo design existente do sistema de templates.
- [Risco] Corrigir as aspas tipográficas e reestruturar o bloco de `plano-contas.ts` ao mesmo tempo dificulta isolar visualmente qual parte do diff é "correção de bug" vs. "refactor de UI" → Mitigação: ambas as mudanças tocam as mesmas linhas de qualquer forma (o bloco inteiro está sendo reescrito), então não há como separar sem reescrever duas vezes; o commit deixa claro as duas motivações.
