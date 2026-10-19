## ADDED Requirements

### Requirement: Máscara de CPF/CNPJ na digitação
Todo campo de entrada de CPF/CNPJ do Hub SHALL aplicar a máscara enquanto o usuário digita: CPF no formato `000.000.000-00` (até 11 dígitos) e CNPJ no formato `00.000.000/0000-00` (até 14 dígitos). O campo SHALL aceitar apenas dígitos, descartando qualquer outro caractere digitado ou colado, e SHALL NOT aceitar mais dígitos que o limite do tipo vigente.

#### Scenario: Digitar CNPJ
- **WHEN** o tipo vigente é pessoa jurídica (ou CNPJ) e o usuário digita `11222333000181`
- **THEN** o campo exibe `11.222.333/0001-81`

#### Scenario: Digitar CPF
- **WHEN** o tipo vigente é pessoa física (ou CPF) e o usuário digita `52998224725`
- **THEN** o campo exibe `529.982.247-25`

#### Scenario: Máscara parcial
- **WHEN** o tipo vigente é CNPJ e o usuário digitou apenas `112223`
- **THEN** o campo exibe `11.222.3` sem separadores sobrando

#### Scenario: Dígitos além do limite
- **WHEN** o tipo vigente é CPF e o usuário tenta digitar um 12º dígito
- **THEN** o campo permanece com os 11 dígitos já mascarados

#### Scenario: Colar documento já formatado ou com caracteres estranhos
- **WHEN** o usuário cola `11.222.333/0001-81` ou `11 222 333 0001 81` num campo cujo tipo vigente é CNPJ
- **THEN** o campo exibe `11.222.333/0001-81`

#### Scenario: Editar no meio do número
- **WHEN** o usuário apaga ou insere um dígito no meio de um documento já mascarado
- **THEN** a máscara é reaplicada e o cursor permanece logo após o dígito editado, e não salta para o fim do campo

### Requirement: Máscara obedece ao tipo de pessoa selecionado
Nas telas em que o usuário seleciona o tipo de pessoa (física ou jurídica) ou o tipo de inscrição (CPF ou CNPJ), o modelo da máscara, o limite de dígitos e o texto de exemplo (placeholder) do campo de documento SHALL corresponder à seleção atual. Ao trocar a seleção, o valor já digitado SHALL ser remascarado no modelo do novo tipo, mantendo os dígitos até o limite do novo tipo.

#### Scenario: Formulário de parceiro abre como pessoa jurídica
- **WHEN** o usuário abre o cadastro de um novo parceiro ou cliente com "Tipo de pessoa" em pessoa jurídica
- **THEN** o campo de documento mostra o exemplo `00.000.000/0000-00` e mascara como CNPJ

#### Scenario: Trocar para pessoa física
- **WHEN** o usuário seleciona "Pessoa física (CPF)" no formulário de parceiro ou cliente
- **THEN** o campo de documento passa a mostrar o exemplo `000.000.000-00` e a mascarar como CPF

#### Scenario: Remascarar ao trocar de jurídica para física
- **WHEN** o campo contém `11.222.333/0001-81` e o usuário troca o tipo para pessoa física
- **THEN** o campo passa a exibir `112.223.330-00`, com os 11 primeiros dígitos no modelo de CPF

#### Scenario: Remascarar ao trocar de física para jurídica
- **WHEN** o campo contém `529.982.247-25` e o usuário troca o tipo para pessoa jurídica
- **THEN** o campo passa a exibir `52.998.224/725`, no modelo de CNPJ

#### Scenario: Dados da empresa
- **WHEN** o usuário troca o "Tipo de inscrição" entre CNPJ e CPF em "Dados da empresa"
- **THEN** o número de inscrição segue a mesma máscara, limite e exemplo do tipo selecionado

#### Scenario: Editar cadastro existente
- **WHEN** o usuário abre a edição de um parceiro, cliente ou empresa já salvo com documento
- **THEN** o campo exibe o documento salvo mascarado conforme o tipo gravado no cadastro

### Requirement: Documento exibido formatado em todas as telas
Toda exibição somente leitura de CPF/CNPJ (listas, opções de seleção, rótulos) SHALL mostrar o documento formatado: 11 dígitos como CPF, 14 dígitos como CNPJ. Documento ausente SHALL ser exibido como `—`, e um valor com outra quantidade de dígitos SHALL ser exibido como está, sem perda de informação.

#### Scenario: Lista de parceiros
- **WHEN** a lista de parceiros mostra um parceiro com documento `11222333000181`
- **THEN** a coluna Documento exibe `11.222.333/0001-81`

#### Scenario: Seleção de parceiro em títulos e recorrências
- **WHEN** o usuário abre a escolha de parceiro num título ou numa recorrência
- **THEN** cada opção mostra o nome seguido do documento formatado

#### Scenario: Parceiro sem documento
- **WHEN** o parceiro não tem CPF/CNPJ cadastrado
- **THEN** o documento é exibido como `—`

### Requirement: Valor enviado sem máscara
A máscara SHALL ser apenas de apresentação: o documento SHALL ser gravado somente com dígitos, e a validação dos dígitos verificadores conforme o tipo continua a cargo do servidor.

#### Scenario: Salvar parceiro com documento mascarado
- **WHEN** o usuário salva um parceiro com o campo exibindo `529.982.247-25` e tipo pessoa física
- **THEN** o cadastro é gravado com o documento `52998224725`

#### Scenario: Documento com dígitos verificadores inválidos
- **WHEN** o usuário salva um documento mascarado cujo dígito verificador não confere com o tipo selecionado
- **THEN** o salvamento é recusado com a mensagem de CPF ou CNPJ inválido, como hoje
