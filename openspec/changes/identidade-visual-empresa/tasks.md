## 1. Banco

- [x] 1.1 Migração 0012 aditiva + down: cadastro completo, logomarca (`bytea` ≤ 512 KB, tipo), paleta (`jsonb`), checks e índice único parcial da inscrição
- [x] 1.2 Model `Empresa` com as novas colunas (`logo` deferred)

## 2. Backend

- [x] 2.1 `GET /empresas/ativa` (qualquer papel) e `PUT /empresas/ativa` (admin) com validação de CNPJ/CPF e duplicidade
- [x] 2.2 `PUT/DELETE /empresas/ativa/logo` com detecção do formato pelos bytes
- [x] 2.3 `PUT/DELETE /empresas/ativa/paleta`
- [x] 2.4 Identidade do emissor nos documentos: orçamento, plano de entrega, DRE e fluxo de caixa
- [x] 2.5 Tempo real: recurso `empresa` avisa as outras abas
- [x] 2.6 Testes (`tests/test_empresa.py`): permissões, validações, logo, paleta, isolamento entre empresas, documento

## 3. Frontend

- [x] 3.1 Tela "Dados da empresa" em seções, inscrição primeiro, máscaras de CNPJ/CPF e CEP, município por UF, rascunho preservado entre redesenhos e guarda de saída
- [x] 3.2 Logomarca: envio, prévia, remoção; aplicação acima do menu
- [x] 3.3 Tela "Aparência": paletas sugeridas, cores próprias, pré-visualização, salvar/descartar/restaurar
- [x] 3.4 `ui/identidade.ts`: derivação de tokens com contraste, aplicação, cache local por empresa, limpeza ao sair
- [x] 3.5 Testes (`ui/identidade.test.ts`, `features/empresa.test.ts`)

## 4. Pendências

- [ ] 4.1 Consulta de CNPJ (BrasilAPI) e "situação cadastral" — seguem em `empresa-completa-e-consulta-cnpj`
- [ ] 4.2 Logomarca na planilha XLSX dos relatórios
