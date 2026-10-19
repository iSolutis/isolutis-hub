## Context

O frontend do Hub é TypeScript puro (sem framework), com HTML montado via template strings (`core/html.ts`) e formulários abertos numa gaveta lateral comum (`ui/gaveta.ts` → `abrirGaveta`). Já existe um precedente direto para este tipo de máscara: `ui/documento.ts`, que mascara CPF/CNPJ durante a digitação e é ligado manualmente, tela a tela, pelas próprias features (`parceiros/campos.ts`, `empresa.ts`).

Os campos monetários atuais usam `inp(nome, paraCampo(valor), 'inputmode="decimal" placeholder="0,00"')`: um `<input>` de texto comum, sem máscara. O usuário digita o valor com vírgula decimal livre (ex.: `1500,5`), e `numero()` (`core/numero.ts`) já sabe interpretar tanto `1500,5` quanto `1.500,50` (milhar com ponto, decimal com vírgula) na hora de salvar. Isso significa que a formatação visual pode mudar sem exigir nenhuma mudança no parsing já existente.

Os mesmos `inputmode="decimal"` também aparecem em campos que **não** são dinheiro: quantidade de item de orçamento (`qtd`) e percentual de participação societária. Qualquer mecanismo de ligação automática da máscara precisa diferenciar esses campos de forma explícita, não por heurística de atributo.

## Goals / Non-Goals

**Goals:**
- Máscara monetária "estilo caixa eletrônico" (dígitos entram pela direita, como centavos) em todo campo que representa valor em reais, com separador de milhar e vírgula decimal, enquanto o usuário digita.
- Reaproveitar o utilitário de reaplicação de máscara com preservação de cursor já existente (`reaplicarMascara`), em vez de duplicá-lo.
- Um único ponto de ligação automática para os formulários em gaveta, para que nenhuma tela precise lembrar de ligar a máscara manualmente — reduz o risco de um campo monetário novo "esquecer" a máscara.
- Cobrir também os dois pontos fora do ciclo padrão de gaveta onde campos monetários são criados dinamicamente: a tabela de itens do orçamento e as linhas de produto do onboarding.
- Nenhuma mudança de contrato com o backend: o valor salvo continua sendo o número já convertido por `numero()`.

**Non-Goals:**
- Não mascarar os campos de quantidade (`qtd`) ou percentual (`participacao_percentual`) — continuam como estão.
- Não migrar o projeto para uma lib de máscara de terceiros (ex.: IMask) — o padrão do projeto é zero-dependência para isso (ver `ui/documento.ts`), e a lógica de máscara monetária é simples o suficiente para não justificar uma nova dependência.
- Não alterar a formatação de exibição somente-leitura (`brl`, `brlCurto` em `core/formato.ts`) — já estão corretas e fora do escopo (não são campos de formulário).

## Decisions

### 1. Algoritmo da máscara: "centavos entram pela direita"
`mascararMoeda(valor: string): string` descarta tudo que não é dígito, interpreta a string de dígitos resultante como centavos (os últimos 2 dígitos são sempre os centavos) e formata com separador de milhar e vírgula decimal. Exemplo: digitar `1`, `5`, `0`, `0`, `0`, `0` produz sucessivamente `0,01` → `0,15` → `1,50` → `15,00` → `150,00` → `1.500,00`.

Alternativa considerada — manter a entrada como decimal livre (usuário digita a vírgula) e só formatar o agrupamento de milhar: mais parecido com o que existe hoje, mas não é reconhecível como "máscara monetária" (o pedido do usuário) e não resolve o erro mais comum (errar a posição da vírgula). O padrão "centavos pela direita" é o que apps bancários brasileiros usam e elimina esse erro por construção: é impossível digitar um valor com a vírgula no lugar errado.

### 2. Extrair `reaplicarMascara` para um módulo compartilhado
`reaplicarMascara(campo, mascarar)` (hoje em `ui/documento.ts`) não depende de nada específico de CPF/CNPJ — já é genérica. Ela move para `ui/mascara.ts`, e `ui/documento.ts` reexporta o símbolo para não quebrar os imports existentes (`features/empresa.ts`, `features/parceiros/campos.ts`, `ui/documento.test.ts`). `ui/moeda.ts` importa de `ui/mascara.ts` diretamente.

Alternativa considerada — duplicar a função dentro de `ui/moeda.ts`: rejeitada por violar "verificar se já existe uma solução equivalente antes de introduzir uma nova" (a lógica de preservar a posição do cursor é exatamente a mesma).

### 3. Marcação explícita dos campos monetários via `inpMoeda`
Novo helper em `ui/campos.ts`:
```ts
export const inpMoeda = (nome: string, valor: number | string | null | undefined, attrs = ""): Safe =>
  inp(nome, paraCampoMoeda(valor), `data-moeda inputmode="decimal" placeholder="0,00" ${attrs}`);
```
`data-moeda` é o marcador explícito que distingue um campo monetário de qualquer outro `inputmode="decimal"` (quantidade, percentual). `attrs` permite sobrescrever o `placeholder` quando necessário (ex.: `valor_quitacao` em `titulos.ts`, que usa "vazio = valor devido" quando o título já está quitado) — atributos repetidos em HTML: o navegador usa o primeiro `placeholder` encontrado, então o `placeholder` customizado deve ser passado via `attrs` e `inpMoeda` deve colocá-lo **antes** do padrão nesse caso, ou (mais simples) `inpMoeda` aceita um parâmetro de placeholder próprio em vez de string livre:
```ts
export const inpMoeda = (nome: string, valor: number | string | null | undefined, placeholder = "0,00", attrs = ""): Safe =>
  inp(nome, paraCampoMoeda(valor), `data-moeda inputmode="decimal" placeholder="${placeholder}" ${attrs}`);
```
Isso resolve o caso de `valor_quitacao` sem ambiguidade de atributo duplicado.

`paraCampoMoeda(n)` (novo, em `ui/moeda.ts`) formata o número já no formato da máscara (ex.: `1500.5` → `"1.500,50"`), para que o valor inicial de um registro existente já apareça mascarado, sem esperar o primeiro `input`. Zero/vazio → `""` (mesma convenção de `paraCampo`).

### 4. Ligação automática em `ui/gaveta.ts`
Depois de montar o HTML da gaveta e antes de retornar, `abrirGaveta` varre `form.querySelectorAll<HTMLInputElement>("[data-moeda]")` e chama `ligarMascaraDeMoeda(campo)` (que por sua vez chama `reaplicarMascara` no evento `input`) em cada um. Isso cobre todo formulário que use `inpMoeda`, **sem** que a feature precise chamar nada manualmente — inclusive `financeiro/titulos.ts`, `financeiro/recorrencias.ts` e `financeiro/contas-bancarias.ts`, que hoje nem chamam `melhorarFormulario`.

Alternativa considerada — ligar a máscara dentro de `melhorarFormulario` (`ui/acessibilidade.ts`): rejeitada porque nem toda feature chama `melhorarFormulario` hoje (confirmado em `titulos.ts`, `recorrencias.ts`, `contas-bancarias.ts`), então um campo monetário nessas telas ficaria sem máscara. `abrirGaveta` é o único ponto por onde **todo** formulário em gaveta passa.

### 5. Campos monetários fora do ciclo de gaveta: ligação explícita
Dois pontos criam/recriam campos monetários fora do `montar` de uma gaveta:
- **`features/orcamentos.ts`**: a linha de item (`preco_unitario`) é recriada via `tb.innerHTML = ...` a cada `desenhar()` (adicionar/remover item, trocar produto). A varredura de `abrirGaveta` só roda uma vez, na montagem inicial — não alcança linhas recriadas depois. Solução: dentro do listener delegado já existente em `tb.addEventListener("input", …)`, antes de ler `el.value` para `k === "preco_unitario"`, chamar `reaplicarMascara(el, mascararMoeda)` (mesmo padrão que `features/empresa.ts:238` já usa para o campo de documento fora do fluxo de `ligarMascaraDeDocumento`). O `qtd` da mesma linha **não** recebe a chamada.
- **`ui/onboarding.ts`**: fluxo próprio, fora de `abrirGaveta`, com linhas de produto adicionadas/removidas dinamicamente. Solução: chamar `ligarMascaraDeMoeda` explicitamente sobre `#obPPreco{i}` no mesmo ponto em que a linha é inserida no DOM (mirror do que já é feito para qualquer outra ligação de evento daquela linha).

### 6. Valor enviado ao servidor
Sem mudança: todo ponto que lê um campo monetário já passa por `numero(fv(f, "campo"))` antes de montar o payload. `numero()` já lida com `"1.500,00"` (o formato que a nova máscara produz) exatamente como lida hoje com `"1500,5"` — nenhuma alteração necessária em `core/numero.ts`.

## Risks / Trade-offs

- **[Risco] Mudança de modelo de interação** (de "digitar a vírgula livremente" para "centavos entram pela direita") pode surpreender quem já tem o hábito antigo, inclusive ao editar um valor existente (colocar o cursor no meio e digitar insere um dígito nos centavos, não naquela posição). → Mitigação: é o mesmo comportamento que apps bancários brasileiros já usam para valores em R$; documentar no changelog interno. `reaplicarMascara` mantém o cursor numa posição razoável, mas a edição "cirúrgica" no meio do valor deixa de fazer sentido (coerente com a mecânica de centavos-pela-direita, não um bug).
- **[Risco] Colar um valor já formatado** (ex.: copiar `R$ 1.500,00` de outro lugar e colar) passa pelo mesmo `mascararMoeda`, que descarta tudo que não é dígito e reinterpreta os dígitos restantes como centavos — `R$ 1.500,00` colado vira `1.500,00` (dígitos `150000`), resultado correto nesse caso específico, mas colar `1.500,5` (um dígito de centavo só) resultaria em `150,05`, diferente da intenção. → Mitigação: comportamento aceitável e consistente com o resto da máscara; nenhum valor é perdido, só precisa de correção manual pelo usuário, como já acontece ao colar um CPF com formatação estranha no campo de documento.
- **[Risco] Campo monetário novo que não use `inpMoeda`**: continuaria sem máscara. → Mitigação: `data-moeda` é a única porta de entrada para a ligação automática; `inpMoeda` é o único produtor desse atributo, então usar `inpMoeda` ao criar qualquer input monetário novo passa a ser a convenção natural (mesmo papel que `inp`/`sel`/`area` já cumprem para os outros tipos de campo).

## Migration Plan

Mudança é só de frontend e só de apresentação (nenhuma migração de dado, nenhuma mudança de API). Pode ser implantada em um único deploy:
1. Criar `ui/mascara.ts` (extraindo `reaplicarMascara`) e `ui/moeda.ts`; `ui/documento.ts` passa a reexportar `reaplicarMascara`.
2. Adicionar `inpMoeda` em `ui/campos.ts` e a varredura automática em `ui/gaveta.ts`.
3. Trocar `inp(...)` por `inpMoeda(...)` nos campos monetários, um arquivo por vez (cada troca é independente e sem risco de regressão cruzada).
4. Tratar os dois pontos fora do ciclo de gaveta (`orcamentos.ts`, `onboarding.ts`).
5. Testes unitários de `mascararMoeda`/`paraCampoMoeda` + checagem manual de cada tela afetada.

Rollback: reverter o commit (nenhum dado foi migrado; `numero()` não muda).

## Open Questions

Nenhuma — o padrão de `ui/documento.ts` já responde às dúvidas de arquitetura, e o escopo de campos monetários foi levantado por busca em todo o `frontend/src` (`inputmode="decimal"` + revisão caso a caso).
