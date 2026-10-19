# Padrões de Código - Frontend Hub

## 1. Validação de Formulários

Use `validators.ts` e `schemas/entidades.ts` para centralizar regras de validação.

**Exemplo:**

```typescript
import { schema, regras } from "@/ui/validators";

const meuSchema = schema<{ nome: string; email: string }>({
  nome: campo("nome", [
    regras.obrigatorio("Nome"),
    regras.minLength(3, "Nome"),
  ]),
  email: campo("email", [
    regras.obrigatorio("E-mail"),
    regras.email(),
  ]),
});

const resultado = meuSchema.parse(dados);
if (!resultado.sucesso) {
  console.log("Erros:", resultado.erros);
} else {
  console.log("Dados validados:", resultado.dados);
}
```

**Benefícios:**
- Validações reutilizáveis entre features
- Fácil adicionar novas regras
- Tipo-safe com TypeScript

## 2. CRUD Genérico

Use `crud-helper.ts` para reduzir duplicação entre features similar (Clientes, Negócios, Produtos, etc).

**Exemplo (próxima refatoração):**

```typescript
setupCrud({
  recurso: "clientes",
  renderizarLista: (items) => html`<table>...</table>`,
  renderizarFormulario: (item) => ({
    titulo: item ? item.nome : "Novo cliente",
    corpo: html`...`,
    rodape: html`<button data-salvar>Salvar</button>`,
  }),
  aoSalvar: (item, isNovo) => isNovo 
    ? api.clientes.criar(item)
    : api.clientes.atualizar(item.id, item),
  aoSucesso: (item) => console.log("Salvo:", item),
});
```

**Benefícios:**
- Menos código repetido
- Padrão consistente entre features
- Fácil manutenção

## 3. Tratamento de Erros

Use `tentar()` para operações assíncronas com erro automático:

```typescript
const resultado = await tentar(() => api.usuarios.criar(dados));
if (resultado) {
  // Sucesso - erro foi automaticamente mostrado se falhou
  fechar();
}
```

## 4. Estado Global

Dados são armazenados em `estado.ts` (leitura/escrita compartilhada).

**Regra:** Sempre recarregar dados após modificações via `recarregar()`:

```typescript
const ok = await tentar(() => api.clientes.atualizar(id, dados));
if (ok) {
  await recarregar("clientes");
}
```

## 5. Segurança

### Passwords em Formulários
- Use timeout automático (5s) para limpar da DOM
- Exemplo: `backend/src/features/equipe.ts:114-123`

### Validação de Entrada
- Sempre validar no formulário antes de enviar
- Backend valida novamente (defesa em profundidade)

### HTML Template
- Use `html` template para escapar valores automaticamente
- Explicitamente usar `raw()` apenas para HTML controlado

## 6. WebSocket em Tempo Real

Mudanças via WebSocket disparam `recarregar()` automático.
Implementado em `state/realtime.ts`.

## 7. Próximas Refatorações

- [ ] Aplicar `crud-helper` em `clientes.ts`, `negocios.ts`, `orcamentos.ts`
- [ ] Aplicar schemas de validação em todas features
- [ ] Adicionar E2E tests com Playwright
- [ ] Adicionar unit tests para lógica de domínio

## Checklist para Nova Feature

- [ ] Criar schema de validação em `schemas/entidades.ts`
- [ ] Usar `html` template para segurança
- [ ] Registrar vista em `registrarVista()`
- [ ] Registrar ações em `registrarAcao()`
- [ ] Usar `recarregar()` após modificações
- [ ] Tratar erros com `tentar()`
- [ ] Adicionar testes (próxima sprint)

## Formulário: gaveta ou página

Dois padrões, com o mesmo contrato (conflito de edição, versão gravada pela própria sessão e presença
"editando…", todos via `ui/registro-aberto.ts`):

| Use | Quando | Como |
|---|---|---|
| **Gaveta** (`abrirGaveta`) | Edição curta: até ~8 campos, sem listas relacionadas (tarefa, produto, conta bancária…) | `ui/gaveta.ts` |
| **Página** (`abrirFormularioPagina`) | Formulário longo, com seções ou listas relacionadas (cliente) | `ui/formulario-pagina.ts` |

Para criar um formulário em página:

1. Monte as seções (`{ id, titulo, descricao?, corpo }`). Os campos continuam sendo os de `ui/campos.ts`.
2. Chame `abrirFormularioPagina({ vista, rotuloLista, caminho, titulo, secoes, salvar, excluir, registro, montar })`.
   - `caminho` vem de `caminhoDoRegistro(vista, id)` ou `caminhoNovo(vista)` (`state/caminhos.ts`).
   - `montar(form, fechar, raiz)` liga os eventos; `fechar()` volta à listagem (use depois de salvar ou excluir).
3. Registre as rotas da tela para link direto, Voltar e recarregar:
   `registrarRotaDeRegistro("clientes", { novo: () => formCliente(), abrir: (id) => ... })`.
   Se o registro não existir, mostre `mostrarRegistroNaoEncontrado(...)`.

A proteção contra perda de alterações já vem pronta: compara os valores do formulário (alterar e restaurar não conta)
e pergunta antes de sair pelo menu, pela paleta, pelo Voltar ou ao recarregar a aba.

## Telas: peças compartilhadas

- Cabeçalho, listagem e estados: `ui/componentes.ts` (`cabecalhoDePagina`, `barraDeFerramentas`, `chip`,
  `estadoVazio`, `estadoDeErro`, `carregando`). O visual vem de `styles/components.css`.
- Ícones: `icone("nome")` de `ui/icones.ts`. Botão só com ícone exige nome: `botaoIcone("fechar", "Fechar")`.
- Onde a tela aparece no menu, o ícone e as ações do "+ Novo" e da paleta: `state/menu.ts`.
- Espaços, raios, camadas e alturas vêm dos tokens de `styles/tokens.css` (`--esp-*`, `--r-*`, `--z-*`,
  `--controle-*`); não use `z-index` nem medidas soltas.

## Campos de escolha: combobox ou `<select>`

- **Combobox pesquisável** (`ui/combobox.ts`) para listas que vêm de dados (clientes, negócios, projetos, parceiros, contas, instituições, municípios, conta pai) ou com mais de ~12 itens. O usuário digita e a lista filtra por código, nome e grupo, sem diferenciar acento nem caixa.
- **`<select>` nativo** para enumerações pequenas e fixas (situação, tipo, prioridade, UF).
- Uso: `combobox({ nome, rotulo, opcoes: [{ id, rotulo, codigo?, grupo? }], valor, vazio?, acaoFinal? })` no HTML. O valor fica num `<input type="hidden" name=…>` (lido por `fv` e escutado por `change`); o campo visível é `#f-<nome>`.
- Código da tela: `comboboxDe(form, nome)` → `definirValor(id, { silencioso })` e `definirOpcoes(opcoes, { valor })`. Nunca atribua `.value` ao campo oculto: o texto visível não acompanharia.
- Em telas ≤ 860 px o campo abre a **folha de seleção** em tela cheia (busca de 16 px, itens de 44 px, botão Voltar do aparelho fecha só a folha via `state/voltar.ts`); em telas largas, lista suspensa em portal no `body`.
- `Esc` fecha só a lista (captura), `Enter` nunca envia o formulário.
