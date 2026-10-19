## Context

- Frontend em TypeScript sem framework: HTML por template (`core/html.ts`), comportamento ligado por delegação de eventos.
- Os campos de relação usam o combobox pesquisável (`ui/combobox.ts`), que já tem `acaoFinal` (opção fixa no fim da lista, visível com filtro) e um controlador por campo (`comboboxDe(form, nome)` com `definirOpcoes`/`definirValor`). Recorrências ainda usa `<select>` nativo para conta bancária e parceiro.
- Hoje "+ Novo cliente…" (`ui/formularios.ts`: `seletorCliente`, `ligarNovoCliente`, `resolverCliente`) mostra um input "Nome da empresa" e cria o cliente só ao salvar o registro principal.
- A gaveta (`ui/gaveta.ts`) é slot único: `#layer.innerHTML = …`. Abrir outra gaveta destrói a anterior; o `Esc` é ouvido no `document` e fecharia tudo.
- Já existem peças de empilhamento: `abrirRegistro`/`fecharRegistro` (`ui/registro-aberto.ts`) devolvem e restauram o registro anterior; `abrirCamada` (`state/voltar.ts`) empilha entradas de histórico para o botão Voltar.
- `gravar()` (`ui/gravacao.ts`) chama `recarregar(...)`, que redesenha `#main`. O formulário em página trava esse redesenho (`travarConteudo`); a gaveta vive em `#layer`, fora do redesenho.
- Campos de parceiro já são reutilizáveis (`features/parceiros/campos.ts`: `camposDoParceiro`, `ligarCamposDoParceiro`, `lerCamposDoParceiro`). Conta bancária, negócio e projeto têm os campos embutidos nas próprias telas.

## Goals / Non-Goals

**Goals:**
- Um único mecanismo, declarativo no campo, para criar item relacionado sem sair da tela.
- Gaveta empilhável com foco, Esc e Voltar corretos por camada.
- Formulários reduzidos que reaproveitam marcação, máscara e validação dos cadastros completos.
- Substituir o atalho "+ Novo cliente…" atual.

**Non-Goals:**
- Plano de contas, "Negócio vendido", listas fixas e pessoas da equipe.
- Mudanças no backend ou nos contratos da API.
- Detecção de duplicidade por CPF/CNPJ e mudança na obrigatoriedade do documento.
- Empilhamento com mais de um nível de cadastro rápido.

## Decisions

### 1. Gaveta empilhada, não campos inline nem "sair e voltar"
O cadastro abre numa segunda gaveta sobre a atual.
- *Campos inline* (modelo atual do cliente) não comportam entidades com vários campos obrigatórios e duplicam regras.
- *Navegar e voltar com rascunho* exigiria persistir rascunhos, rotas de retorno e guarda de saída, e ainda passaria a sensação de abandono.

### 2. `#layer` vira pilha de gavetas
`abrirGaveta` deixa de substituir `#layer.innerHTML` e passa a acrescentar um elemento de camada (scrim + drawer) por gaveta, mantendo uma pilha em memória.
- Só a gaveta do topo trata `Esc`: o ouvinte confere se a sua camada é a do topo antes de fechar. Abaixo dela, a gaveta fica com `inert` e a gaveta de cima recebe um deslocamento/sombra visual que mostra a de baixo.
- A gaveta empilhada registra `abrirCamada` para o Voltar do aparelho fechar só ela; a gaveta de base mantém o comportamento atual.
- `abrirRegistro`/`fecharRegistro` são chamados por gaveta, como hoje; a restauração do anterior já cobre o empilhamento. O cadastro rápido sempre é registro novo (`registro: null`), então não interfere em conflito/presença do registro de baixo.
- A API pública (`abrirGaveta(o) → fechar`) não muda; os chamadores atuais continuam funcionando.
- O `id="gform"` deixa de ser único: as funções que o buscam passam a usar a referência do formulário da própria camada.

### 3. Registro de "cadastros rápidos" por entidade
Novo módulo `ui/cadastro-rapido.ts` com um registro `Map<tipo, DefinicaoCadastroRapido>` e a função `abrirCadastroRapido(tipo, contexto) → Promise<OpcaoCriada | null>`. Cada entidade declara, no seu próprio módulo de feature:

```ts
interface DefinicaoCadastroRapido<C, T> {
  rotulo: string;                     // "parceiro" → "+ Novo parceiro…"
  pode(ctx: C): boolean;              // permissão + papéis compatíveis
  campos(ctx: C): Safe;               // formulário reduzido (sem "+ Novo…" dentro)
  ligar?(form: HTMLFormElement, ctx: C): void;
  ler(form: HTMLFormElement, ctx: C): Entrada | null;  // null = já avisou
  criar(dados): Promise<T>;           // endpoint de criação existente
  opcao(criado: T): OpcaoCombobox;    // como aparece no campo de origem
  aceito?(criado: T, ctx: C): boolean;// compatível com o filtro da origem
  recarregar: string[];               // coleções a atualizar em segundo plano
}
```

Alternativa descartada: um componente genérico guiado por schema de campos. Seria uma abstração nova para cinco formulários pequenos, e cada um tem particularidades (máscara de documento, papéis, participação).

### 4. Gatilho declarado no combobox
`OpcoesCombobox` ganha `cadastroRapido?: { tipo: string; contexto?: () => unknown }`. Quando presente e `pode(ctx)` for verdadeiro:
- o combobox gera a ação final com o rótulo "+ Novo <rotulo>…" ou, com consulta não vazia, "+ Cadastrar “<consulta>”…";
- ao escolher a ação, o combobox **não** grava valor sentinela (diferente do `__novo` atual): fecha a lista/folha, chama `abrirCadastroRapido` com `{ ...contexto(), sugestao: consulta }` e, com o resultado, inclui a opção (`definirOpcoes([...atuais, opcao], { valor: id })`), emitindo `change`.
- se `aceito` for falso, avisa por toast e não seleciona.
- o contexto é uma função, avaliada na hora do clique, para refletir o estado atual do formulário (tipo do título, conta de aporte, cliente escolhido).
- Profundidade 1: `abrirCadastroRapido` marca um sinalizador enquanto a gaveta empilhada estiver aberta; com ele ativo, o combobox não gera a ação.

O `acaoFinal` atual permanece como mecanismo de baixo nível; o cadastro rápido o usa.

### 5. Recarga após criar
A criação usa `gravar` (trava do botão Salvar, idempotência, toast, fechar). As coleções globais (`clientes`, `financeiro`) são recarregadas em segundo plano como hoje. A tela de origem não depende disso: o item criado é injetado diretamente no combobox. A gaveta de origem vive em `#layer` e o formulário em página trava o redesenho, então a recarga não apaga valores digitados. As listas em memória das telas (ex.: `parceiros` capturado em `formTitulo`) recebem o item criado para que filtros recalculados (`refazerParceiros`) não o removam.

### 6. Formulários reduzidos reaproveitando os completos
- **Parceiro/Cliente:** `camposDoParceiro` ganha uma variante reduzida (nome, tipo de pessoa, CPF/CNPJ, papéis, participação) que reaproveita `camposSoltos`; `ligarCamposDoParceiro` e `lerCamposDoParceiro` já toleram campos ausentes (município, UF) ou são ajustados para isso. Cliente usa papel fixo "cliente" e a API de clientes, como a tela de clientes.
- **Conta bancária:** extrair de `formConta` os campos e a leitura/validação para funções reutilizadas pelo formulário completo e pelo reduzido (são os mesmos três campos).
- **Negócio/Projeto:** formulário reduzido próprio (título/nome + cliente), com etapa e demais campos nos padrões que a API já aplica na criação.

### 7. Migração do "+ Novo cliente…"
`seletorCliente` passa a usar `cadastroRapido: { tipo: "cliente" }`; `ligarNovoCliente`, `resolverCliente` e o input `novo_cliente` são removidos, e as telas (negócios, orçamentos, projetos, faturamento) leem `cliente_id` diretamente. `comboboxClientes` em tarefas passa a oferecer o cadastro rápido.

### 8. Recorrências passam a usar combobox
Conta bancária e parceiro em `recorrencias.ts` trocam `<select>` por combobox, com a mesma regra de filtro de parceiros do título. É pré-requisito para o gatilho e alinha a tela com o título.

## Risks / Trade-offs

- [Mudar a gaveta afeta todas as telas] → Manter a API `abrirGaveta` idêntica; testes unitários de pilha (abrir/fechar/Esc/foco) e regressão e2e numa gaveta comum antes de ligar o cadastro rápido.
- [Ouvintes que procuram `#gform` ou `.drawer` globalmente pegam a gaveta errada] → Levantar e corrigir esses pontos para usar a camada recebida em `montar`.
- [`gravar` tem trava global (`emAndamento`)] → Só uma gravação por vez já é o comportamento desejado; o Salvar da gaveta de baixo fica inerte enquanto a de cima está aberta.
- [Item criado incompatível com o filtro da origem] → Contexto pré-marca o papel; `aceito` avisa quando o usuário altera e o item não serve.
- [Opção visível sem permissão real no servidor] → `pode` só esconde a opção; o servidor continua validando e o erro aparece na gaveta.
- [Cadastros incompletos (sem endereço, contato)] → Aceito por decisão de produto; o cadastro completo continua disponível para complementar.
- [Remover `resolverCliente` muda o fluxo de quatro telas] → Coberto pelo cenário de não duplicidade e por e2e de orçamento → novo cliente.

## Migration Plan

Mudança só de frontend, sem dados a migrar. Entrega em ordem: pilha de gavetas → módulo de cadastro rápido + gatilho no combobox → entidades (parceiro, conta bancária, cliente, negócio, projeto) → telas → remoção do atalho antigo. Rollback: reverter o deploy do frontend.

## Open Questions

- Nenhuma bloqueante. Ponto a verificar na implementação: se a criação de negócio pela API exige campos além de título e cliente (etapa, responsável); se exigir, usar os mesmos padrões do formulário completo.
