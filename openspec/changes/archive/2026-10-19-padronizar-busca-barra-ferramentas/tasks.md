## 1. Componente compartilhado

- [x] 1.1 Em `frontend/src/ui/componentes.ts`, importar `Safe` de `@/core/html` e alargar `OpcoesCabecalho.descricao` para `string | Safe`.
- [x] 1.2 Confirmar que `cabecalhoDePagina` continua funcionando sem alterações (o template já trata `Safe` como HTML confiável via `interpolar`).

## 2. `main.ts` — generalizar `ligarBuscas`

- [x] 2.1 Trocar `campo.dataset.busca as "busca" | "tarefaBusca" | "buscaFin" | undefined` por uma validação contra as chaves reais de `ui` (ex.: `if (!chave || !(chave in ui)) return;`, com `chave` tipado via `keyof typeof ui` depois da checagem).
- [x] 2.2 Confirmar que o comportamento atual continua igual: atualizar `ui[chave]`, re-renderizar, devolver foco e posição do cursor ao campo (`buscaPlano` passa a funcionar sem exigir nenhuma mudança adicional aqui).

## 3. Plano de Contas

- [x] 3.1 Em `frontend/src/features/financeiro/plano-contas.ts`, importar `cabecalhoDePagina` e `barraDeFerramentas` de `@/ui/componentes`.
- [x] 3.2 Remover o `<input class="search">` montado à mão dentro do `.head` e o `<div style="margin-top:8px">` que o envolvia.
- [x] 3.3 Montar o cabeçalho com `cabecalhoDePagina({ titulo: "Plano de contas", descricao: "Até três níveis (1 · 1.01 · 1.01.001). Só contas analíticas recebem lançamentos.", acoes: <botão "+ Nova Conta Raiz"> })`.
- [x] 3.4 Logo abaixo do cabeçalho, adicionar `barraDeFerramentas({ busca: { chave: "buscaPlano", valor: ui.buscaPlano, placeholder: "Pesquisar contas...", rotulo: "Pesquisar contas por código ou nome" } })`.
- [x] 3.5 Trocar o wrapper `.panel` da árvore por `.painel-lista`, mantendo `<ul class="tree" role="tree" aria-label="Plano de contas">` dentro dele.
- [x] 3.6 Corrigir as aspas tipográficas corrompidas (`”…”`) para aspas retas normais em todo o bloco reescrito (classes `panel`/`painel-lista`, `tree`, `empty`, `btn primary`, atributos `role`, `aria-label`, `data-act`).
- [x] 3.7 Manter o estado vazio (`Plano de contas vazio` / botão "Criar a primeira conta") funcionando como antes, só com as aspas corrigidas.

## 4. Tarefas

- [x] 4.1 Em `frontend/src/features/tarefas.ts`, importar `cabecalhoDePagina` e `barraDeFerramentas` de `@/ui/componentes`.
- [x] 4.2 Remover o `<input class="search" id="tbusca">` e o `<div class="tools">` que hoje mistura busca e botão "Nova tarefa" dentro do `.head`.
- [x] 4.3 Montar o cabeçalho com `cabecalhoDePagina({ titulo: "Tarefas da equipe", descricao: <Safe com o resumo atual, incluindo "<b>N atrasadas</b>" quando houver>, acoes: botaoNovo("novaTarefa", "Nova tarefa") })`.
- [x] 4.4 Logo abaixo do cabeçalho, adicionar `barraDeFerramentas({ busca: { chave: "tarefaBusca", valor: ui.tarefaBusca, placeholder: "Buscar tarefa, cliente ou projeto", rotulo: "Buscar tarefas" } })`.
- [x] 4.5 Manter o bloco `.seg` de filtro por pessoa exatamente como está hoje, como uma linha própria abaixo da barra de ferramentas (sem mudança de comportamento).
- [x] 4.6 Confirmar que o quadro kanban (`.board.tboard`) e o estado vazio continuam inalterados.

## 5. Verificação

- [x] 5.1 Checar tipos com o compilador TypeScript do frontend (`tsc --noEmit` ou equivalente do projeto) e corrigir quaisquer erros de tipo introduzidos.
- [x] 5.2 Rodar a suíte de testes do frontend, se existir cobertura para essas telas ou para `componentes.ts`/`main.ts`.
- [x] 5.3 Testar manualmente em Plano de Contas: digitar uma busca de mais de um caractere e confirmar que o texto permanece visível no campo e a árvore filtra corretamente em tempo real.
- [x] 5.4 Testar manualmente em Tarefas: confirmar que a busca, o filtro por pessoa e o resumo com "N atrasadas" em negrito continuam funcionando.
- [x] 5.5 Verificar visualmente as duas telas em tema claro, tema escuro e largura de celular (sem texto ilegível, sobreposição ou rolagem horizontal da página).

## 6. OpenSpec

- [x] 6.1 Validar a change com `openspec validate --changes padronizar-busca-barra-ferramentas`.
- [x] 6.2 Após a verificação manual, arquivar a change com `openspec archive`.
