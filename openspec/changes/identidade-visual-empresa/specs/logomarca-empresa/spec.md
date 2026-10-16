## ADDED Requirements

### Requirement: Envio da logomarca
O sistema SHALL permitir que administradores enviem uma logomarca PNG, JPEG ou WebP de até 512 KB para a empresa ativa, detectando o formato pelo conteúdo do arquivo, e SHALL permitir removê-la.

#### Scenario: Envio válido
- **WHEN** o administrador envia uma imagem PNG de 100 KB
- **THEN** a logomarca é gravada e passa a ser exibida acima do menu

#### Scenario: Formato ou tamanho recusado
- **WHEN** o arquivo é SVG, GIF, maior que 512 KB ou não é uma imagem
- **THEN** o sistema recusa com mensagem clara e mantém a logomarca anterior

#### Scenario: Papel sem administração
- **WHEN** um usuário que não é administrador tenta enviar ou remover a logomarca
- **THEN** o acesso é negado

### Requirement: Logomarca na interface e nos documentos
O sistema SHALL exibir a logomarca da empresa ativa no lugar da logo padrão acima do menu (expandido e recolhido) e nos documentos e relatórios gerados (orçamento, plano de entrega, DRE e fluxo de caixa), usando a logo padrão quando não houver logomarca.

#### Scenario: Empresa com logomarca
- **WHEN** um usuário de qualquer papel abre o Hub numa empresa com logomarca
- **THEN** a logomarca da empresa aparece acima do menu

#### Scenario: Relatório financeiro
- **WHEN** o usuário exporta a DRE em PDF
- **THEN** o cabeçalho traz a logomarca e o rodapé traz os dados de contato da empresa
