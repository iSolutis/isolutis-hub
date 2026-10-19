## 1. Banco (migrations)

- [x] 1.1 Migration: papel `socio` em `papel_parceiro` e tabela `parceiro_socio` (participação 0–100)
- [x] 1.2 Migration: `recorrencia_titulo` (frequência, início, término, `gerado_ate`, ativa) e `recorrencia_id` em `titulo_financeiro` com unicidade (`recorrencia_id`, `data_vencimento`)
- [x] 1.3 Conta "Aporte de sócio" no plano de contas padrão, marcada para ficar fora da receita operacional
- [x] 1.4 Migration que remove `despesas`, `investimentos`, `investidores` e `categorias_despesa` (com `down` que recria as tabelas vazias)

## 2. Backend: sócios e permissões

- [x] 2.1 Serviço e schemas de participação do sócio, com validação de soma ≤ 100 e remoção ao retirar o papel
- [x] 2.2 Validar papel `socio` nos títulos da conta de aporte e papel `fornecedor` nos títulos a pagar
- [x] 2.3 Impor no servidor o acesso aos parceiros por papel de parceiro (`deps.py`, `routers/parceiros.py`): Funcionários e Sócios só `admin`; testar em `test_permissoes*`

## 3. Backend: recorrência

- [x] 3.1 Regras puras de cálculo de vencimentos (todas as frequências, mês curto, término por data/quantidade/sem fim) em `regras.py`
- [x] 3.2 Serviço, rotas e schemas de recorrência (criar, listar, editar, pausar, encerrar)
- [x] 3.3 Geração de títulos (horizonte móvel, idempotente) na gravação do modelo e job em `scheduler.py`
- [x] 3.4 Testes de recorrência (frequências, términos, repetição do job, reajuste, pausa, encerramento, título quitado intocado)

## 4. Backend: fim do módulo Despesas

- [x] 4.1 Trocar a fonte de relatórios e painel de `Despesa` para títulos a pagar quitados, excluindo aportes da receita operacional; testes
- [x] 4.2 Remover `routers/despesas.py`, `services/despesas.py`, schemas e modelos; atualizar `openapi.json` e `schema.d.ts`
- [x] 4.3 Ajustar `importar_legado.py` e fixtures de teste que usam despesas/investimentos

## 5. Frontend

- [x] 5.1 `menu.ts`: grupo "Cadastros" (Clientes, Fornecedores, Funcionários, Sócios), remover Despesas, ícones e ações rápidas por papel
- [x] 5.2 Tela de parceiros reutilizável com filtro de papel e rota por papel; migrar `clientes.ts` e `financeiro/parceiros.ts`
- [x] 5.3 Formulário: pré-seleção do papel, papéis múltiplos, ao menos um papel, campo de participação quando Sócio está marcado e aviso de soma
- [x] 5.4 Títulos: opção "Recorrente" no formulário (frequência e término), indicador nos títulos gerados e lista de recorrências com editar, pausar e encerrar
- [x] 5.5 Remover `features/despesas.ts`, endpoints e tipos; redirecionar a URL antiga para Títulos
- [x] 5.6 Estados de carregamento, vazio, erro e acessibilidade nas novas telas

## 6. Validação

- [x] 6.1 Testes unitários (menu, roteador, paleta) e e2e (`casca`, `rotas`, parceiro com dois papéis, sócio com participação, aporte, criar recorrência)
- [ ] 6.2 Rodar build, lint, type-check e testes do backend e frontend — **pendente: testes de integração do backend (exigem PostgreSQL em localhost:5432; `docker compose up -d db`)**. Já passaram: build, tsc, vitest (exceto 1 falha antiga em `validators.test.ts`), Playwright/Chromium nos specs de cadastros, rotas, casca e formulário de cliente, e os testes do backend que não usam banco
- [x] 6.3 Revisar o diff final (segurança de permissões, remoção sem referências órfãs)
