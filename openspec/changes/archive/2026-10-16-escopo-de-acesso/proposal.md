# Proposal

## Why

A principal ameaça ao Hub é o próprio usuário autenticado acessando o que não lhe compete. Hoje o papel abre **áreas inteiras** da empresa: todo comercial vê o funil, a carteira e os orçamentos de todos os colegas, todo membro vê todos os projetos e tarefas, e o navegador recebe as coleções completas. Com exigências de LGPD e equipes comerciais com carteira própria, o acesso precisa considerar **de quem** é cada registro, e não só **em que área** ele está.

## What Changes

- **Equipes e liderança**: a empresa organiza pessoas em equipes; cada equipe tem um ou mais líderes. Uma pessoa pode estar em várias equipes e a liderança é aninhada: quem lidera uma equipe cujo membro também lidera outra enxerga os dois níveis. Gerenciadas pelo administrador.
- **Escopo de visibilidade**: o papel continua definindo as **áreas** (admin, financeiro, comercial, membro — sem papel novo). Dentro da área, cada pessoa vê: registros sem dono, os seus, os de toda a árvore que lidera e, se for admin, todos. **BREAKING**: comercial e membro deixam de ver registros de colegas fora da sua liderança.
- **Dono do cliente (carteira)**: cliente passa a ter dono. O dono vê tudo o que pende do cliente (negócios, orçamentos, projetos, tarefas), mesmo sob responsabilidade de outra pessoa. Quem enxerga um registro de cliente alheio vê apenas o nome do cliente, não o cadastro.
- **Transferência de dono** (cliente, negócio, projeto, tarefa): só o líder (dentro da sua árvore) e o admin; registros novos nascem com quem os criou como dono, e só líder/admin podem deixá-los sem dono.
- **Participação em projetos — ver ≠ atuar**: responsável do projeto, responsáveis de etapa e participantes incluídos veem o projeto inteiro, mas só editam o que é seu; quem é responsável apenas por uma tarefa vê só aquela tarefa (com o nome do projeto como referência).
- **Referências mínimas**: a lista de clientes usada para exibir nomes em projetos/tarefas passa a conter só os clientes que a pessoa enxerga.
- **Imposição no banco**: as regras valem para listas, detalhes, painel, relatórios, documentos e avisos de tempo real, porque são aplicadas pelo banco de dados (RLS) além da API.
- **Migração**: clientes existentes recebem como dono o responsável do negócio mais recente com eles; o restante fica sem dono (visível). Nenhuma equipe é criada automaticamente.

## Capabilities

### New Capabilities
- `equipes`: equipes da empresa, membros, líderes, liderança aninhada e quem as administra.
- `carteira-clientes`: dono do cliente, o que o dono enxerga, dono padrão e transferência de dono de registros.
- `visibilidade-por-escopo`: o que cada pessoa enxerga dentro de uma área (sem dono, próprios, liderados, admin), inclusive em agregados, documentos e referências.
- `atuacao-em-projetos`: participantes do projeto, separação entre ver e editar em projetos, etapas e tarefas.

### Modified Capabilities
<!-- Nenhuma spec existente descreve autorização por papel; as regras entram como capabilities novas. -->

## Impact

- **Banco**: tabelas `equipe`, `equipe_membro`, `equipe_lider`, `projeto_participante`; coluna `responsavel_id` em `parceiro_negocio`; funções de escopo; políticas RLS de leitura e escrita em `parceiro_negocio`, `negocios`, `orcamentos` (+ itens), `projetos`, `projeto_etapas`, `tarefas` (+ checklist); migração de donos. A área financeira (títulos, faturamento, despesas, hub de parceiros) não ganha escopo nesta mudança.
- **Backend**: `deps.py` (calcula o conjunto visível por requisição e o passa à transação), serviços e routers de clientes, negócios, orçamentos, projetos, tarefas, painel, documentos; novos endpoints de equipes, transferência de dono e participantes; `clientes/referencias`; tempo real.
- **Frontend**: telas de equipes (admin), campo "Dono" com transferência, participantes do projeto, edição bloqueada onde a pessoa só vê; listas menores vindas do servidor.
- **Operação**: após o deploy, o admin precisa montar as equipes para que os líderes recuperem a visão do time.
- **Fora do escopo** (mudanças seguintes): trilha de auditoria/exportação/marca d'água (`auditoria-e-exportacao`) e correções pontuais de segurança (`correcoes-seguranca`).
