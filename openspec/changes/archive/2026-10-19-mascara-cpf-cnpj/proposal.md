## Why

O CPF/CNPJ é digitado e exibido de formas diferentes conforme a tela: em "Dados da empresa" o número de inscrição já ganha máscara enquanto se digita e segue o tipo escolhido (CNPJ/CPF), mas no cadastro de parceiros (fornecedores, funcionários, sócios) e de clientes o campo "CPF / CNPJ" é texto livre, sem máscara e sem relação com o "Tipo de pessoa" selecionado — o usuário só descobre que digitou dígitos a mais ou a menos quando o servidor recusa o documento. A máscara precisa ser única e coerente em todo o Hub.

## What Changes

- Uma única máscara de documento (CPF `000.000.000-00`, CNPJ `00.000.000/0000-00`) passa a ser aplicada enquanto se digita em todo campo de entrada de CPF/CNPJ do Hub.
- Nas telas com seleção de tipo de pessoa (física/jurídica), a máscara, o limite de dígitos e o placeholder seguem o tipo selecionado; ao trocar o tipo, o valor já digitado é remascarado (e truncado ao limite do novo tipo).
- O formulário de parceiros (gaveta) e o formulário de cliente em página passam a aplicar essa máscara ligada ao campo "Tipo de pessoa".
- "Dados da empresa" passa a usar a mesma máscara compartilhada (sem mudança de comportamento visível).
- A exibição somente-leitura (listas de parceiros, opções de parceiro em títulos e recorrências) continua usando a formatação compartilhada de documento, que passa a viver no mesmo módulo da máscara.
- Sem mudança de API: o servidor continua recebendo/guardando só dígitos e validando os dígitos verificadores conforme o tipo.

## Capabilities

### New Capabilities
- `mascara-documento`: máscara de CPF/CNPJ na digitação e na exibição em todas as telas, obedecendo ao tipo de pessoa/inscrição selecionado quando a tela oferece essa escolha.

### Modified Capabilities
<!-- Nenhuma: as specs existentes não definem requisitos sobre o formato de CPF/CNPJ. -->

## Impact

- Frontend apenas:
  - novo utilitário compartilhado de máscara/formatação de documento (ex.: `frontend/src/ui/documento.ts`) com testes unitários;
  - `frontend/src/features/parceiros/campos.ts` (render do campo com placeholder/limite pelo tipo e ligação da máscara em `ligarCamposDoParceiro`), cobrindo `parceiros/telas.ts` e `clientes.ts`;
  - `frontend/src/features/empresa.ts` (remove `mascararInscricao` local em favor do utilitário);
  - `frontend/src/features/financeiro/comum.ts` (`formatarDocumento` passa a reexportar/usar o utilitário; chamadores em `titulos.ts`, `recorrencias.ts`, `parceiros/telas.ts` sem mudança de comportamento).
- Backend, API e banco: sem alteração (já normalizam para dígitos e validam CPF/CNPJ por tipo).
