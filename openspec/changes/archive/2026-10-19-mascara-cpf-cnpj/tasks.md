## 1. Utilitário compartilhado de documento

- [x] 1.1 Criar `frontend/src/ui/documento.ts` com `TipoDocumento`, `tipoDoDocumento` (PF/CPF → CPF; demais → CNPJ), `mascararDocumento`, `formatarDocumento` (mesma semântica da atual de `financeiro/comum.ts`), placeholders por tipo e `maxlength` fixo (18)
- [x] 1.2 Implementar o helper de reaplicar máscara preservando o cursor (contagem de dígitos à esquerda de `selectionStart`)
- [x] 1.3 Implementar `ligarMascaraDeDocumento(campo, tipo)` que ouve `input`, ajusta o placeholder e expõe `atualizarTipo()` para remascarar ao trocar o tipo
- [x] 1.4 Criar `frontend/src/ui/documento.test.ts`: máscara completa e parcial de CPF/CNPJ, truncamento no limite, colar formatado/com espaços, remascarar CNPJ→CPF (`112.223.330-00`) e CPF→CNPJ (`52.998.224/725`), `formatarDocumento` (11, 14, vazio → `—`, outro tamanho intacto), `tipoDoDocumento` e cursor após edição no meio (jsdom)

## 2. Origem única da formatação

- [x] 2.1 Remover `formatarDocumento` de `features/financeiro/comum.ts` e atualizar os imports em `empresa.ts`, `parceiros/campos.ts`, `parceiros/telas.ts`, `financeiro/titulos.ts` e `financeiro/recorrencias.ts`
- [x] 2.2 Mover os casos de `formatarDocumento` de `financeiro/comum.test.ts` para `ui/documento.test.ts`

## 3. Formulário de parceiro e de cliente

- [x] 3.1 Em `parceiros/campos.ts`, renderizar o campo `cpf_cnpj` com placeholder e `maxlength` do tipo inicial (`tipo_pessoa` gravado ou PJ) e valor inicial via `mascararDocumento`, caindo para `formatarDocumento` quando os dígitos gravados excedem o limite do tipo
- [x] 3.2 Em `ligarCamposDoParceiro`, ligar `ligarMascaraDeDocumento` ao campo `cpf_cnpj` e chamar `atualizarTipo()` no `change` de `tipo_pessoa`
- [x] 3.3 Conferir que `lerCamposDoParceiro` segue enviando o valor (o servidor normaliza para dígitos) e que gaveta de parceiros e formulário de cliente em página herdam o comportamento

## 4. Dados da empresa

- [x] 4.1 Substituir `mascararInscricao` por `mascararDocumento(…, tipoDoDocumento(tipo_inscricao))` no listener de `input` (com preservação de cursor) e no `change` de `tipo_inscricao`
- [x] 4.2 Usar placeholder e `maxlength` compartilhados no campo `inscricao` e em `valoresDe`
- [x] 4.3 Remover `mascararInscricao` de `empresa.ts` e ajustar `empresa.test.ts`

## 5. Validação

- [x] 5.1 Rodar `npm run typecheck`, `npm run lint` e `npm test` no frontend
- [x] 5.2 Verificar no app: cadastrar parceiro PJ e PF, trocar o tipo com documento preenchido, editar parceiro existente, cliente em página, "Dados da empresa" (CNPJ↔CPF), lista de parceiros e opções de parceiro em títulos/recorrências
- [x] 5.3 Salvar um parceiro com documento mascarado e confirmar que é gravado só com dígitos e que um dígito verificador inválido é recusado com a mensagem atual
