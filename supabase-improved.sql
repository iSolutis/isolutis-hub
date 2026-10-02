-- Hub Comercial iSolutis: Schema melhorado com correções de integridade de dados
-- Phase 0: Correções imediatas e críticas
-- Phase 1+: Melhorias estruturais

-- ============================================================================
-- PHASE 0: CORREÇÕES IMEDIATAS
-- ============================================================================

-- 1. Melhorar função de verificação de membro (evitar N+1 em RLS)
create or replace function public.hub_eh_membro() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.hub_membros m
    where lower(m.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

-- 2. Melhorar trigger de auditoria com set search_path
create or replace function public.hub_carimbo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.atualizado_em  := now();
  new.atualizado_por := auth.jwt() ->> 'email';
  -- Nunca permitir alteração de criado_em ou id após criação
  if tg_op = 'UPDATE' then
    new.criado_em  := old.criado_em;
    new.criadoPor  := old.criadoPor;
  end if;
  return new;
end $$;

-- 3. Adicionar coluna de número sequencial única para orçamentos
-- (será usada por trigger para gerar números únicos)
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
    and table_name = 'hub_orcamentos'
    and column_name = 'numero_seq'
  ) then
    alter table public.hub_orcamentos add column numero_seq bigserial unique;
  end if;
end $$;

-- 4. Criar função para gerar próximo número de orçamento (server-side)
create or replace function public.gerar_numero_orcamento() returns text
language plpgsql security definer set search_path = public as $$
declare
  ano integer;
  seq integer;
begin
  ano := extract(year from now());

  select count(*) into seq
  from public.hub_orcamentos
  where (dados->>'data')::date >= (ano::text || '-01-01')::date
    and (dados->>'data')::date < ((ano+1)::text || '-01-01')::date;

  return ano::text || '-' || lpad((seq + 1)::text, 3, '0');
end $$;

-- 5. Tabela de auditoria para rastrear todas as alterações
create table if not exists public.hub_auditoria (
  id              bigserial primary key,
  tabela          text not null,
  registro_id     text not null,
  operacao        text not null,
  usuario         text not null,
  dados_anterior  jsonb,
  dados_novo      jsonb,
  criado_em       timestamptz not null default now(),

  constraint operacao_valida check (operacao in ('INSERT', 'UPDATE', 'DELETE'))
);

alter table public.hub_auditoria enable row level security;

-- Índices para performance
create index if not exists idx_auditoria_tabela_registro on public.hub_auditoria(tabela, registro_id);
create index if not exists idx_auditoria_criado_em on public.hub_auditoria(criado_em desc);

-- Política RLS: membros veem auditoria apenas de suas próprias alterações
create policy "membros veem sua auditoria" on public.hub_auditoria
  for select to authenticated using (
    public.hub_eh_membro() and usuario = auth.jwt() ->> 'email'
  );

revoke all on public.hub_auditoria from anon;
grant select on public.hub_auditoria to authenticated;

-- Função para registrar auditoria
create or replace function public.registrar_auditoria() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.hub_auditoria (tabela, registro_id, operacao, usuario, dados_anterior, dados_novo)
  values (
    tg_table_name,
    case when tg_op = 'DELETE' then old.id else new.id end,
    tg_op,
    auth.jwt() ->> 'email',
    case when tg_op = 'DELETE' or tg_op = 'UPDATE' then old.dados else null end,
    case when tg_op = 'INSERT' or tg_op = 'UPDATE' then new.dados else null end
  );
  return case when tg_op = 'DELETE' then old else new end;
end $$;

-- ============================================================================
-- ESTRUTURA MELHORADA DAS TABELAS
-- ============================================================================

-- Tabela de membros com coluna de admin
create table if not exists public.hub_membros (
  email       text primary key,
  nome        text not null,
  admin       boolean not null default false,
  ativo       boolean not null default true,
  criado_em   timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

alter table public.hub_membros enable row level security;

create policy "membros leem a equipe" on public.hub_membros
  for select to authenticated using (public.hub_eh_membro());

revoke all on public.hub_membros from anon;
grant select on public.hub_membros to authenticated;

-- Criar tabelas de dados com schema apropriado
do $$
declare
  t text;
begin
  foreach t in array array[
    'hub_clientes',
    'hub_negocios',
    'hub_orcamentos',
    'hub_faturamento',
    'hub_produtos',
    'hub_despesas',
    'hub_projetos',
    'hub_tarefas'
  ] loop

    -- Criar tabela se não existir
    execute format('
      create table if not exists public.%I (
        id              text primary key,
        dados           jsonb not null default ''{}''::jsonb,
        criado_em       timestamptz not null default now(),
        criadoPor       text,
        atualizado_em   timestamptz not null default now(),
        atualizado_por  text
      )', t);

    -- Habilitar RLS
    execute format('alter table public.%I enable row level security', t);

    -- Política RLS: membros acessam tudo
    execute format('
      drop policy if exists "membros acessam" on public.%I
    ', t);
    execute format('
      create policy "membros acessam" on public.%I
      for all to authenticated
      using (public.hub_eh_membro())
      with check (public.hub_eh_membro())
    ', t);

    -- Remover acesso anônimo
    execute format('revoke all on public.%I from anon', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);

    -- Trigger de auditoria
    execute format('drop trigger if exists hub_carimbo on public.%I', t);
    execute format('
      create trigger hub_carimbo
      before insert or update on public.%I
      for each row execute function public.hub_carimbo()
    ', t);

    -- Trigger de auditoria de registros
    execute format('drop trigger if exists registra_auditoria on public.%I', t);
    execute format('
      create trigger registra_auditoria
      after insert or update or delete on public.%I
      for each row execute function public.registrar_auditoria()
    ', t);

    -- Tempo real
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;

  end loop;
end $$;

-- ============================================================================
-- DADOS INICIAIS (SEM EMAILS REAIS - usar variáveis de ambiente em produção)
-- ============================================================================

insert into public.hub_membros (email, nome, admin) values
  ('developer@isolutis.test',      'Desenvolvedor',     false),
  ('admin@isolutis.test',          'Administrador',     true)
on conflict (email) do update set
  nome = excluded.nome,
  admin = coalesce(excluded.admin, hub_membros.admin);

-- Para adicionar usuário real:
-- insert into public.hub_membros (email, nome, admin) values ('email@real.com', 'Nome Real', false);

-- ============================================================================
-- VISTAS ÚTEIS PARA QUERIES COMUNS
-- ============================================================================

-- View: Próximo número de orçamento por ano
create or replace view public.v_proximos_numeros_orcamento as
select
  extract(year from now())::integer as ano,
  public.gerar_numero_orcamento() as proximo_numero;

-- View: Estatísticas de usuários
create or replace view public.v_stats_usuarios as
select
  count(*) as total_membros,
  count(case when admin then 1 end) as total_admins,
  count(case when ativo then 1 end) as membros_ativos
from public.hub_membros;

-- ============================================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================================

create index if not exists idx_hub_orcamentos_cliente on public.hub_orcamentos
  using gin ((dados->>'clienteId'));

create index if not exists idx_hub_orcamentos_status on public.hub_orcamentos
  using gin ((dados->>'status'));

create index if not exists idx_hub_negocios_cliente on public.hub_negocios
  using gin ((dados->>'clienteId'));

create index if not exists idx_hub_negocios_etapa on public.hub_negocios
  using gin ((dados->>'etapa'));

create index if not exists idx_hub_faturamento_negocio on public.hub_faturamento
  using gin ((dados->>'negocioId'));

-- ============================================================================
-- TESTES E VALIDAÇÃO
-- ============================================================================

-- Função para validar integridade de dados (pode ser executada periodicamente)
create or replace function public.validar_integridade() returns table(
  tipo text,
  mensagem text,
  count_registros bigint
) language plpgsql security definer set search_path = public as $$
begin
  -- Verificar campos criadoPor nulos (deveria ser preenchido)
  return query
  select 'AVISO'::text, 'hub_orcamentos com criadoPor nulo'::text, count(*)
  from public.hub_orcamentos where criadoPor is null;

  return query
  select 'AVISO'::text, 'hub_negocios com criadoPor nulo'::text, count(*)
  from public.hub_negocios where criadoPor is null;

  -- Verificar registros órfãos (referências a clientes que não existem)
  return query
  select 'AVISO'::text, 'Orçamentos com clienteId órfão'::text, count(*)
  from public.hub_orcamentos o
  where (o.dados->>'clienteId')::text != ''
    and not exists (
      select 1 from public.hub_clientes c
      where c.id = o.dados->>'clienteId'
    );
end $$;

-- Executar validação (exemplo):
-- select * from public.validar_integridade();
