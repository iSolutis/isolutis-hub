## Context

Telas são HTML por template (`html\`\``) com ações por `data-act` e formulários lidos por `fv(form, name)`. Não há componente de combobox; `ui/paleta.ts` já usa o padrão ARIA combobox/listbox em captura de teclado (referência para foco e `Esc`). Listas atuais cabem inteiras no navegador (municípios: até 853 por UF; instituições: 513; plano padrão: 149 contas).

Fatos do código que moldam o desenho:
- A gaveta (`ui/gaveta.ts`) fecha com `Esc` em qualquer lugar (ouvinte no `document`, fase de bolha) e **recria o conteúdo de `#layer`**; seu `.body` rola por dentro (`overflow-y:auto`) e, em telas estreitas, ocupa a tela toda.
- Quatro pontos definem o valor de um select por código: `projetos.ts` (negócio → cliente), `tarefas.ts` (projeto → cliente), `plano-contas.ts` (natureza) e `produtos.ts` (unidade); os dois primeiros são selects que passarão a combobox.
- O roteador (`state/roteador.ts`) reage a **qualquer** `popstate`: resolve o endereço, consulta a guarda de saída e chama `ir(...)`, o que recarrega a tela e pode reabrir o registro.
- O corpo usa `font: var(--text-sm)` (14 px); campos digitáveis com menos de 16 px dão zoom automático no iOS.
- Breakpoint de celular do projeto: 860 px (`responsive.css`); pilha de camadas em tokens (`--z-gaveta:40`, `--z-modal:50`, `--z-paleta:60`).

## Goals / Non-Goals

**Goals:**
- Filtrar por digitação, escolher por mouse, toque e teclado; leitor de tela anunciando resultados.
- Drop-in no lugar do `sel(...)`: campo oculto com o valor, de modo que `fv` e a validação atuais continuam funcionando.
- Experiência no celular tão boa quanto a do seletor nativo, e melhor na busca.

**Non-Goals:**
- Busca assíncrona no servidor (listas continuam carregadas inteiras; pode vir depois).
- Seleção múltipla.
- Trocar os `<select>` de enumerações pequenas e fixas.

## Decisions

- **Componente próprio, sem biblioteca**: o projeto é vanilla TS com templates. Alternativas descartadas: `<input list>` + `<datalist>` (texto livre sem valor, estilo e acessibilidade irregulares) e elemento personalizado associado a formulário (suporte irregular nos ambientes de teste).
- **Contrato de campo**: `<input type="hidden" name=…>` guarda o valor; um `<input>` visível (com o `id` esperado pelo `<label for>`) mostra o rótulo. API do componente: `definirValor(id, {silencioso})`, `definirOpcoes(opcoes)` e evento `change` no campo oculto ao escolher. Quem hoje faz `campo.value = x` passa a chamar `definirValor`. Alternativa descartada: interceptar `.value` do campo oculto (frágil).
- **Opções como objetos** `{id, rotulo, codigo?, grupo?}`: a busca considera rótulo, código e grupo; o rótulo exibido pode compor `código + nome` com o grupo em texto secundário (na conta do plano, `Despesas administrativas › Aluguel`).
- **Opções dinâmicas**: `definirOpcoes` mantém a escolha se o item ainda existe; senão limpa o valor, restaura o campo vazio e dispara `change`. O título usa isso ao trocar entre "A pagar" e "A receber" (RN04).
- **Filtro local normalizado** (sem acento, minúsculas, `normalizarTexto` de `core/formato`) com ordenação como a da paleta de comandos: começo do código ou do nome, depois começo de palavra, depois contém. Exibe no máximo 50 itens e avisa "Digite para refinar".
- **Duas apresentações** escolhidas por `matchMedia("(max-width: 860px)")`, o mesmo limite do layout móvel:
  - **Lista suspensa** (telas largas): renderizada num portal em `document.body` com `position:fixed` ancorada ao campo (abre para cima se faltar espaço; reposiciona em rolagem e redimensionamento). Evita o corte pelo `.drawer .body` com rolagem.
  - **Folha de seleção** (telas estreitas): camada em tela cheia no `body`, com cabeçalho (voltar + título do campo), busca no topo e lista rolável; itens com no mínimo 44 px; campo de busca com 16 px; `inputmode="search"`, `enterkeyhint="done"`, sem autocorreção, sem maiúscula automática e `spellcheck=false`. Altura acompanha o teclado (`visualViewport`, com `100dvh` de reserva). Fundo sem rolagem (`overscroll-behavior: contain`).
  - Ambos no `body` e **não** em `#layer`, que a gaveta reescreve. Novo token de camada acima da gaveta e do modal (`--z-selecao`, abaixo da paleta).
- **`Esc`**: ouvinte em **fase de captura** enquanto a lista ou a folha estão abertas, com `stopImmediatePropagation`, para fechar só a lista e não a gaveta (mesma técnica de `paleta.ts`). Enter nunca envia o formulário.
- **Botão Voltar (folha)**: ao abrir, a folha cria uma entrada de histórico com o mesmo endereço e registra um ouvinte próprio de `popstate`; o roteador passa a ignorar o `popstate` que a folha reivindica (sinalizador consumido). Ao escolher um item ou fechar pela interface, a folha desfaz a entrada com `history.back()`, também sem acionar o roteador. Se a integração com o roteador se mostrar frágil, o plano de reserva é fechar apenas por controle visível e aceitar o comportamento padrão do Voltar (registrar a limitação).
- **Ação fixa no fim**: `acaoFinal: {valor, rotulo}` aparece sempre no rodapé da lista. Para cliente, `__novo` com o rótulo "+ Novo cliente…", mantendo `ligarNovoCliente` e `resolverCliente`.
- **Regra de uso** (documentada em `frontend/PADROES.md`): combobox quando a lista vem dos dados e cresce ou tem mais de 12 itens; `<select>` nativo para enumerações pequenas e fixas.
- **Acessibilidade**: no desktop, `role="combobox"` com `aria-expanded`, `aria-controls` e `aria-activedescendant`, lista com `role="listbox"` e opções `role="option"`. Na folha, diálogo modal com foco preso, rótulo do campo como título e devolução do foco ao fechar. Estilos pelos tokens (claro/escuro, foco visível, `prefers-reduced-motion`).
- **Estilo pelos tokens do design system**, sem cores fixas.

## Risks / Trade-offs

- [`Esc` ou foco fechando a gaveta] → captura com `stopImmediatePropagation` e teste de interação dentro da gaveta.
- [Voltar do navegador reabrindo ou fechando telas] → sinalizador consumido pelo roteador, teste e2e com `goBack()` e passo de investigação antes de implementar.
- [Teclado virtual do iPhone] → não é reproduzível em ambiente simulado; entra na conferência manual em aparelho real (zoom, altura, rolagem).
- [Texto digitado sem escolher item] → ao sair do campo, restaurar o rótulo do item selecionado ou limpar; nunca enviar texto livre.
- [Valor definido por código fora do contrato] → trocar todos os pontos listados em Context por `definirValor`; um teste confere que não sobra `.value =` em campo combobox.
- [Listas grandes] → limite de 50 itens exibidos; municípios (853) e instituições (513) ficam fluidos com o filtro local.
- [Regressão do `<select>` onde o nativo bastava] → a regra de uso mantém nativo nas enumerações pequenas.

## Migration Plan

Adoção em ordem crescente de risco, cada passo com teste: instituição (conta bancária), conta do plano no título, parceiro e conta bancária no título, município, cliente (negócio, orçamento, projeto, tarefa), negócio e projeto, conta pai. Sem mudança de API ou banco; reverter é trocar o campo de volta para `sel(...)`.
