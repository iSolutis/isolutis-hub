## 1. Pilha de gavetas

- [x] 1.1 Levantar os pontos que buscam `#gform`, `.drawer` ou `#layer` globalmente e passá-los a usar a camada/formulário recebidos em `montar`
- [x] 1.2 Refatorar `abrirGaveta` para empilhar uma camada por gaveta em `#layer`, mantendo a API `abrirGaveta(o) → fechar` inalterada
- [x] 1.3 `Esc` só fecha a gaveta do topo; gavetas abaixo ficam com `inert`; o foco volta ao elemento que abriu a gaveta de cima
- [x] 1.4 Gaveta empilhada registra `abrirCamada` para o Voltar do aparelho fechar só ela
- [x] 1.5 Estilo da gaveta empilhada (deslocamento/sombra sobre a de baixo, inclusive em tela estreita)
- [x] 1.6 Testes unitários: abrir duas gavetas, Esc fecha só a de cima, valores da de baixo preservados, registro aberto restaurado

## 2. Mecanismo de cadastro rápido

- [x] 2.1 Criar `ui/cadastro-rapido.ts` com o registro de definições por entidade e `abrirCadastroRapido(tipo, contexto) → Promise<OpcaoCriada | null>` (gaveta empilhada, `gravar`, `aceito`, sinalizador de profundidade 1)
- [x] 2.2 Adicionar `cadastroRapido` a `OpcoesCombobox`: gera a ação "+ Novo <rótulo>…" / "+ Cadastrar “<consulta>”…" quando `pode(ctx)` e fora de outro cadastro rápido
- [x] 2.3 Ao escolher a ação: fechar lista/folha, abrir o cadastro com contexto avaliado no clique e sugestão da consulta; com o resultado, incluir a opção e selecioná-la emitindo `change`; se não `aceito`, avisar e não selecionar
- [x] 2.4 Testes unitários do combobox: rótulo da ação com e sem consulta, ação ausente sem permissão ou dentro de cadastro rápido, inclusão e seleção do item criado

## 3. Formulários reduzidos por entidade

- [x] 3.1 Parceiro: variante reduzida de `camposDoParceiro` (nome, tipo de pessoa, CPF/CNPJ, papéis, participação) e ajuste de `ligarCamposDoParceiro`/`lerCamposDoParceiro` para campos ausentes; definição com papel sugerido pelo contexto (tipo do título, conta de aporte), `pode` por papel e `aceito` com `parceirosParaTitulo`
- [x] 3.2 Cliente: definição com papel fixo "cliente", API de clientes, permissão do comercial e nome vindo da sugestão
- [x] 3.3 Conta bancária: extrair campos e leitura/validação de `formConta` para reuso no formulário completo e no reduzido; definição com permissão do financeiro
- [x] 3.4 Negócio: definição com título e cliente (cliente da origem pré-preenchido), conferindo na API os campos exigidos na criação
- [x] 3.5 Projeto: definição com nome e cliente (cliente da tarefa pré-preenchido), sem cadastro rápido no campo cliente

## 4. Ligação nas telas

- [x] 4.1 Títulos: cadastro rápido em Parceiro de negócio e Conta bancária; incluir o parceiro criado na lista em memória usada por `refazerParceiros`
- [x] 4.2 Recorrências: trocar `<select>` de conta bancária e parceiro por combobox (mesmo filtro do título) e ligar o cadastro rápido
- [x] 4.3 Cliente via `seletorCliente`/`comboboxClientes` com cadastro rápido; remover `ligarNovoCliente`, `resolverCliente` e o input `novo_cliente`; ajustar negócios, orçamentos, projetos, faturamento e tarefas para ler `cliente_id` diretamente
- [x] 4.4 Orçamentos: cadastro rápido em Negócio, com o cliente do orçamento no contexto; confirmar que a lista de negócios reage ao cliente criado
- [x] 4.5 Tarefas: cadastro rápido em Projeto
- [x] 4.6 Conferir que plano de contas, conta pai, "Negócio vendido", instituição e município não oferecem a opção

## 5. Validação

- [x] 5.1 `npm run typecheck`, `npm run lint` e `npm test` no frontend
- [x] 5.2 E2E: título → "+ Novo parceiro…" → salvar → parceiro selecionado e valores do título preservados
- [x] 5.3 E2E: orçamento (gaveta) → "+ Novo cliente…" → cliente selecionado em formulário reduzido; falha no salvar do orçamento e nova tentativa não duplica o cliente
- [x] 5.4 Verificação em tela estreita (e2e com viewport de 390 px): folha de seleção → cadastro rápido → Voltar do aparelho fecha só a gaveta empilhada
