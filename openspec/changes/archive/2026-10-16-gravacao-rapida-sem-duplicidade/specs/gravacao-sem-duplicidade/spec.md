## ADDED Requirements

### Requirement: Uma tentativa de salvar cria no máximo um registro
O sistema SHALL garantir que cliques ou toques repetidos, Enter repetido e reenvio de uma mesma tentativa de salvar resultem em um único registro criado.

#### Scenario: Cliques repetidos em Salvar
- **WHEN** o usuário clica em Salvar duas ou mais vezes enquanto a gravação está em andamento
- **THEN** só uma requisição de criação é enviada e um único registro é criado

#### Scenario: Reenvio da mesma tentativa
- **WHEN** o servidor recebe duas requisições de criação com a mesma chave de idempotência do mesmo usuário e empresa
- **THEN** só a primeira cria o registro e a segunda recebe a mesma resposta (mesmo status e mesmo id), inclusive quando chegam ao mesmo tempo

#### Scenario: Chave reutilizada em outra operação
- **WHEN** uma chave já usada chega com outra rota ou outro corpo
- **THEN** o servidor recusa com erro de validação e não grava

#### Scenario: Sem chave de idempotência
- **WHEN** a requisição de criação não traz chave
- **THEN** o servidor se comporta como antes (cria o registro)

#### Scenario: Cliente criado junto com outro registro
- **WHEN** o usuário escolhe "+ Novo cliente…", o cliente é criado e a gravação do registro principal falha
- **THEN** ao tentar salvar de novo o cliente já criado é reutilizado e nenhum cliente duplicado é criado

### Requirement: Retorno imediato e botão que nunca fica preso
O sistema SHALL mostrar o estado "Salvando…" assim que o usuário aciona Salvar e SHALL restaurar o botão quando a gravação terminar, com sucesso ou erro.

#### Scenario: Gravação em andamento
- **WHEN** o usuário aciona Salvar
- **THEN** o botão fica desabilitado com "Salvando…" até o servidor responder

#### Scenario: Erro na gravação
- **WHEN** o servidor recusa ou a rede falha
- **THEN** o aviso de erro aparece, o botão volta a "Salvar" habilitado e o formulário mantém o que foi digitado

#### Scenario: Erro de validação no formulário
- **WHEN** o formulário tem campo inválido
- **THEN** nada é enviado e o botão não chega a ser travado

### Requirement: Conclusão percebida sem esperar a recarga das listas
O sistema SHALL fechar a gaveta e confirmar o salvamento assim que o servidor confirma a gravação, sem aguardar a recarga das listas.

#### Scenario: Gravação concluída
- **WHEN** o servidor confirma a criação ou a alteração
- **THEN** a gaveta fecha e o aviso "salvo" aparece, e as listas se atualizam logo em seguida

#### Scenario: Recarga falha depois de gravar
- **WHEN** a gravação foi confirmada e a recarga das listas falha
- **THEN** o registro permanece gravado e o usuário recebe um aviso para atualizar a tela
