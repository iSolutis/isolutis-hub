-- Painel de usuários do Hub: marca quem é administrador.
-- Rode uma vez no SQL Editor do Supabase (pode rodar de novo sem problema).
alter table public.hub_membros add column if not exists admin boolean not null default false;
update public.hub_membros set email = lower(email);
update public.hub_membros set admin = true where email = 'soydeoliveira@gmail.com';
