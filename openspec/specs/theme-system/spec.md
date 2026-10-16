# theme-system Specification

## Purpose
Temas claro e escuro: paleta por tokens, detecção do esquema do sistema operacional com substituição manual, cores semânticas de status e alternância na interface.
## Requirements
### Requirement: Color token definitions
The CSS token system SHALL define a complete palette for light and dark themes with consistent values, using semantically accurate names that reflect the actual color they represent.

#### Scenario: Light theme colors defined
- **WHEN** page loads in light mode
- **THEN** tokens include:
  - Backgrounds: `--bg` (#ffffff), `--surface` (#ffffff), `--sunk` (#f5f7fb)
  - Text: `--ink` (#16223b), `--muted` (#56647a)
  - Accents: `--navy` (#1a2d47), `--teal` (#3b9ca8)
  - Teal scale: `--teal-mid` (#0d8792), `--teal-pale` (#dbf3f5)
  - Status colors: `--ok`, `--warn`, `--bad`, `--info`

#### Scenario: Dark theme colors defined
- **WHEN** page loads in dark mode
- **THEN** tokens include inverted palette:
  - Backgrounds: `--bg` (#0d1520), `--surface` (#151e2f), `--sunk` (#0f1829)
  - Text: `--ink` (#e8edf4), `--muted` (#a0afc4)
  - Teal scale: `--teal-mid` and `--teal-pale` com valores adaptados para dark mode

#### Scenario: Tokens --gold e --gold-soft não existem mais
- **WHEN** os arquivos CSS são inspecionados após a migração
- **THEN** nenhuma ocorrência de `--gold` ou `--gold-soft` existe em qualquer arquivo
- **AND** todos os usos anteriores foram substituídos por `--teal-mid` e `--teal-pale` respectivamente

#### Scenario: Explicit color space
- **WHEN** page loads
- **THEN** root CSS element declares `color-space: srgb`
- **AND** this ensures colors render consistently across browsers

### Requirement: Color scheme detection and override
The theme system SHALL respect OS-level dark mode preference while allowing explicit theme override.

#### Scenario: Responds to prefers-color-scheme
- **WHEN** browser `prefers-color-scheme` is light
- **THEN** light theme tokens apply
- **AND** when `prefers-color-scheme` is dark, dark theme tokens apply

#### Scenario: Explicit data-theme overrides preference
- **WHEN** root element has `data-theme="dark"` attribute
- **THEN** dark theme tokens apply regardless of `prefers-color-scheme`
- **AND** when `data-theme="light"`, light theme tokens apply

#### Scenario: No browser-specific rendering differences
- **WHEN** opening page in Chrome, Firefox, Brave, Safari, Edge
- **THEN** colors render identically in all browsers
- **AND** no excessive darkening or lightening occurs in any single browser

### Requirement: Status and semantic colors
The theme system SHALL include semantic colors for different message types.

#### Scenario: Success/OK color
- **WHEN** displaying success messages or indicators
- **THEN** `--ok` color is used (#4a9d6f in light, #6fd19f in dark)
- **AND** `--ok-bg` provides the background color for success UI elements

#### Scenario: Warning color
- **WHEN** displaying warning messages or indicators
- **THEN** `--warn` color is used (#b89a3d in light, #d9b860 in dark)

#### Scenario: Error/Bad color
- **WHEN** displaying error messages or indicators
- **THEN** `--bad` color is used (#a85d52 in light, #d98a7f in dark)

#### Scenario: Info color
- **WHEN** displaying informational messages
- **THEN** `--info` color is used (#5b8dd9 in light, #9cc2f0 in dark)

### Requirement: Alternância manual de tema
A interface SHALL oferecer, na barra superior, a escolha entre os temas Sistema, Claro e Escuro, com Sistema como padrão, e a escolha SHALL ter efeito imediato em toda a aplicação.

#### Scenario: Escolher o tema escuro
- **WHEN** o usuário escolhe "Escuro" na alternância de tema
- **THEN** a aplicação inteira passa a usar a paleta escura imediatamente

#### Scenario: Escolher o tema do sistema
- **WHEN** o usuário escolhe "Sistema" e o sistema operacional está em modo escuro
- **THEN** a aplicação usa a paleta escura

#### Scenario: Sistema muda enquanto a aplicação está aberta
- **WHEN** a preferência é "Sistema" e o usuário altera o modo do sistema operacional
- **THEN** a aplicação acompanha a mudança sem recarregar

#### Scenario: Estado atual indicado
- **WHEN** o usuário abre a alternância de tema
- **THEN** a opção em vigor aparece marcada e acessível por leitores de tela

---

### Requirement: Persistência do tema e aplicação sem flash
O sistema SHALL lembrar a escolha de tema entre sessões e SHALL aplicá-la antes da primeira pintura da página, sem exibir momentaneamente o tema errado.

#### Scenario: Escolha lembrada
- **WHEN** o usuário escolhe "Escuro" e recarrega a aplicação
- **THEN** a aplicação abre diretamente no tema escuro

#### Scenario: Sem flash do tema errado
- **WHEN** a página é carregada com a preferência "Escuro"
- **THEN** a primeira pintura já usa a paleta escura

#### Scenario: Armazenamento indisponível
- **WHEN** o navegador não permite gravar preferências
- **THEN** a aplicação funciona normalmente seguindo o tema do sistema
