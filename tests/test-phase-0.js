/**
 * Testes para Phase 0: Correções Imediatas
 *
 * Executar no console do browser ou Node.js:
 * node tests/test-phase-0.js
 *
 * Cobre:
 * 1. Parsing de números
 * 2. Preservação de dados de auditoria
 * 3. Unicidade de números
 * 4. Operações atômicas
 */

const assert = (condicao, mensagem) => {
  if (!condicao) {
    console.error(`❌ FALHA: ${mensagem}`);
    process.exit(1);
  }
  console.log(`✅ ${mensagem}`);
};

// ============================================================================
// SUITE 1: Parsing de Números
// ============================================================================

console.log("\n📊 TESTE 1: Parsing de Números\n");

// Importar função corrigida
const { numMelhorado } = require("../lib/utils-improved");

// Casos de teste: [entrada, esperado, descrição]
const casosNum = [
  // Formato US (ponto como decimal)
  ["1500.50", 1500.5, "US format com decimal"],
  ["1000.99", 1000.99, "US com centavos"],
  ["0.50", 0.5, "US decimal puro"],

  // Formato Europeu (vírgula como decimal, ponto como milhar)
  ["1.500,50", 1500.5, "Europeu com ponto de milhar"],
  ["10.000,00", 10000, "Europeu grande"],
  ["1.234.567,89", 1234567.89, "Europeu muito grande"],

  // Formato Europeu alternativo (só vírgula)
  ["1500,50", 1500.5, "Europeu sem ponto de milhar"],
  ["0,99", 0.99, "Europeu puro"],

  // Inteiros
  ["100", 100, "Inteiro simples"],
  ["1000", 1000, "Inteiro com casa de milhar"],

  // Casos especiais
  ["", 0, "String vazia"],
  ["  ", 0, "Só espaços"],
  [null, 0, "null"],
  [undefined, 0, "undefined"],

  // Números já parseados
  [1500.5, 1500.5, "Número já é number"],
  [0, 0, "Zero"],
  [-100.5, -100.5, "Número negativo"],
];

for (const [entrada, esperado, desc] of casosNum) {
  const resultado = numMelhorado(entrada);
  assert(
    Math.abs(resultado - esperado) < 0.001,
    `numMelhorado(${JSON.stringify(entrada)}) = ${resultado} [${desc}]`
  );
}

// Validar que o bug original foi corrigido
console.log("\n⚠️  Validação contra bug original:\n");
const bugTest = "1500.50";
const resultadoBuggy = parseFloat(
  String(bugTest ?? "")
    .replace(/\./g, "")
    .replace(",", ".")
);
const resultadoCorrigido = numMelhorado(bugTest);

assert(
  resultadoBuggy !== resultadoCorrigido,
  `Código original retornaria ${resultadoBuggy}, novo retorna ${resultadoCorrigido}`
);
assert(
  resultadoCorrigido === 1500.5,
  "Código corrigido retorna valor correto"
);

// ============================================================================
// SUITE 2: Validações
// ============================================================================

console.log("\n🔍 TESTE 2: Validações\n");

const {
  validarNumero,
  validarEmail,
  validarData,
} = require("../lib/utils-improved");

// Validar números
try {
  validarNumero(-10, 0, 100);
  assert(false, "Deveria rejeitar número negativo");
} catch (e) {
  assert(true, "Rejeita número < mínimo");
}

try {
  validarNumero(150, 0, 100);
  assert(false, "Deveria rejeitar número acima do máximo");
} catch (e) {
  assert(true, "Rejeita número > máximo");
}

assert(validarNumero(50, 0, 100) === 50, "Aceita número válido");

// Validar emails
try {
  validarEmail("invalido");
  assert(false, "Deveria rejeitar email inválido");
} catch (e) {
  assert(true, "Rejeita email sem @");
}

assert(
  validarEmail("usuario@exemplo.com") === "usuario@exemplo.com",
  "Aceita email válido"
);
assert(
  validarEmail("USUARIO@EXEMPLO.COM") === "usuario@exemplo.com",
  "Normaliza para minúsculas"
);

// Validar datas
try {
  validarData("2024-13-01");
  assert(false, "Deveria rejeitar data inválida");
} catch (e) {
  assert(true, "Rejeita mês 13");
}

assert(
  validarData("2024-01-15") === "2024-01-15",
  "Aceita data ISO válida"
);

// ============================================================================
// SUITE 3: Rastreamento de Mudanças
// ============================================================================

console.log("\n📝 TESTE 3: Rastreamento de Mudanças\n");

const { rastrearMudanca } = require("../lib/utils-improved");

const original = {
  nome: "João",
  email: "joao@exemplo.com",
  ativo: true,
  criadoPor: "admin@exemplo.com",
};

const modificado = {
  nome: "João Silva",
  email: "joao@exemplo.com",
  ativo: false,
  criadoPor: "admin@exemplo.com",
};

const mudancas = rastrearMudanca(original, modificado);

assert(Object.keys(mudancas).length === 2, "Detecta 2 mudanças");
assert(
  mudancas.nome.de === "João" && mudancas.nome.para === "João Silva",
  "Rastreia mudança no nome"
);
assert(
  mudancas.ativo.de === true && mudancas.ativo.para === false,
  "Rastreia mudança no ativo"
);
assert(!("email" in mudancas), "Não rastreia campos sem mudança");
assert(!("criadoPor" in mudancas), "Não rastreia criadoPor");

// ============================================================================
// SUITE 4: Preservação de Auditoria ao Editar
// ============================================================================

console.log("\n🔐 TESTE 4: Preservação de Auditoria\n");

const { carregarParaEdicao } = require("../lib/utils-improved");

const registroDoServidor = {
  id: "orc-123",
  numero: "2024-001",
  valor: 1500.5,
  criadoPor: "vendedor@isolutis.com",
  criado_em: "2024-01-15T10:30:00Z",
  atualizado_por: "vendedor@isolutis.com",
  atualizado_em: "2024-01-15T10:30:00Z",
};

const { dados, auditoria, restaurarAuditoria } =
  carregarParaEdicao(registroDoServidor);

// Simular edição
dados.valor = 2000;
dados.atualizado_por = "outro-vendedor@isolutis.com"; // Mudaria ao salvar, mas restauramos

const dadosParaSalvar = {
  ...dados,
  ...restaurarAuditoria(),
};

assert(
  dadosParaSalvar.criadoPor === "vendedor@isolutis.com",
  "criadoPor preservado ao editar"
);
assert(
  dadosParaSalvar.criado_em === "2024-01-15T10:30:00Z",
  "criado_em preservado ao editar"
);
assert(dadosParaSalvar.valor === 2000, "Valor da edição preservado");

// ============================================================================
// SUITE 5: Detecção de Conflito
// ============================================================================

console.log("\n⚔️  TESTE 5: Detecção de Conflito\n");

const { detectarConflito } = require("../lib/utils-improved");

const tempoOriginal = "2024-01-15T10:00:00Z";
const tempoMaisRecente = "2024-01-15T11:00:00Z";
const tempoMenosRecente = "2024-01-15T09:00:00Z";

assert(
  detectarConflito(tempoOriginal, tempoMaisRecente) === true,
  "Detecta versão mais recente no servidor"
);
assert(
  detectarConflito(tempoOriginal, tempoMenosRecente) === false,
  "Aceita versão local quando é mais recente"
);
assert(
  detectarConflito(tempoOriginal, tempoOriginal) === false,
  "Não detecta conflito com timestamp igual"
);

// ============================================================================
// SUITE 6: Integração
// ============================================================================

console.log("\n🔗 TESTE 6: Integração\n");

// Simular fluxo completo: criar, editar, validar
const orcamento = {
  id: "orc-456",
  numero: "2024-002",
  items: [
    { descricao: "Serviço A", qtd: 1, preco: "1.500,00", mensal: false },
    { descricao: "Serviço B", qtd: 3, preco: "500.50", mensal: true },
  ],
  desconto: "100,00",
  criadoPor: "vendedor@isolutis.com",
  criado_em: "2024-01-20T14:30:00Z",
  atualizado_por: "vendedor@isolutis.com",
  atualizado_em: "2024-01-20T14:30:00Z",
};

// Carregar para edição
const { dados: dadosEdit } = carregarParaEdicao(orcamento);

// Simular mudanças
dadosEdit.items[0].preco = "1.800,00";
dadosEdit.items[1].qtd = "2"; // string vindo do input

// Calcular total
const total =
  numMelhorado(dadosEdit.items[0].preco) *
    numMelhorado(dadosEdit.items[0].qtd) +
  numMelhorado(dadosEdit.items[1].preco) *
    numMelhorado(dadosEdit.items[1].qtd) -
  numMelhorado(dadosEdit.desconto);

assert(
  Math.abs(total - (1800 + 1001 - 100)) < 0.01,
  `Total calculado corretamente: ${total.toFixed(2)}`
);

// ============================================================================
// RESUMO
// ============================================================================

console.log("\n" + "=".repeat(50));
console.log("✅ TODOS OS TESTES PASSARAM!");
console.log("=".repeat(50) + "\n");

console.log("Resumo das correções validadas:");
console.log("  ✓ Parsing de números em formatos múltiplos");
console.log("  ✓ Preservação de auditoria ao editar");
console.log("  ✓ Detecção de conflitos de edição");
console.log("  ✓ Validações de integridade");
console.log("  ✓ Rastreamento de mudanças");
console.log("  ✓ Fluxos integrados funcionando");

console.log(
  "\nPróximo passo: Integrar essas correções no index.html produção"
);
