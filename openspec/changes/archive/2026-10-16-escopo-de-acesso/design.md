# Design

## Context

- Isolamento entre empresas já é imposto por RLS (`0005_multi_tenant.sql`): cada tabela de dados tem a política permissiva `tenant_<tabela>` (`empresa_id = app_empresa_id()`), e a API usa o papel `hub_runtime`, sem `BYPASSRLS`. A requisição grava `app.usuario_id` e `app.empresa_id` na transação (`deps.py`).
- O papel na empresa (`usuario_empresa.papel`) libera áreas via `exige(...)`; não há noção de dono além de `responsavel_id` em negócios, projetos, etapas e tarefas (com índices `(empresa_id, responsavel_id)`). `parceiro_negocio` não tem dono; orçamentos só têm `criado_por`.
- O frontend carrega coleções inteiras (`carregarTudo`) e o tempo real transmite presença com o **título** do registro em edição para toda a empresa.
- Uma instância de aplicação; PostgreSQL 16 (Neon em produção).

## Goals / Non-Goals

**Goals:**
- O banco é a autoridade: nenhuma consulta da aplicação, esquecida ou nova, devolve ou altera linha fora do escopo (specs `visibilidade-por-escopo` e `atuacao-em-projetos`).
- Custo de escopo calculado uma vez por requisição, não por linha.
- Mensagens de erro iguais para "fora do escopo" e "inexistente".

**Non-Goals:**
- Escopo na área financeira; papéis configuráveis; escopo por campo além de "cliente só pelo nome"; trilha de auditoria geral (só o registro de transferências entra aqui); paginação no servidor (as listas apenas ficam menores).

## Decisions

### 1. Liderança calculada no banco, uma vez por transação
Uma função `app_definir_escopo()` (`SECURITY DEFINER`, `search_path` fixo) lê `app_usuario_id()`/`app_empresa_id()`, obtém o papel em `usuario_empresa` e calcula, por CTE recursiva com `UNION` (deduplica e encerra ciclos), o conjunto **V = {eu} ∪ liderados**. Grava em GUCs locais à transação: `app.ve_tudo` (papel admin) e `app.usuarios_visiveis` (array de UUID). `app_usuarios_visiveis()` e `app_ve_tudo()` são funções `STABLE` que só leem os GUCs. `deps.empresa_atual` chama `app_definir_escopo()` logo após definir a empresa.
- *Por quê no banco e não na API?* Papel e liderança vêm de tabelas; calcular no banco evita que a API seja fonte de verdade do escopo e mantém um único lugar para testar.
- *Alternativa descartada:* políticas que fazem a CTE recursiva por linha — custo O(linhas × árvore).
- *Alternativa descartada:* papel novo "gestor" — liderança é posição na estrutura, não área (proposal).
- Os GUCs são `set_config(..., true)` (local): não vazam entre requisições no pool.

### 2. Políticas: tenant restritiva + escopo permissivo por comando
As políticas `tenant_*` das tabelas escopadas passam a `AS RESTRICTIVE` (continuam obrigatórias). Sobre elas entram políticas permissivas separadas:
- `FOR SELECT` → `app_pode_ver_<tabela>(linha)`.
- `FOR INSERT/UPDATE/DELETE` → `app_pode_editar_<tabela>(linha)`.
Tabelas escopadas: `parceiro_negocio`, `negocios`, `orcamentos`, `orcamento_itens`, `projetos`, `projeto_etapas`, `projeto_participante`, `tarefas`, `tarefa_checklist`. Filhos puros (itens, checklist) delegam ao pai via `EXISTS`.

Regras de visibilidade (V = `app_usuarios_visiveis()`):
```
cliente   : ve_tudo OR dono ∈ V OR dono IS NULL
negócio   : ve_tudo OR resp ∈ V OR dono_do_cliente ∈ V
            OR (resp IS NULL AND dono_do_cliente IS NULL)
orçamento : via negócio; sem negócio → criado_por ∈ V OR dono_do_cliente ∈ V
projeto   : ve_tudo OR resp ∈ V OR ∃ participante ∈ V OR dono_do_cliente ∈ V
            OR (resp IS NULL AND sem participantes AND dono_do_cliente IS NULL)
etapa     : projeto visível (pela regra acima; ser executor de tarefa não basta)
tarefa    : ve_tudo OR resp ∈ V OR dono_do_cliente ∈ V
            OR (projeto IS NOT NULL AND projeto visível)
            OR (projeto IS NULL AND resp IS NULL AND dono_do_cliente IS NULL)
```
"Participante" = responsável do projeto, responsável de alguma etapa ou linha em `projeto_participante`.

Regras de edição seguem a spec (`dono`, líderes do dono, admin; etapa/tarefa também pelo seu responsável e líderes). Ver pela posse do cliente **não** concede edição.

### 3. Mudança de dono por gatilho, não por política
RLS `WITH CHECK` não enxerga a linha antiga; a regra "só líder/admin muda ou retira o dono, e só dentro de V" vai num gatilho `BEFORE INSERT OR UPDATE OF responsavel_id` nas tabelas com dono. O mesmo gatilho grava em `transferencia_dono (empresa_id, entidade, registro_id, de, para, por, em)` (RLS de tenant; leitura só admin). Transferir um negócio atualiza o dono implícito dos orçamentos (que seguem o negócio — sem coluna própria).

### 4. Nome de cliente sem acesso ao cliente
Como a linha do cliente fica invisível por RLS, nomes vêm de `app_nomes_clientes(ids uuid[])` (`SECURITY DEFINER`), que devolve `(id, nome)` apenas para ids referenciados por algum negócio/orçamento/projeto/tarefa **visível ao chamador** (checado com as mesmas funções `app_pode_ver_*`). `GET /clientes/referencias` e os DTOs de listagem usam essa função. Do mesmo modo, `app_titulos_projetos(ids uuid[])` devolve `(id, titulo)` dos projetos de tarefas visíveis ao chamador, para o executor de tarefa avulsa ver o título do projeto sem acessar o projeto. Documentos (orçamento, plano de entrega) passam a receber o cliente completo só se `app_pode_ver_cliente`; senão, só o nome.

### 5. Vínculo com cliente visível
Checagens de FK ignoram RLS. As políticas de `INSERT/UPDATE` de negócios, orçamentos, projetos e tarefas exigem `cliente_id IS NULL OR app_pode_ver_cliente(cliente_id)`; a API traduz a violação para "cliente não encontrado".

### 6. Erros: fora do escopo = 404
Leitura de linha invisível já retorna vazio (serviços dão `NaoEncontrado`). Violação de política em escrita (`insufficient_privilege`/`42501`) e `UPDATE` que afeta 0 linhas são convertidos no tratador global para 404 com a mesma mensagem de inexistente.

### 7. DTOs carregam a permissão de edição
Leituras de negócio, projeto, etapa e tarefa incluem `pode_editar` (de `app_pode_editar_*`) para a interface entrar em modo leitura sem duplicar regra no front.

### 8. Tempo real sem títulos
A presença deixa de transmitir o título do registro em edição (`"editando um registro"` + área). Avisos `alterado` continuam só com nomes de recurso; cada aba recarrega sob o próprio escopo.

### 9. Frontend
- Admin › Equipes: CRUD de equipes, membros e líderes.
- Campo "Dono" em cliente/negócio/projeto/tarefa, editável só para líder/admin (lista de pessoas = V para líder, todos para admin).
- Projeto: seção Participantes; etapas/tarefas sem `pode_editar` em modo leitura.
- 404 de registro fora do escopo usa o estado "registro não encontrado" existente.

## Risks / Trade-offs

- [Desempenho das políticas com `EXISTS` em cadeia] → índices novos `parceiro_negocio(empresa_id, responsavel_id)`, `projeto_participante(projeto_id, usuario_id)` e `(usuario_id)`, `projeto_etapas(projeto_id, responsavel_id)`; medir com `EXPLAIN ANALYZE` (script `0005-explain-analyze-rls.sql` como base) antes do deploy.
- [Funções `SECURITY DEFINER` viram superfície de escalonamento] → `search_path` fixo, sem SQL dinâmico, `REVOKE ALL FROM PUBLIC`, `GRANT EXECUTE` só ao `hub_runtime`; testes que chamam cada uma com usuário de outro escopo.
- [GUC de escopo ausente (rota que esqueça `app_definir_escopo`)] → funções tratam GUC ausente como V = ∅ e `ve_tudo = false` (falha fechada); teste estrutural de rotas já garante `empresa_atual`.
- [Corte de visão no deploy: líderes sem equipe montada] → tela de equipes no mesmo deploy, aviso no painel do admin enquanto não houver equipes.
- [Dono inferido errado na migração] → lista de clientes com dono atribuído para o admin revisar; transferência disponível desde o primeiro dia.
- [Registro sem dono continua público] → dono padrão = criador; só líder/admin cria/solta sem dono (gatilho).

## Migration Plan

1. Migração `0015`: tabelas `equipe`, `equipe_membro`, `equipe_lider`, `projeto_participante`, `transferencia_dono`; coluna `parceiro_negocio.responsavel_id`; índices; funções de escopo; gatilhos; conversão das `tenant_*` escopadas em `RESTRICTIVE` + políticas de escopo; carga do dono dos clientes (responsável do negócio mais recente).
2. Validar em branch do Neon: suíte de testes SQL de escopo + `EXPLAIN ANALYZE`.
3. Deploy do backend e frontend juntos, logo após a migração.
4. Admin monta as equipes.
5. Rollback: `0015_down` remove políticas de escopo, devolve `tenant_*` a permissivas, remove funções/gatilhos/tabelas/coluna (equipes, participantes e donos de cliente são perdidos); reverter o app.

## Ajustes feitos na implementação

- **Contexto reaplicado a cada transação**: as variáveis `app.*` são locais à transação e se perdiam após um `commit` na mesma requisição. Um ouvinte `after_begin` da sessão (`app/db.py`) passou a regravar usuário, empresa e escopo. Antes, isso já afetava leituras pós-commit com `hub_runtime`.
- **Nome do cliente** vem de `app_nome_cliente()` (`column_property` nos models e na view `vw_orcamentos_totais`), não do relacionamento, que volta vazio quando o cadastro é invisível.
- **Etapa editada sozinha**: o projeto era salvo inteiro (`PUT`). Para o responsável de etapa atuar só na sua, entrou `PATCH /projetos/{id}/etapas/{etapa}`. A interface mostra o projeto em leitura e edita só as etapas com `pode_editar`.
- **Referências de projeto** (`GET /projetos/referencias`, `app_projetos_referencia`) dão ao executor de tarefa avulsa o título do projeto.
- **Tarefas não têm vínculo com etapa** no modelo de dados. A regra da spec "a etapa e as tarefas dela" vale só para a etapa; tarefas seguem o responsável da tarefa e o editor do projeto.
- **Recusas do banco** (SQLSTATE 42501) são traduzidas em `confirmar()` e num tratador global, pela dica do gatilho: `escopo_dono` → 403, `escopo_cliente` → 404 "Cliente", RLS → 404.
- **Desempenho**: medido em `docs/MULTI_TENANCY.md`. As políticas fazem varredura sequencial (até ~475 ms em 20 mil tarefas para um líder). A otimização (conjuntos pré-calculados por transação e predicados indexáveis) fica para uma mudança seguinte.
