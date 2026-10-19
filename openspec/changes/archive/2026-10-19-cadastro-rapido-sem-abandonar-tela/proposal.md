## Why

Em formulários com campos de relação (título → parceiro e conta bancária; orçamento → cliente e negócio; tarefa → projeto…), quando o item ainda não existe o usuário precisa abandonar a tela, cadastrar o item em outro lugar e recomeçar o preenchimento. O único atalho existente ("+ Novo cliente…") aceita só o nome e não serve para entidades com mais campos obrigatórios, como parceiro e conta bancária.

## What Changes

- Novo mecanismo geral de **cadastro rápido**: nos campos de relação (combobox), a opção "+ Novo <entidade>…" abre uma gaveta empilhada sobre a tela atual com um **formulário reduzido** (só campos obrigatórios ou chave). Ao salvar, a gaveta fecha e o item criado já fica selecionado no campo de origem, sem perder o que foi digitado.
- Quando há texto digitado na busca do campo, a opção vira "+ Cadastrar “<texto>”…" e o formulário reduzido abre com esse texto no nome/título.
- O formulário reduzido recebe o contexto da tela de origem (ex.: papel do parceiro conforme o título ser a pagar, a receber ou de aporte de sócio; cliente já escolhido para um novo negócio).
- A opção só aparece para quem tem permissão de criar a entidade (para parceiro, conforme o papel).
- A gaveta passa a suportar **empilhamento**: a gaveta de cima recebe foco, Esc e o botão Voltar do aparelho; fechá-la devolve a de baixo intacta. Profundidade máxima de um cadastro rápido (não há "+ Novo…" dentro da gaveta empilhada).
- Entidades atendidas: **cliente**, **parceiro de negócio**, **conta bancária**, **negócio** (no orçamento) e **projeto** (na tarefa).
- Telas atendidas: títulos, recorrências, negócios, orçamentos, projetos, faturamento e tarefas. Recorrências passa a usar combobox nos campos de conta bancária e parceiro.
- O atalho atual "+ Novo cliente…" (nome digitado num campo extra, cliente criado junto com o registro principal) é **substituído** pelo cadastro rápido de cliente.
- Fora do escopo: conta do plano de contas, conta "Negócio vendido" do projeto (lista só negócios ganhos), listas fixas do sistema (instituição financeira, município) e pessoas da equipe (entram por convite). Detecção de duplicidade por CPF/CNPJ e mudança na obrigatoriedade do documento também ficam de fora: valem as regras atuais.

## Capabilities

### New Capabilities
- `cadastro-rapido`: criação de um item relacionado sem sair da tela em preenchimento — gatilho no campo de relação, gaveta empilhada com formulário reduzido, contexto da origem, permissões, seleção automática do item criado e entidades/telas atendidas.

### Modified Capabilities
- `gravacao-sem-duplicidade`: o cenário "Cliente criado junto com outro registro" é substituído por "Cliente criado pelo cadastro rápido", porque o cliente passa a ser criado antes e separado da gravação do registro principal.

## Impact

- Frontend: `ui/gaveta.ts` (pilha de gavetas), `ui/combobox.ts` (ação "+ Novo…"/"+ Cadastrar “…”" e inclusão do item criado), novo módulo de cadastro rápido em `ui/`, `ui/formularios.ts` (remoção de `ligarNovoCliente`/`resolverCliente` e do campo `novo_cliente`), `features/financeiro/titulos.ts`, `features/financeiro/recorrencias.ts`, `features/negocios.ts`, `features/orcamentos.ts`, `features/projetos.ts`, `features/faturamento.ts`, `features/tarefas.ts`; `features/financeiro/contas-bancarias.ts` e `features/parceiros/campos.ts` para reaproveitar campos.
- Backend/API: nenhuma mudança prevista; o cadastro rápido usa os endpoints de criação existentes.
- Testes: unitários (vitest) para pilha de gavetas e combobox; e2e (Playwright) para o fluxo título → novo parceiro e orçamento → novo cliente.
