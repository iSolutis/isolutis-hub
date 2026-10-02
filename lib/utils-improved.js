/**
 * Hub Comercial iSolutis - Funções Utilitárias Melhoradas
 * Phase 0: Correções de integridade de dados
 *
 * Este arquivo contém versões corrigidas das funções críticas.
 * Integrar no index.html quando validado.
 */

// ============================================================================
// 1. PARSING DE NÚMEROS - CORRIGIDO
// ============================================================================
// BUG ORIGINAL: Removia TODOS os pontos, causando "1500.50" → "150050"
// SOLUÇÃO: Detectar formato e processar corretamente

/**
 * Converte string para número, detectando formato automático
 * Aceita: "1.500,50" (europeu) ou "1500.50" (US) ou "1500,50"
 * @param {number|string} v - Valor a converter
 * @returns {number} - Número ou 0 se inválido
 */
const numMelhorado = (v) => {
  if (typeof v === "number") return v;

  let s = String(v ?? "").trim();
  if (!s) return 0;

  // Encontrar a última ocorrência de vírgula ou ponto (é o separador decimal)
  const ultimaVirgulaPos = s.lastIndexOf(",");
  const ultimoPontoPos = s.lastIndexOf(".");

  // Se não tem nenhum separador
  if (ultimaVirgulaPos === -1 && ultimoPontoPos === -1) {
    return parseFloat(s) || 0;
  }

  // Determinar qual é o separador decimal (vem por último)
  const posDecimal = Math.max(ultimaVirgulaPos, ultimoPontoPos);

  // Se o separador decimal está a menos de 3 casas do fim, é decimal
  // Caso contrário, é separador de milhar
  const ehDecimal = s.length - posDecimal <= 3;

  if (!ehDecimal) {
    // Não é decimal, é separador de milhar - remover
    const separadorMilhar = s[posDecimal];
    s = s.replace(new RegExp("\\" + separadorMilhar, "g"), "");
    // Agora converter a vírgula para ponto (se houver)
    s = s.replace(",", ".");
  } else {
    // É o separador decimal
    const separadorDecimal = s[posDecimal];
    const separadorMilhar = separadorDecimal === "," ? "." : ",";

    // Remover separador de milhar
    s = s.replace(new RegExp("\\" + separadorMilhar, "g"), "");
    // Normalizar para ponto como decimal
    s = s.replace(separadorDecimal, ".");
  }

  const num = parseFloat(s);
  return isFinite(num) ? num : 0;
};

// Teste: validar conversão
const testarNum = () => {
  console.assert(numMelhorado("1500.50") === 1500.5, 'Falha: "1500.50"');
  console.assert(
    numMelhorado("1.500,50") === 1500.5,
    'Falha: "1.500,50"'
  );
  console.assert(numMelhorado("1500,50") === 1500.5, 'Falha: "1500,50"');
  console.assert(numMelhorado("100") === 100, 'Falha: "100"');
  console.assert(numMelhorado("0,5") === 0.5, 'Falha: "0,5"');
  console.assert(numMelhorado("") === 0, 'Falha: ""');
  console.assert(numMelhorado(1500.5) === 1500.5, "Falha: número");
  console.log("✓ Testes de numMelhorado passaram");
};

// ============================================================================
// 2. PRESERVAÇÃO DE DADOS AO EDITAR
// ============================================================================
// BUG ORIGINAL: Campo criadoPor era sobrescrito com usuário atual
// SOLUÇÃO: Guardar valores originais ao carregar para edição

/**
 * Carrega dados para edição preservando campos de auditoria
 * @param {Object} registro - Registro completo do banco
 * @returns {Object} - Objeto com dados e referência aos originais
 */
const carregarParaEdicao = (registro) => {
  const dados = { ...registro };

  // Preservar valores originais de auditoria
  const auditoria = {
    criadoPor: registro.criadoPor,
    criado_em: registro.criado_em,
  };

  // Retornar com função para restaurar ao salvar
  return {
    dados,
    auditoria,
    restaurarAuditoria: () => ({
      criadoPor: auditoria.criadoPor,
      criado_em: auditoria.criado_em,
    }),
  };
};

// ============================================================================
// 3. GERAÇÃO DE NÚMEROS ÚNICOS (Server-side)
// ============================================================================
// BUG ORIGINAL: Gerava no cliente sem unicidade garantida
// SOLUÇÃO: Implementar no servidor (Supabase function)

/**
 * Função que deve ser movida para Supabase (SQL)
 * Ver supabase-improved.sql para implementação
 *
 * Chama a função server-side para gerar número único
 * @param {SupabaseClient} supabase - Cliente Supabase
 * @returns {Promise<string>} - Número único gerado
 */
const gerarNumeroUnico = async (supabase, tabela) => {
  if (tabela === "orcamentos") {
    // Chamar função SQL server-side
    const { data, error } = await supabase.rpc(
      "gerar_numero_orcamento"
    );

    if (error) {
      console.error("Erro ao gerar número:", error);
      throw error;
    }

    return data;
  }

  throw new Error("Tipo de documento não suportado");
};

// ============================================================================
// 4. OPERAÇÕES ATÔMICAS (Batch)
// ============================================================================
// BUG ORIGINAL: Múltiplas operações INSERT sem transação = registros órfãos
// SOLUÇÃO: Implementar como procedure ou transaction

/**
 * Gera faturas de forma atômica (tudo ou nada)
 * Deve ser implementado como Supabase Function
 */
const gerarFaturasAtomica = async (supabase, negocioId, detalhes) => {
  // Esta função deve chamar uma Supabase Edge Function que:
  // 1. Valida os dados
  // 2. Executa TODAS as INSERTs em uma única transação
  // 3. Retorna tudo-ou-nada
  //
  // Exemplo de implementação:
  // const { data, error } = await supabase.functions.invoke('gerar-faturas-atomica', {
  //   body: { negocioId, detalhes }
  // });

  throw new Error(
    "Esta operação deve ser implementada como Edge Function"
  );
};

// ============================================================================
// 5. VALIDAÇÕES
// ============================================================================

/**
 * Validar integridade de número (não permite casos degenerados)
 */
const validarNumero = (valor, minimo = 0, maximo = Infinity) => {
  const num = numMelhorado(valor);

  if (num < minimo) {
    throw new Error(
      `Número deve ser >= ${minimo}`
    );
  }

  if (num > maximo) {
    throw new Error(
      `Número deve ser <= ${maximo}`
    );
  }

  return num;
};

/**
 * Validar email
 */
const validarEmail = (email) => {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!regex.test(email)) {
    throw new Error("E-mail inválido");
  }
  return email.toLowerCase();
};

/**
 * Validar data ISO
 */
const validarData = (data) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    throw new Error("Data deve estar em formato YYYY-MM-DD");
  }

  const d = new Date(data + "T00:00:00Z");
  if (isNaN(d.getTime())) {
    throw new Error("Data inválida");
  }

  return data;
};

// ============================================================================
// 6. HELPERS DE ESTADO
// ============================================================================

/**
 * Criar histórico de mudanças para auditoria
 */
const rastrearMudanca = (original, modificado, campos = null) => {
  const mudancas = {};

  const chaves = campos || Object.keys({ ...original, ...modificado });

  for (const chave of chaves) {
    if (original[chave] !== modificado[chave]) {
      mudancas[chave] = {
        de: original[chave],
        para: modificado[chave],
      };
    }
  }

  return mudancas;
};

/**
 * Detectar conflito de edição (último a editar vence)
 * Versão melhorada com timestamp do servidor
 */
const detectarConflito = (meuTempo, tempoNoServidor) => {
  // Comparar timestamps do servidor, não do cliente
  // meuTempo deve ser atualizado_em do banco ao carregar
  return new Date(tempoNoServidor) > new Date(meuTempo);
};

// ============================================================================
// EXPORTS (para uso em módulos)
// ============================================================================

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    numMelhorado,
    testarNum,
    carregarParaEdicao,
    gerarNumeroUnico,
    gerarFaturasAtomica,
    validarNumero,
    validarEmail,
    validarData,
    rastrearMudanca,
    detectarConflito,
  };
}
