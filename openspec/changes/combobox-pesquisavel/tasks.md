## 1. Componente base

- [x] 1.1 Investigar `state/roteador.ts` (`popstate`, guarda de saída) e `ui/gaveta.ts` (`Esc`, `#layer`) e registrar no `design.md` a integração escolhida para o Voltar e o `Esc`; verificar com a nota no design e com os arquivos citados
- [x] 1.2 Criar `ui/combobox.ts`: campo visível + campo oculto, `definirValor`, `definirOpcoes`, evento `change`, estados (desabilitado, obrigatório, vazio, valor inicial); verificar com testes unitários do contrato (restaurar rótulo ao sair, nunca enviar texto livre, valor inicial na edição)
- [x] 1.3 Filtro normalizado por rótulo, código e grupo, com ordenação e limite de 50 itens; verificar com testes do filtro (acento, caixa, código, grupo, ordem, limite, "Digite para refinar")
- [x] 1.4 Teclado e ARIA (setas, Enter, Esc em fase de captura, Tab) sem enviar o formulário; verificar com teste de interação, incluindo `Esc` dentro de uma gaveta fechando só a lista
- [x] 1.5 Lista suspensa em portal no `body` com posicionamento (abre para cima, rolagem, redimensionamento); verificar com teste e2e de um campo no fim de uma gaveta rolável
- [x] 1.6 Ação fixa no fim da lista (`acaoFinal`); verificar com teste de que ela permanece visível com filtro ativo e sem resultados
- [x] 1.7 Estilos pelos tokens (claro e escuro, foco, vazio, `prefers-reduced-motion`) e o novo token de camada `--z-selecao`; verificar visualmente nos dois temas

## 2. Telas pequenas

- [x] 2.1 Folha de seleção em tela cheia no `body` (cabeçalho com voltar, busca no topo, itens de 44 px, busca com 16 px, atributos do campo, foco preso e devolvido); verificar com e2e em viewport de celular (abrir, filtrar, escolher, valor no formulário)
- [x] 2.2 Altura da folha acompanhando o teclado (`visualViewport` com `100dvh` de reserva) e fundo sem rolagem; verificar com e2e em celular simulado
- [x] 2.3 Botão Voltar fechando só a folha (entrada de histórico própria e `popstate` reivindicado pelo componente, ignorado pelo roteador); verificar com e2e `goBack()` mantendo gaveta, tela e dados digitados
- [x] 2.4 Escolha por `matchMedia("(max-width: 860px)")` entre lista suspensa e folha, reagindo à mudança de tamanho; verificar com teste unitário e e2e
- [x] 2.5 Documentar a regra de uso (combobox ou nativo) e o contrato do componente em `frontend/PADROES.md`; verificar lendo o texto e conferindo as telas atuais contra a regra

## 3. Adoção

- [x] 3.1 Instituição financeira em `contas-bancarias.ts`, incluindo edição com valor atual; verificar com teste e conferência na tela
- [x] 3.2 Conta do plano no título, com grupo pai no texto e `definirOpcoes` ao trocar o tipo (RN04); verificar com teste: digitar "alug" acha "Aluguel", trocar "A pagar/A receber" refaz a lista e limpa a escolha inválida
- [x] 3.3 Parceiro e conta bancária no título; verificar com teste de filtro por nome e por documento
- [x] 3.4 Município em `parceiros/campos.ts`, com `definirOpcoes` ao trocar a UF; verificar com teste de troca de UF e valor inicial na edição
- [x] 3.5 Cliente em negócio, orçamento, projeto e tarefa (`seletorCliente`/`opcoesClientes`), mantendo "+ Novo cliente…" e trocando `campo.value = …` por `definirValor` em `projetos.ts` e `tarefas.ts`; verificar com teste de que negócio preenche o cliente e de que criar cliente novo continua funcionando
- [x] 3.6 Negócio (orçamento e projeto) e projeto (tarefa); verificar com teste de filtro e de edição com valor atual
- [x] 3.7 Conta pai em `plano-contas.ts`, preservando a herança da natureza; verificar com teste de que escolher a conta pai preenche a natureza

## 4. Validação

- [x] 4.1 Rodar testes do front, lint, tipos e e2e em viewport de celular, e revisar o diff; verificar com tudo verde e nenhum `.value =` restante em campo combobox — vitest, tsc e e2e (chromium + mobile) verdes; falhas de lint e do teste `validators` são anteriores a esta mudança. As telas das tarefas 3.x foram adotadas e conferidas por tipos; só a instituição tem e2e próprio — conferir as demais no uso (4.2)
- [ ] 4.2 Conferência em aparelhos reais (iPhone e Android): zoom ao tocar, teclado cobrindo a lista, botão Voltar e tema escuro; verificar com a lista de itens marcada pelo usuário
