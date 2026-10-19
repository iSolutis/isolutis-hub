## 1. Base da máscara

- [x] 1.1 Criar `ui/mascara.ts` extraindo `reaplicarMascara` de `ui/documento.ts`; `ui/documento.ts` passa a reexportar `reaplicarMascara` de `ui/mascara.ts` (sem quebrar os imports existentes em `features/empresa.ts`, `features/parceiros/campos.ts`, `ui/documento.test.ts`)
- [x] 1.2 Criar `ui/moeda.ts` com `mascararMoeda(valor: string): string` (dígitos entram como centavos pela direita, formata com milhar e vírgula decimal)
- [x] 1.3 Em `ui/moeda.ts`, criar `paraCampoMoeda(n: number | string | null | undefined): string` (número → texto já mascarado; zero/vazio → `""`)
- [x] 1.4 Em `ui/moeda.ts`, criar `ligarMascaraDeMoeda(campo: HTMLInputElement): void` (liga `reaplicarMascara` no evento `input`, mesmo padrão de `ligarMascaraDeDocumento`)
- [x] 1.5 Testes unitários de `mascararMoeda` e `paraCampoMoeda` em `ui/moeda.test.ts` (dígito único, valor com milhar, apagar dígitos, colar com `R$` e espaços, zero/vazio), nos moldes de `ui/documento.test.ts`

## 2. Integração com os formulários

- [x] 2.1 Criar `inpMoeda(nome, valor, placeholder = "0,00", attrs = "")` em `ui/campos.ts`, renderizando `inp(...)` com `data-moeda inputmode="decimal" placeholder="${placeholder}"` e `paraCampoMoeda(valor)`
- [x] 2.2 Em `ui/gaveta.ts`, depois de montar o HTML da gaveta (e antes ou depois de chamar `o.montar?.()`), varrer `form.querySelectorAll<HTMLInputElement>("[data-moeda]")` e chamar `ligarMascaraDeMoeda` em cada um

## 3. Trocar os campos monetários existentes para `inpMoeda`

- [x] 3.1 `features/negocios.ts`: campos "Valor do projeto (R$)" e "Manutenção mensal (R$)"
- [x] 3.2 `features/produtos.ts`: campo "Preço de referência (R$)"
- [x] 3.3 `features/financeiro/contas-bancarias.ts`: campo "Saldo inicial (R$)"
- [x] 3.4 `features/financeiro/recorrencias.ts`: campo "Valor de cada título (R$)"
- [x] 3.5 `features/financeiro/titulos.ts`: campos "Valor do título", "Desconto", "Multa", "Juros" (placeholder padrão `0,00`) e "Valor pago" (placeholder `vazio = valor devido` quando já quitado)
- [x] 3.6 `features/faturamento.ts`: campo "Valor (R$)" do lançamento único e "Valor total (R$)"/"Valor por mês (R$)" do lançamento em lote
- [x] 3.7 `features/orcamentos.ts`: campo "Desconto no projeto (R$)" (campo estático do formulário)

## 4. Campos monetários fora do ciclo padrão de gaveta

- [x] 4.1 `features/orcamentos.ts`: no template da linha de item (dentro de `desenhar()`), adicionar `data-moeda` e placeholder ao input `preco_unitario`; no listener delegado `tb.addEventListener("input", …)`, antes de ler o valor para `k === "preco_unitario"`, chamar `reaplicarMascara(el, mascararMoeda)` (não aplicar em `qtd`)
- [x] 4.2 `features/orcamentos.ts`: ao atribuir `it.preco_unitario = numero(p.preco)` (produto escolhido), garantir que o input da linha é remascarado com o novo valor (reaplicar a máscara após o redesenho da linha)
- [x] 4.3 `ui/onboarding.ts`: ligar `ligarMascaraDeMoeda` ao input `#obPPreco{i}` no momento em que a linha de produto é inserida no DOM (criação inicial e ao adicionar uma nova linha)

## 5. Verificação

- [x] 5.1 Confirmar que os campos de quantidade (`qtd` do item de orçamento) e percentual (`participacao_percentual`) continuam sem `data-moeda` e sem a máscara monetária
- [x] 5.2 Rodar `npm run typecheck`, `npm run lint` e `npm run test` em `frontend/` — typecheck limpo; lint limpo nos arquivos desta mudança (6 erros pré-existentes em `ui/formulario-helper.ts`/`ui/salvar-helper.ts`, não tocados aqui); testes: 225/226 passam, a 1 falha (`validators.test.ts`, "deve rejeitar NaN ou Infinity") é pré-existente e reproduz igual sem as mudanças desta proposta (confirmado com `git stash`)
- [x] 5.3 Checagem manual na UI — **não executada**: o backend exige PostgreSQL, indisponível neste ambiente (sem Docker). `npm run build` roda limpo (confirma que o bundle fecha), mas nenhum formulário foi aberto num navegador real. Recomendo checar manualmente ao subir o backend localmente antes de mesclar: abrir cada formulário alterado (negócio, produto, conta bancária, recorrência, título, lançamento de faturamento, orçamento com item, onboarding), digitar e editar um valor, e confirmar que o valor salvo/recalculado está correto
