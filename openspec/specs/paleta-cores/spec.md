# paleta-cores Specification

## Purpose
Paleta de cores da empresa: paletas sugeridas ou duas cores próprias (primária e destaque), pré-visualização, derivação dos demais tons dos temas claro e escuro com contraste mínimo garantido e aplicação na interface para toda a equipe.

## Requirements
### Requirement: Paleta de cores da empresa
O sistema SHALL permitir que administradores escolham para a empresa ativa uma paleta sugerida ou duas cores próprias (primária e destaque, no formato #rrggbb), com pré-visualização antes de salvar, e SHALL aplicar a paleta salva a toda a equipe da empresa nos temas claro e escuro.

#### Scenario: Pré-visualizar e salvar
- **WHEN** o administrador escolhe uma paleta
- **THEN** a interface muda imediatamente como pré-visualização
- **AND** ao salvar, os demais usuários da empresa passam a ver as novas cores

#### Scenario: Sair sem salvar
- **WHEN** o administrador deixa a tela com uma paleta não salva
- **THEN** o sistema pede confirmação e, ao descartar, volta às cores salvas

#### Scenario: Voltar ao padrão
- **WHEN** o administrador restaura a paleta padrão
- **THEN** a empresa volta às cores padrão do Hub

#### Scenario: Cor inválida
- **WHEN** a API recebe uma cor fora do formato #rrggbb
- **THEN** a gravação é recusada

### Requirement: Legibilidade garantida
O sistema SHALL derivar os tons da interface a partir das duas cores garantindo contraste mínimo de 4,5:1 para texto e para o texto dos botões principais, e de 7:1 entre o menu lateral e seu texto.

#### Scenario: Cor primária clara
- **WHEN** a cor primária escolhida é um amarelo claro
- **THEN** o tom usado em textos e botões é escurecido até atingir o contraste mínimo
