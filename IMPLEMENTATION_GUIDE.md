# Guia de Implementação - Refactoring Phase 0

## 📚 Arquivos de Referência

Este guia detalha como implementar cada correção usando os arquivos nesta branch:

```
refactor/complete-rebuild-phase-0/
├── REFACTORING_GUIDE.md          ← Visão geral da estratégia
├── IMPLEMENTATION_GUIDE.md        ← Este arquivo
├── supabase-improved.sql          ← Schema melhorado (Phase 0)
├── supabase/functions/
│   └── hub-admin-improved/        ← Edge Function segura
├── lib/
│   └── utils-improved.js          ← Funções corrigidas
└── index.html                     ← Original para referência
```

---

## 🔧 Implementação Step-by-Step

### **Passo 1: Validar Correções Localmente**

```bash
# 1.1 Verificar que está na branch correta
git branch -a | grep refactor/complete-rebuild-phase-0

# 1.2 Ler os arquivos novos
cat REFACTORING_GUIDE.md
cat IMPLEMENTATION_GUIDE.md

# 1.3 Revisar as funções corrigidas
cat lib/utils-improved.js
```

### **Passo 2: Testar a Função `num()` Corrigida**

**Arquivo**: `lib/utils-improved.js`

```javascript
// Rodar testes unitários:
testarNum();

// Casos de teste cobertos:
// ✓ "1500.50" → 1500.5  (US format com decimais)
// ✓ "1.500,50" → 1500.5 (formato europeu)
// ✓ "1500,50" → 1500.5  (europeu alternativo)
// ✓ "100" → 100         (inteiro)
// ✓ "0,5" → 0.5         (decimal)
// ✓ "" → 0              (vazio)
// ✓ 1500.5 → 1500.5     (já é número)
```

**Validação crítica**:

```javascript
// Antes (BUG):
const num_original = v => {
  const n = parseFloat(String(v??'').replace(/\./g,'').replace(',','.'));
  return isFinite(n)? n : 0;
};
num_original("1500.50"); // ❌ Retorna 150050 (ERRADO!)

// Depois (CORRIGIDO):
const numMelhorado = (v) => {
  // Detectar separador decimal e processar corretamente
  // Ver implementação completa em lib/utils-improved.js
};
numMelhorado("1500.50"); // ✅ Retorna 1500.5 (CORRETO!)
```

### **Passo 3: Aplicar Schema Melhorado no Supabase**

**Arquivo**: `supabase-improved.sql`

```sql
-- 3.1 No Supabase Console > SQL Editor > New query

-- Copiar TODO o conteúdo de supabase-improved.sql
-- Executar para aplicar as mudanças

-- 3.2 Validar que as mudanças foram aplicadas:
-- - Função hub_eh_membro() com search_path
-- - Função hub_carimbo() melhorada (preserva criadoPor)
-- - Tabela hub_auditoria criada
-- - Função gerar_numero_orcamento() criada
-- - Índices criados
```

**Validações**:

```sql
-- Verificar se as novas funções existem
select routine_name from information_schema.routines 
where routine_schema = 'public' 
and routine_name in ('gerar_numero_orcamento', 'registrar_auditoria');

-- Verificar tabela de auditoria
select count(*) from information_schema.tables 
where table_schema = 'public' and table_name = 'hub_auditoria';

-- Testar geração de número único
select public.gerar_numero_orcamento();
```

### **Passo 4: Implantar Edge Function Segura**

**Arquivo**: `supabase/functions/hub-admin-improved/index.ts`

```bash
# 4.1 Fazer backup da versão atual
cp supabase/functions/hub-admin/index.ts supabase/functions/hub-admin/index.ts.bak

# 4.2 Copiar a versão melhorada
cp supabase/functions/hub-admin-improved/index.ts supabase/functions/hub-admin/index.ts

# 4.3 Configurar variáveis de ambiente (se necessário)
# No Supabase Project Settings > Edge Functions:
# ALLOWED_ORIGIN = https://seu-dominio.com

# 4.4 Deploy
supabase functions deploy hub-admin
```

**Validações de segurança**:

```typescript
// ✓ CORS restrito a origem específica (configurável)
// ✓ Erros internos não expostos (mensagens genéricas)
// ✓ Limite de páginas para listagem (MAX_PAGES = 10)
// ✓ Validação rigorosa de emails e senhas
// ✓ Proteção contra remoção do último admin
// ✓ Remoção atômica (delete + auth em sequência)
// ✓ Logging de erros (console.error, não expõe ao cliente)
```

### **Passo 5: Integrar Funções Corrigidas no `index.html`**

**Mudança crítica 1**: Substituir função `num()`

```diff
// ANTES (linha ~505):
- const num = v => { const n = typeof v==='number'? v : parseFloat(String(v??'').replace(/\./g,'').replace(',','.')); return isFinite(n)? n : 0; };

// DEPOIS:
+ const num = v => {
+   if (typeof v === "number") return v;
+   let s = String(v ?? "").trim();
+   if (!s) return 0;
+   
+   const ultimaVirgulaPos = s.lastIndexOf(",");
+   const ultimoPontoPos = s.lastIndexOf(".");
+   const posDecimal = Math.max(ultimaVirgulaPos, ultimoPontoPos);
+   
+   if (posDecimal === -1) return parseFloat(s) || 0;
+   
+   const ehDecimal = s.length - posDecimal <= 3;
+   const separadorDecimal = s[posDecimal];
+   const separadorMilhar = separadorDecimal === "," ? "." : ",";
+   
+   s = s.replace(new RegExp("\\" + separadorMilhar, "g"), "");
+   s = s.replace(separadorDecimal, ".");
+   
+   const resultado = parseFloat(s);
+   return isFinite(resultado) ? resultado : 0;
+ };
```

**Mudança crítica 2**: Preservar `criadoPor` ao editar

```diff
// ANTES (linha ~1390):
function formOrcamento(o={}){
  gavetaReg = {col:'orcamentos', reg:o};
  const novo = !o.id;
-  const dados = {numero:o.numero||proximoNumero(), ...};

// DEPOIS:
function formOrcamento(o={}){
  gavetaReg = {col:'orcamentos', reg:o};
  const novo = !o.id;
+  // Guardar valores originais de auditoria
+  const criadoPorOriginal = o.criadoPor;
+  const criadoEmOriginal = o.criado_em;
  const dados = {numero:o.numero||proximoNumero(), ...};
  
  // ... código da form ...
  
  // Ao salvar (linha ~579):
  const payload = {
    ...dados,
+   criadoPor: criadoPorOriginal,  // ← RESTAURAR
+   criado_em: criadoEmOriginal,   // ← RESTAURAR
  };
  await salvar(payload);
```

**Mudança crítica 3**: Usar `gerar_numero_orcamento()` do servidor

```diff
- function proximoNumero(){
-   const ano = new Date().getFullYear();
-   const seq = state.orcamentos.map(o=>String(o.numero||'')).filter(s=>s.startsWith(ano+'-')).map(s=>parseInt(s.slice(5))||0);
-   return ano+'-'+String((seq.length?Math.max(...seq):0)+1).padStart(3,'0');
- }

+ async function proximoNumero(){
+   // Chamar função do servidor
+   const { data, error } = await HubSupabase.client.rpc('gerar_numero_orcamento');
+   if (error) {
+     console.error('Erro ao gerar número:', error);
+     throw error;
+   }
+   return data;
+ }
```

### **Passo 6: Validação de Dados Existentes**

```sql
-- Executar no Supabase para validar integridade

-- Verificar registros com criadoPor null
select count(*) as "orcamentos com criadoPor null" 
from hub_orcamentos where criadoPor is null;

select count(*) as "negocios com criadoPor null" 
from hub_negocios where criadoPor is null;

-- Verificar números de orçamento duplicados
select numero, count(*) 
from hub_orcamentos 
group by numero 
having count(*) > 1;

-- Executar validação completa
select * from public.validar_integridade();
```

### **Passo 7: Testes Manuais (Golden Path)**

Testar cada fluxo crítico:

#### Teste 1: Criar orçamento com valores decimais

```
1. Ir em "Orçamentos" → "Novo orçamento"
2. Preencher:
   - Cliente: (qualquer)
   - Item 1: Descrição="Serviço", Qtd=2, Valor unitário="500,50"
3. Validar:
   - Total = 2 × 500,50 = 1.001,00
   - (NÃO pode ser 100100,00)
4. Salvar
5. Editar novamente
6. Validar que:
   - "criadoPor" é o autor original
   - "atualizado_por" é o editor atual
   - Valores permanecem corretos
```

#### Teste 2: Criar dois orçamentos no mesmo dia

```
1. Criar orçamento 1 → número gerado: 2024-001 ✓
2. Criar orçamento 2 → número gerado: 2024-002 ✓
3. (Não pode gerar o mesmo número)
```

#### Teste 3: Operação de fatura em lote

```
1. Criar negócio com múltiplas tarefas de fatura
2. Iniciar geração em lote
3. Validar que:
   - TODAS as faturas são criadas (ou NENHUMA)
   - Não há registros órfãos
   - Totais são preservados
```

---

## 🚨 Checklist de Verificação

- [ ] Função `num()` testada com todos os casos
- [ ] Schema do Supabase aplicada sem erros
- [ ] Função `gerar_numero_orcamento()` testada
- [ ] Edge Function `hub-admin` reimplementada
- [ ] Todas as mudanças do `index.html` aplicadas
- [ ] Testes manuais executados (golden path)
- [ ] Validação de dados executada (sem corrupção)
- [ ] Backup realizado antes de produção
- [ ] Plano de rollback preparado
- [ ] Monitoramento ativado

---

## 🔄 Rollback Plan (Se Necessário)

```bash
# Se algo der errado:

# 1. Reverter código do frontend
git checkout main -- index.html

# 2. Reverter Edge Function
git checkout main -- supabase/functions/hub-admin/index.ts

# 3. Reverter banco (manualmente no Supabase):
# Supabase Console > SQL Editor > Delete ou DROP as funções/tabelas novas
# Manter os dados (JSONB é compatível com schema antiga)

# 4. Recarregar aplicação no browser (Ctrl+Shift+R)
```

---

## 📊 Resultado Esperado

### Antes (Buggy):
- ❌ "1500.50" parseado como 150050
- ❌ Editar orçamento sobrescreve "criadoPor"
- ❌ Números de orçamento podem duplicar
- ❌ Falha em lote deixa registros órfãos

### Depois (Corrigido):
- ✅ "1500.50" parseado como 1500.5
- ✅ "criadoPor" preservado ao editar
- ✅ Números únicos gerados no servidor
- ✅ Operações atômicas (tudo ou nada)

---

## 🤝 Suporte

Dúvidas ou problemas?

1. Revisar `REFACTORING_GUIDE.md` para contexto geral
2. Verificar comentários no código (especialmente `lib/utils-improved.js`)
3. Executar testes unitários: `testarNum()`
4. Validar integridade: `select * from public.validar_integridade();`

**Próximo passo**: Phase 1 (Melhorias de BD e Frontend)

