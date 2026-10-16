# Tasks

## 1. Estrutura no banco (equipes, donos, participantes)

- [ ] 1.1 Migração `0013` (parte estrutural) + down: tabelas `equipe`, `equipe_membro`, `equipe_lider`, `projeto_participante`, `transferencia_dono` com `empresa_id` e RLS de tenant; coluna `parceiro_negocio.responsavel_id`; índices do design. Verificar com `alembic upgrade head` e `alembic downgrade 0012` em base de teste sem erro
- [ ] 1.2 Models SQLAlchemy das novas tabelas e da coluna; verificar import do app e `pytest tests/test_permissoes_rotas.py`
- [ ] 1.3 Carga do dono dos clientes (responsável do negócio mais recente) na migração; verificar com teste SQL que cliente com dois negócios fica com o responsável do mais recente e cliente sem negócio fica sem dono

## 2. Escopo calculado por transação

- [ ] 2.1 Funções `app_definir_escopo()` (CTE recursiva com UNION, papel admin → `ve_tudo`), `app_usuarios_visiveis()`, `app_ve_tudo()`, com falha fechada sem GUC; `REVOKE`/`GRANT` só ao `hub_runtime`. Verificar com testes SQL: três níveis de liderança, dois líderes, pessoa em duas equipes, ciclo, pessoa desativada, GUC ausente → conjunto vazio
- [ ] 2.2 `deps.empresa_atual` chama `app_definir_escopo()` após definir a empresa (inclusive no WebSocket); verificar com teste de API que um comercial recebe o próprio id em `app_usuarios_visiveis()`

## 3. Políticas de visibilidade (leitura)

- [ ] 3.1 Converter `tenant_*` das tabelas escopadas em `RESTRICTIVE` e criar `app_pode_ver_*` + políticas `FOR SELECT` para cliente, negócio, orçamento (+ itens), projeto, etapa, participante, tarefa (+ checklist) conforme o design; verificar com teste SQL de cada cenário da spec `visibilidade-por-escopo` (comercial, líder, admin, sem dono, sem dono sob registro com dono) e `carteira-clientes` (dono do cliente vê tudo)
- [ ] 3.2 Isolamento entre empresas continua: rodar `tests_sql` existentes de RLS e `tests/test_multi_tenant.py` sem regressão
- [ ] 3.3 `EXPLAIN ANALYZE` das listagens principais com o escopo ativo (base: `0005-explain-analyze-rls.sql`); registrar resultado em `docs/MULTI_TENANCY.md` e verificar que nenhuma listagem usa varredura sequencial em tabela grande

## 4. Políticas de edição, dono e transferência

- [ ] 4.1 `app_pode_editar_*` + políticas `FOR INSERT/UPDATE/DELETE` (dono, líderes, admin; etapa/tarefa pelo responsável; ver pela posse do cliente não edita; vínculo só com cliente visível); verificar com testes SQL dos cenários de `atuacao-em-projetos` e "Quem edita clientes e negócios"
- [ ] 4.2 Gatilho de dono: padrão = criador, só líder (dentro de V) ou admin define outro dono ou retira o dono; grava `transferencia_dono`; negócio transferido leva os orçamentos; verificar com testes SQL de "Transferência de dono" e "Dono padrão de registros novos"
- [ ] 4.3 Regra de criação de tarefa no projeto (participante → participantes; responsável/líder/admin → qualquer pessoa); verificar com teste dos dois cenários da spec

## 5. API

- [ ] 5.1 Tratador global: violação de RLS (`42501`) e UPDATE/DELETE sem linhas afetadas → 404 "não encontrado"; cliente fora do escopo em vínculo → "cliente não encontrado"; verificar com teste de API que abrir/alterar negócio alheio responde igual a id inexistente
- [ ] 5.2 Endpoints de equipes (admin): CRUD, membros, líderes; verificar matriz de permissão (admin sim, demais 403) em `tests/test_permissoes.py`
- [ ] 5.3 Campo `responsavel_id` em cliente (schemas/serviços) e endpoint de transferência de dono por entidade; verificar com teste de API líder/admin/comercial
- [ ] 5.4 Participantes do projeto: listar, incluir, retirar (responsável do projeto, líderes, admin); verificar com teste de API
- [ ] 5.5 `pode_editar` nos DTOs de negócio, projeto, etapa e tarefa; verificar com teste que participante sem responsabilidade recebe `false`
- [ ] 5.6 `app_nomes_clientes` / `app_titulos_projetos` em `GET /clientes/referencias` e nas listagens; documentos (orçamento, plano de entrega) com cliente completo só se visível; verificar com teste do membro com uma tarefa e do executor de tarefa avulsa
- [ ] 5.7 Painel e relatórios: verificar com teste de API que totais do painel de um comercial somam só o escopo dele
- [ ] 5.8 Presença no tempo real sem título do registro; verificar com teste em `tests/test_realtime.py`
- [ ] 5.9 Regenerar `openapi.json` e `schema.d.ts` (`make openapi`) e verificar `npm run typecheck`

## 6. Frontend

- [ ] 6.1 Tela Administração › Equipes (equipes, membros, líderes); verificar no navegador criar equipe, incluir membro e líder
- [ ] 6.2 Campo "Dono" em cliente, negócio, projeto e tarefa: editável só para líder/admin, com lista de pessoas permitida; verificar no navegador com usuário comercial (somente leitura) e líder
- [ ] 6.3 Seção Participantes no projeto e modo leitura por `pode_editar` em projeto/etapa/tarefa; verificar no navegador com responsável de etapa
- [ ] 6.4 Registro fora do escopo aberto pela URL mostra "registro não encontrado"; verificar no navegador
- [ ] 6.5 Aviso no painel do admin enquanto não houver equipes; testes unitários do front para os novos formulários (`vitest`)

## 7. Integração e entrega

- [ ] 7.1 Roteiro ponta a ponta com quatro pessoas (admin, líder, comercial, membro executor) cobrindo um cenário de cada spec; verificar que todos passam
- [ ] 7.2 Aplicar a migração em branch do Neon, rodar suíte e `EXPLAIN ANALYZE`, e documentar o procedimento de deploy (montar equipes logo após) em `docs/MULTI_TENANCY.md`
