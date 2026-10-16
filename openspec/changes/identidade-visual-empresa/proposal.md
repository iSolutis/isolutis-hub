## Why

Cada empresa do Hub usa a logo e as cores da iSolutis: a interface, os orçamentos, o plano de entrega e os relatórios financeiros não carregam a marca de quem os emite. Pedido do produto ("Melhorias no hub"):

- Cadastro da empresa completo, com a possibilidade de adicionar a logomarca, usada nos relatórios e no lugar da logo padrão acima do menu.
- Configuração da paleta de cores da aplicação.

## What Changes

- **Cadastro completo da empresa** (antecipa a parte de cadastro de `empresa-completa-e-consulta-cnpj`, sem a consulta de CNPJ): inscrição (tipo + número, primeiros campos), razão social, nome fantasia, contato, endereço com município/UF e dados fiscais informativos. API `GET/PUT /empresas/ativa`.
- **Logomarca**: upload (PNG, JPEG ou WebP, até 512 KB; tipo detectado pelos bytes, SVG recusado), remoção, exibição acima do menu (expandido e recolhido) e nos documentos: orçamento (PDF), plano de entrega (HTML) e DRE/Fluxo de caixa (PDF). Sem logomarca, tudo segue com a logo padrão. API `PUT/DELETE /empresas/ativa/logo`.
- **Documentos com os dados do emissor**: cabeçalho e rodapé dos documentos passam a usar nome, razão social, inscrição, contato e endereço da empresa, em vez do texto fixo da iSolutis.
- **Paleta de cores** (nova tela Administração › Aparência): paletas sugeridas ou duas cores próprias (primária e destaque), pré-visualização imediata, salvar, descartar e voltar à padrão. Os demais tons dos temas claro e escuro são derivados das duas cores com contraste mínimo garantido. API `PUT/DELETE /empresas/ativa/paleta`.
- Leitura (`GET /empresas/ativa`) aberta a qualquer papel, porque a casca aplica logo e paleta para toda a equipe; alterações só por administradores. Mudanças chegam às outras abas pelo tempo real (recurso `empresa`).

## Capabilities

### New Capabilities
- `logomarca-empresa`: envio, validação, exibição e uso da logomarca nos documentos.
- `paleta-cores`: paleta da empresa, derivação de tons e aplicação na interface.

### Modified Capabilities
- `cadastro-empresa` (da change `empresa-completa-e-consulta-cnpj`): implementado aqui, exceto "situação cadastral" (vem da consulta de CNPJ) e a consulta em si.

## Impact

- Banco: migração `0012` aditiva na tabela `empresa` (colunas anuláveis, checks, índice único parcial da inscrição, `logo bytea`, `paleta jsonb`).
- Backend: `models/parceiro.py`, `schemas/empresa.py`, `services/empresa.py`, `routers/empresa.py`, `documents/*`, `routers/{orcamentos,projetos,relatorios}.py`, `db.py` (tempo real).
- Frontend: `features/empresa.ts`, `features/aparencia.ts`, `ui/identidade.ts`, `styles/identidade.css`, `main.ts`, menu e ícone.
