-- Aba Tarefas (Kanban da equipe): cria a tabela hub_tarefas com as mesmas regras das outras.
-- Rode uma vez no SQL Editor do Supabase (pode rodar de novo sem problema).
create table if not exists public.hub_tarefas (
  id             text primary key,
  dados          jsonb not null default '{}'::jsonb,
  criado_em      timestamptz not null default now(),
  atualizado_em  timestamptz not null default now(),
  atualizado_por text
);
alter table public.hub_tarefas enable row level security;
drop policy if exists "membros acessam" on public.hub_tarefas;
create policy "membros acessam" on public.hub_tarefas for all to authenticated
  using (public.hub_eh_membro()) with check (public.hub_eh_membro());
revoke all on public.hub_tarefas from anon;
grant select, insert, update, delete on public.hub_tarefas to authenticated;
drop trigger if exists hub_carimbo on public.hub_tarefas;
create trigger hub_carimbo before insert or update on public.hub_tarefas
  for each row execute function public.hub_carimbo();
do $$ begin
  alter publication supabase_realtime add table public.hub_tarefas;
exception when duplicate_object then null;
end $$;
