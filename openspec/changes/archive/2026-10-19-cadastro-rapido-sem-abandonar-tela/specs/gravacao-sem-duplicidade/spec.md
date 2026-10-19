## MODIFIED Requirements

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

#### Scenario: Cliente criado pelo cadastro rápido
- **WHEN** o usuário cria um cliente pelo cadastro rápido e depois a gravação do registro principal falha
- **THEN** ao tentar salvar de novo o cliente já criado continua selecionado e nenhum cliente duplicado é criado
