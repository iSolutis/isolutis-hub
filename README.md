# Hub Comercial iSolutis

Sistema comercial interno da iSolutis: clientes, negócios e funil, orçamentos, projetos com relatório de entrega, faturamento, despesas e investimentos, e produtos.

É uma página só (`index.html`), sem build. Os dados ficam no Supabase, no projeto `dqpatgyqyqonikbbgymu`.

## Como funciona o acesso

- Cada pessoa entra com e-mail e senha (Supabase Auth).
- Só os e-mails cadastrados na tabela `hub_membros` conseguem ler ou gravar dados. Isso é garantido pelas regras do banco (RLS), não pela página.
- A chave que aparece no `index.html` é a **publishable**, feita para ficar visível. **Nunca coloque a chave secreta (`sb_secret_...`) neste repositório.**

## Preparar o Supabase (uma vez)

1. **SQL Editor → New query**: cole o conteúdo de `supabase.sql` e clique em **Run**.
2. **Authentication → Sign In / Providers**: desligue **Allow new users to sign up**, para que ninguém crie conta sozinho.
3. **Authentication → URL Configuration**: em **Site URL**, coloque o endereço onde o Hub foi publicado (por exemplo `https://hub.isolutis.com.br`). Adicione o mesmo endereço em **Redirect URLs**.
4. **Authentication → Users → Add user → Send invitation**: convide cada pessoa da equipe pelo e-mail. Ela recebe um link, abre o Hub e cria a própria senha.

## Incluir ou tirar alguém da equipe

No SQL Editor:

```sql
insert into public.hub_membros (email, nome) values ('email@exemplo.com', 'Nome');
delete from public.hub_membros where email = 'email@exemplo.com';
```

Depois convide (ou remova) o usuário em **Authentication → Users**.

## Tabelas

`hub_clientes`, `hub_negocios`, `hub_orcamentos`, `hub_faturamento`, `hub_produtos`, `hub_despesas` e `hub_projetos`. Cada linha tem `id`, `dados` (o registro em JSON), `criado_em`, `atualizado_em` e `atualizado_por`.

## Painel de usuários (aba Equipe)

Só administradores (`hub_membros.admin = true`) veem a aba **Equipe**, onde dá para criar usuários com senha, trocar a senha de qualquer pessoa, definir administradores e remover alguém. Nada disso depende de e-mail.

A troca de senha precisa da chave secreta, que **fica só no Supabase**, dentro da Edge Function `hub-admin` (`supabase/functions/hub-admin/index.ts`). A página nunca vê essa chave.

Para ativar:

1. Rode `supabase/admin.sql` no SQL Editor (cria a coluna `admin` e marca a Soraya como administradora).
2. **Edge Functions → Deploy a new function → Via Editor**, com o nome `hub-admin-` (é o nome que o Hub chama; foi publicada assim). Cole o conteúdo de `supabase/functions/hub-admin/index.ts` e clique em **Deploy**.
3. Nas configurações da função, desligue **Verify JWT** (ou "Enforce JWT verification"). A própria função confere o login e se a pessoa é administradora.
