# Guia de Refactoring - Hub Comercial iSolutis

## 🎯 Visão Geral

Este documento detalha o refactoring completo do Hub Comercial iSolutis, implementando as melhores práticas de engenharia de software identificadas na análise técnica.

## 📋 Fases de Implementação

### **Phase 0: Correções Imediatas e Críticas (Urgente)**

Estas correções resolvem problemas que causam perda de dados e corrupção:

#### 1. **Bug Crítico: Função `num()` - Corrupção de Números**

**Problema**: A função remove TODOS os pontos antes de processar
```javascript
// ❌ ERRADO
const num = v => { 
  const n = parseFloat(String(v??'').replace(/\./g,'').replace(',','.')); 
  return isFinite(n)? n : 0; 
};
// "1500.50" → "150050" (perde casas decimais)
```

**Solução**: Detectar formato e processar corretamente
```javascript
// ✅ CORRETO
const num = v => {
  if (typeof v === 'number') return v;
  let s = String(v ?? '').trim();
  if (!s) return 0;
  
  // Detectar separador decimal (última vírgula ou ponto)
  const ultimaPosicao = Math.max(s.lastIndexOf(','), s.lastIndexOf('.'));
  if (ultimaPosicao === -1) return parseFloat(s) || 0;
  
  const separadorDecimal = s[ultimaPosicao];
  // Remover separadores de milhar (não-decimais)
  const outroSeparador = separadorDecimal === ',' ? '.' : ',';
  s = s.replace(new RegExp('\\' + outroSeparador, 'g'), '');
  // Usar ponto como decimal
  s = s.replace(',', '.');
  
  return parseFloat(s) || 0;
};
```

**Impacto**: Afeta `orcamento.desconto`, `orcamento.itens[].qtd`, `orcamento.itens[].preco`, `negocio.valor`, `negocio.mensal`

#### 2. **Perda de Dado: Campo `criadoPor` não preservado ao editar**

**Problema**: Quando edita um orçamento/negócio, `criadoPor` é sobrescrito com o usuário atual

**Linhas afetadas**: 1452, 1558, 1074-1075

**Solução**:
```javascript
// Ao carregar dados para edição:
const dados = {...o};
const criadorOriginal = dados.criadoPor; // Guardar o original

// Ao salvar:
const payload = {
  ...dados,
  criadoPor: criadorOriginal // Restaurar o original
};
```

#### 3. **Falta de Unicidade: Geração de números de orçamento no client-side**

**Problema**: `proximoNumero()` gera números sem garantia de unicidade

**Solução**: Mover para servidor (Supabase function ou trigger)

#### 4. **Operações Não-Atômicas: Geração de faturas em lote**

**Linhas**: 1509-1514

**Problema**: Se falhar no meio, cria registros órfãos

**Solução**: Implementar como uma única transação

#### 5. **Dados Hardcoded: Array SOCIOS duplicado**

**Linha**: 997

**Solução**: Remover e buscar do servidor

---

### **Phase 1: Melhorias de Banco de Dados**

- [ ] Criar schema apropriada com tipos corretos
- [ ] Adicionar `user_id` (FK para auth.users)
- [ ] Implementar audit logging
- [ ] Otimizar RLS para performance
- [ ] Adicionar índices nas queries comuns
- [ ] Criar vistas para dados complexos

### **Phase 2: Refactoring de Frontend**

- [ ] Separar código em módulos
- [ ] Implementar proper state management
- [ ] Adicionar validações no client e server
- [ ] Melhorar tratamento de erros
- [ ] Adicionar tests unitários
- [ ] Melhorar performance (lazy loading, caching)

### **Phase 3: Segurança e Observabilidade**

- [ ] Revisar todas as políticas RLS
- [ ] Adicionar rate limiting
- [ ] Implementar audit logging
- [ ] Adicionar monitoring
- [ ] Melhorar gestão de erros (sem expor detalhes)

### **Phase 4: Cutover Gradual**

- [ ] Executar migrações de dados
- [ ] Validar integridade
- [ ] Fazer rollback case necessário
- [ ] Monitorar produção

---

## 🛠 Arquivos Modificados

### `supabase.sql` - Schema do Banco
- ✅ Melhorar `hub_eh_membro()` para ser set-returning
- ✅ Adicionar `set search_path` nas functions
- ✅ Criar tabelas com schema apropriado
- ✅ Adicionar audit logging
- ✅ Melhorar índices

### `supabase/functions/hub-admin/index.ts` - Edge Function
- ✅ Remover CORS aberto (usar origem específica)
- ✅ Não expor erro interno ao cliente
- ✅ Fazer listagem com limite seguro
- ✅ Tornar remoção atômica
- ✅ Proteger último admin

### `index.html` - Aplicação Principal
- ✅ Corrigir função `num()`
- ✅ Preservar `criadoPor` ao editar
- ✅ Mover geração de números para servidor
- ✅ Tornar operações em lote atômicas
- ✅ Remover dados hardcoded
- ✅ Melhorar organização do código
- ✅ Adicionar validações
- ✅ Melhorar tratamento de erros

---

## ✅ Checklist de Validação

Cada fase deve passar por:

- [ ] Testes unitários (novos e existentes)
- [ ] Testes de integração
- [ ] Testes manuais (golden path + edge cases)
- [ ] Validação de dados (não há perda)
- [ ] Validação de performance
- [ ] Revisão de segurança
- [ ] Deploy em staging
- [ ] Deploy em produção com rollback plan

---

## 📚 Referências

- Relatório de análise: [/artifacts/report-technical-analysis]
- Identificação de problemas: [DBA Report Section]

---

## 👨‍💻 Time de Desenvolvimento

**Esta refactoring foi planejada pela análise técnica automatizada.**

Próximos passos:
1. Review deste guia
2. Implementar Phase 0 (correções imediatas)
3. Testar extensivamente
4. Deploy seguro com monitoramento

