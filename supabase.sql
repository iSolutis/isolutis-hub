-- Hub Comercial iSolutis: tabelas, regras de acesso e tempo real no Supabase.
-- Como usar: Supabase > SQL Editor > New query > cole tudo > Run.
-- Pode rodar de novo sem problema: nada é apagado.

-- 1. Equipe: só quem estiver nesta lista consegue ler ou gravar qualquer dado do Hub.
create table if not exists public.hub_membros (
  email text primary key,
  nome  text not null
);
alter table public.hub_membros enable row level security;

create or replace function public.hub_eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hub_membros m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.hub_eh_membro() from public;
grant execute on function public.hub_eh_membro() to authenticated;

drop policy if exists "membros leem a equipe" on public.hub_membros;
create policy "membros leem a equipe" on public.hub_membros
  for select to authenticated using (public.hub_eh_membro());
revoke all on public.hub_membros from anon;
grant select on public.hub_membros to authenticated;

-- 2. Carimbo de quem alterou e quando.
create or replace function public.hub_carimbo() returns trigger
language plpgsql as $$
begin
  new.atualizado_em  := now();
  new.atualizado_por := auth.jwt() ->> 'email';
  return new;
end $$;

-- 3. Uma tabela por área do Hub. Cada registro guarda os campos da tela em "dados".
do $$
declare t text;
begin
  foreach t in array array['hub_clientes','hub_negocios','hub_orcamentos','hub_faturamento',
                           'hub_produtos','hub_despesas','hub_projetos'] loop
    execute format('create table if not exists public.%I (
        id             text primary key,
        dados          jsonb not null default ''{}''::jsonb,
        criado_em      timestamptz not null default now(),
        atualizado_em  timestamptz not null default now(),
        atualizado_por text)', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "membros acessam" on public.%I', t);
    execute format('create policy "membros acessam" on public.%I for all to authenticated
                    using (public.hub_eh_membro()) with check (public.hub_eh_membro())', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('drop trigger if exists hub_carimbo on public.%I', t);
    execute format('create trigger hub_carimbo before insert or update on public.%I
                    for each row execute function public.hub_carimbo()', t);
    -- tempo real: o que um sócio salva aparece na hora para os outros
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- 4. Quem pode entrar (os mesmos e-mails usados em Authentication > Users > Add user).
insert into public.hub_membros (email, nome) values
  ('soydeoliveira@gmail.com',                  'Soraya Sá'),
  ('jefferson@opensolucoestributarias.com.br', 'Jefferson Pereira'),
  ('gileard@opensolucoestributarias.com.br',   'Gileade Teixeira'),
  ('open@opentreinamentos.com.br',             'Alexandre')
on conflict (email) do update set nome = excluded.nome;

-- Para incluir alguém depois, rode só esta linha com o e-mail e o nome da pessoa:
-- insert into public.hub_membros (email, nome) values ('email@exemplo.com', 'Nome');
