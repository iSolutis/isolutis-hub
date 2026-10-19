## Context

Hoje há três pedaços soltos de lógica de documento no frontend:

- `features/empresa.ts` → `mascararInscricao(valor, tipo)`: máscara enquanto se digita, ligada por um `document.addEventListener("input")` restrito a `#empresaForm`, e remascaramento no `change` de `tipo_inscricao` (re-render da tela). Valores de tipo: `"CNPJ" | "CPF"`.
- `features/financeiro/comum.ts` → `formatarDocumento(doc)`: formatação de exibição por quantidade de dígitos (11 → CPF, 14 → CNPJ, vazio → `—`). Usada em `parceiros/telas.ts` (lista), `titulos.ts` e `recorrencias.ts` (opções de parceiro), e para o valor inicial dos formulários.
- `features/parceiros/campos.ts` → campo `cpf_cnpj` como `<input inputmode="numeric" maxlength="18">` sem máscara; o select `tipo_pessoa` (`"PJ" | "PF"`) não influencia o campo. Esse módulo é a única fonte do formulário de parceiro: gaveta (`parceiros/telas.ts`, via `camposDoParceiro` + `ligarCamposDoParceiro`) e formulário de cliente em página (`clientes.ts`, via `secoesDoParceiro` + `ligarCamposDoParceiro`).

O backend já normaliza para dígitos (`so_digitos`) e valida dígitos verificadores pelo tipo (`regras.documento_valido`). Não há outros campos de entrada de CPF/CNPJ no frontend (a busca "nome ou CPF/CNPJ" da lista de parceiros aceita texto livre).

## Goals / Non-Goals

**Goals:**
- Uma única implementação de máscara/formatação de CPF/CNPJ, testada, usada por todas as telas.
- Máscara dirigida pelo tipo selecionado (PF/PJ ou CPF/CNPJ), com placeholder e limite coerentes e remascaramento ao trocar o tipo.
- Cursor estável ao editar no meio do número.

**Non-Goals:**
- Validar dígitos verificadores no navegador (continua no servidor; pode ser uma evolução futura).
- Mascarar o campo de busca da lista de parceiros (aceita nomes).
- Qualquer mudança em backend, API, banco ou PDFs (o `render.py` já formata).
- Adotar biblioteca de máscara de terceiros.

## Decisions

### 1. Novo módulo `frontend/src/ui/documento.ts`
Funções puras e um ligador de DOM:

- `type TipoDocumento = "CPF" | "CNPJ"` e `tipoDoDocumento(tipoPessoa: string): TipoDocumento` (`"PF"`/`"CPF"` → `CPF`; demais → `CNPJ`), para que os dois vocabulários (`tipo_pessoa` e `tipo_inscricao`) convirjam.
- `mascararDocumento(valor, tipo)`: extrai dígitos, trunca no limite (11/14) e aplica a máscara parcial — mesma regra hoje em `mascararInscricao`.
- `formatarDocumento(doc)`: exibição por tamanho, mesma semântica da atual (`—`, 11, 14, demais como vieram).
- `PLACEHOLDER_DOCUMENTO: Record<TipoDocumento, string>` e `MAXLENGTH_DOCUMENTO` fixo em 18 (CNPJ formatado). O limite por tipo é imposto pela máscara: um `maxlength` de 14 no CPF cortaria, antes do evento `input`, uma colagem com espaços ou pontuação extra.
- `valorInicialDoDocumento(doc, tipo)` e `reaplicarMascara(campo, mascarar)` (preservação de cursor, reutilizada pela tela de empresa).
- `ligarMascaraDeDocumento(campo: HTMLInputElement, tipo: () => TipoDocumento)`: ouve `input`, reaplica a máscara preservando o cursor e expõe `atualizarTipo()`, que ajusta o placeholder e remascara quando o tipo muda.

**Por que `ui/`:** é infraestrutura de formulário genérica (como `ui/campos.ts`), não regra do financeiro nem da empresa. Alternativa considerada: manter em `financeiro/comum.ts` — rejeitada porque `empresa.ts` (Administração) importaria de Financeiro, acoplamento que já existe e que esta mudança desfaz.

**Origem única:** `formatarDocumento` sai de `financeiro/comum.ts` e os poucos chamadores (`empresa.ts`, `parceiros/campos.ts`, `parceiros/telas.ts`, `titulos.ts`, `recorrencias.ts`) passam a importar de `ui/documento.ts`. Alternativa: reexportar em `comum.ts` — rejeitada para não manter duas origens do mesmo símbolo.

### 2. Preservação do cursor por contagem de dígitos
Antes de remascarar, conta-se quantos dígitos existem à esquerda de `selectionStart`; depois, posiciona-se o cursor logo após o N-ésimo dígito no valor mascarado. Simples, sem estado, e resolve o salto para o fim que o `#empresaForm` tem hoje. Alternativa: tratar `keydown`/`beforeinput` — mais complexa e frágil com colar/autocompletar.

### 3. Ligação por formulário, não por listener global
No parceiro, `ligarCamposDoParceiro` (já chamado pelas duas telas) chama `ligarMascaraDeDocumento(cpf_cnpj, () => tipoDoDocumento(tipo_pessoa.value))` e, no `change` do select `tipo_pessoa`, chama `atualizarTipo()`. Assim gaveta e cliente em página ganham o comportamento numa única alteração.

Em "Dados da empresa", o fluxo atual (listener delegado em `document` + re-render no `change`) é mantido; apenas troca-se `mascararInscricao` por `mascararDocumento(…, tipoDoDocumento(tipo_inscricao))` e o placeholder/`maxlength` passam a vir das constantes compartilhadas. A preservação de cursor também é aplicada ali reutilizando o helper de cursor exportado pelo módulo. Alternativa: reescrever a tela de empresa para usar `ligarMascaraDeDocumento` — rejeitada porque a tela é re-renderizada a partir de `tela.valores` e o listener delegado já é o padrão dela.

### 4. Valor inicial na edição
O valor inicial é renderizado com `mascararDocumento(doc, tipoDoDocumento(tipo gravado))` em vez de `formatarDocumento(doc)`. Para documentos legados cuja quantidade de dígitos não bate com o tipo gravado, a máscara por tipo truncaria dígitos silenciosamente; por isso, se `doc.length` excede o limite do tipo, o valor inicial usa `formatarDocumento` (sem perda) e o usuário vê o problema, que o servidor recusará ao salvar.

### 5. Remascarar ao trocar o tipo trunca ao novo limite
Coerente com o comportamento atual de "Dados da empresa" e com o requisito ("mantendo os dígitos até o limite do novo tipo"). Não se guarda o excedente para restaurar ao voltar o tipo — evita estado escondido.

## Risks / Trade-offs

- [Trocar PJ→PF descarta os 3 últimos dígitos digitados] → comportamento visível e imediato; o usuário redigita se trocou por engano. Mesmo comportamento já aceito em "Dados da empresa".
- [Autopreenchimento do navegador não dispara `input` em alguns casos] → o servidor normaliza dígitos, então o valor salvo continua correto; apenas a apresentação pode ficar sem máscara até a próxima edição.
- [Mudança de import de `formatarDocumento` em vários arquivos] → cobertura pelos testes existentes (`comum.test.ts`, `empresa.test.ts`) migrados para `ui/documento.test.ts`, mais `npm run typecheck`.

## Migration Plan

Mudança apenas de frontend, sem dados nem API: deploy normal; rollback é reverter o commit.

## Open Questions

Nenhuma bloqueante.
