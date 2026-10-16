## Why

Os campos de seleção são `<select>` nativos. Com listas longas (instituições financeiras, municípios, parceiros, clientes, contas do plano) o usuário não consegue **filtrar digitando**: o navegador só localiza pelo *início* do texto da opção, em sequência rápida. Na conta do plano do título, onde o rótulo é `2.01.015 Aluguel`, digitar "aluguel" não encontra nada (o plano padrão já tem 84 contas analíticas de despesa e a lista cresce com a empresa). Os seletores nativos do iPhone e do Android também não têm busca, então o problema continua no celular, que passa a ser um uso esperado.

## What Changes

- Novo componente "combobox pesquisável" reutilizável, com o mesmo contrato de formulário dos campos atuais (`name`, valor lido por `fv`), filtro por digitação, teclado e acessibilidade (ARIA combobox/listbox).
- **Duas apresentações**: lista suspensa colada ao campo em telas largas e **folha de seleção em tela cheia** em telas estreitas (busca no topo, itens de toque grandes, acompanha o teclado virtual, botão Voltar fecha só a folha).
- Busca sem diferenciar acentos nem maiúsculas, por **código, nome e grupo** (por exemplo, a conta pai no plano de contas), com os melhores resultados primeiro e limite de itens exibidos.
- **Opções que mudam**: o componente aceita nova lista de fora (por exemplo, trocar "A pagar/A receber" no título refaz a lista de contas) e limpa a escolha que deixou de valer.
- **Valor definido por outro campo**: contrato `definirValor` para as telas que hoje fazem `campo.value = ...` (projeto preenche cliente, negócio preenche cliente).
- **Ação fixa no fim da lista**: preserva "+ Novo cliente…" dos formulários que criam o cliente junto com o registro.
- **Regra de uso**: combobox para listas que vêm dos dados (crescem) ou com mais de 12 itens; enumerações pequenas e fixas (status, tipo, prioridade, UF…) continuam `<select>` nativo.
- Adoção em ordem de risco: instituição financeira, conta do plano no título, parceiro e conta bancária no título, município, cliente (negócio, orçamento, projeto, tarefa), negócio e projeto, conta pai no plano de contas.

## Capabilities

### New Capabilities
- `combobox-pesquisavel`: seleção de um item de lista por digitação, em lista suspensa ou folha de seleção, com teclado, acessibilidade, opções dinâmicas, valor definido por código e estados (vazio, sem resultados, desabilitado, obrigatório).

### Modified Capabilities
<!-- nenhuma: o comportamento das telas muda só na forma de escolher o item -->

## Impact

- Frontend: novo `ui/combobox.ts` e estilos, `ui/campos.ts`, `ui/formularios.ts` (`seletorCliente`, `ligarNovoCliente`, `resolverCliente`), `features/financeiro/{contas-bancarias,titulos,plano-contas}.ts`, `features/parceiros/campos.ts`, `features/{negocios,orcamentos,projetos,tarefas}.ts`, `state/roteador.ts` (Voltar), novo token de camada em `styles/tokens.css`, `frontend/PADROES.md` e testes (unitários e e2e com viewport de celular).
- Sem mudança de API ou de banco.
- Dependência desejável de `empresa-completa-e-consulta-cnpj` (município), não obrigatória.
