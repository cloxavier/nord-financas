begin;

-- =========================================================
-- 004 — Fundação de acesso: cargos, status e aprovação
-- =========================================================

-- 1) Nova tabela de cargos
create table if not exists public.access_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  description text,
  is_system_role boolean not null default false,
  is_active boolean not null default true,
  permissions_json jsonb not null default '{}'::jsonb,
  financial_scope_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
);

create unique index if not exists idx_access_roles_slug_unique
  on public.access_roles (slug);

alter table public.access_roles enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'access_roles'
      and policyname = 'Allow authenticated read access to access_roles'
  ) then
    create policy "Allow authenticated read access to access_roles"
      on public.access_roles
      for select
      using (auth.role() = 'authenticated');
  end if;
end $$;

-- 2) Evolução da tabela profiles
alter table public.profiles
  add column if not exists access_status text,
  add column if not exists role_id uuid references public.access_roles(id),
  add column if not exists approved_by uuid references auth.users(id),
  add column if not exists approved_at timestamptz,
  add column if not exists updated_at timestamptz not null default timezone('utc'::text, now());

create index if not exists idx_profiles_access_status
  on public.profiles (access_status);

create index if not exists idx_profiles_role_id
  on public.profiles (role_id);

-- 3) Soltar o engessamento da coluna role legada
alter table public.profiles
  alter column role drop not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conname = 'profiles_role_check'
  ) then
    alter table public.profiles drop constraint profiles_role_check;
  end if;
end $$;

-- 4) Novo check para access_status
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_access_status_check'
  ) then
    alter table public.profiles
      add constraint profiles_access_status_check
      check (access_status in ('pending', 'active', 'blocked'));
  end if;
end $$;

-- 5) Seed dos cargos padrão do sistema
insert into public.access_roles (
  name,
  slug,
  description,
  is_system_role,
  is_active,
  permissions_json,
  financial_scope_json
)
values
(
  'Gestor',
  'gestor',
  'Acesso administrativo e executivo completo do sistema.',
  true,
  true,
  '{
    "dashboard_basic": true,
    "dashboard_executive": true,
    "patients_view": true,
    "patients_create": true,
    "patients_edit": true,
    "treatments_view": true,
    "treatments_create": true,
    "treatments_edit": true,
    "installments_view": true,
    "payments_register": true,
    "payments_edit": true,
    "collections_view": true,
    "users_manage": true,
    "roles_manage": true,
    "settings_manage": true
  }'::jsonb,
  '{
    "can_view_open_amount_total": true,
    "can_view_monthly_forecast": true,
    "months_back_visible": 120,
    "months_forward_visible": 120,
    "financial_access_level": "executive"
  }'::jsonb
),
(
  'Secretária',
  'secretaria',
  'Perfil operacional para cadastro, acompanhamento de parcelas e baixa de pagamentos.',
  true,
  true,
  '{
    "dashboard_basic": true,
    "dashboard_executive": false,
    "patients_view": true,
    "patients_create": true,
    "patients_edit": true,
    "treatments_view": true,
    "treatments_create": true,
    "treatments_edit": true,
    "installments_view": true,
    "payments_register": true,
    "payments_edit": false,
    "collections_view": true,
    "users_manage": false,
    "roles_manage": false,
    "settings_manage": false
  }'::jsonb,
  '{
    "can_view_open_amount_total": false,
    "can_view_monthly_forecast": false,
    "months_back_visible": 1,
    "months_forward_visible": 1,
    "financial_access_level": "operational"
  }'::jsonb
),
(
  'Financeiro',
  'financeiro',
  'Perfil focado em cobranças, parcelas e visão financeira operacional.',
  true,
  true,
  '{
    "dashboard_basic": true,
    "dashboard_executive": false,
    "patients_view": true,
    "patients_create": false,
    "patients_edit": false,
    "treatments_view": true,
    "treatments_create": false,
    "treatments_edit": false,
    "installments_view": true,
    "payments_register": true,
    "payments_edit": true,
    "collections_view": true,
    "users_manage": false,
    "roles_manage": false,
    "settings_manage": false
  }'::jsonb,
  '{
    "can_view_open_amount_total": false,
    "can_view_monthly_forecast": true,
    "months_back_visible": 2,
    "months_forward_visible": 2,
    "financial_access_level": "financial"
  }'::jsonb
),
(
  'Dentista',
  'dentista',
  'Perfil clínico, com foco em tratamentos e pacientes.',
  true,
  true,
  '{
    "dashboard_basic": true,
    "dashboard_executive": false,
    "patients_view": true,
    "patients_create": true,
    "patients_edit": true,
    "treatments_view": true,
    "treatments_create": true,
    "treatments_edit": true,
    "installments_view": false,
    "payments_register": false,
    "payments_edit": false,
    "collections_view": false,
    "users_manage": false,
    "roles_manage": false,
    "settings_manage": false
  }'::jsonb,
  '{
    "can_view_open_amount_total": false,
    "can_view_monthly_forecast": false,
    "months_back_visible": 0,
    "months_forward_visible": 0,
    "financial_access_level": "none"
  }'::jsonb
)
on conflict (slug) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system_role = excluded.is_system_role,
  is_active = excluded.is_active,
  permissions_json = excluded.permissions_json,
  financial_scope_json = excluded.financial_scope_json,
  updated_at = timezone('utc'::text, now());

-- 6) Backfill dos perfis já existentes
update public.profiles p
set
  role_id = ar.id,
  access_status = coalesce(p.access_status, 'active'),
  approved_at = coalesce(p.approved_at, p.created_at),
  updated_at = timezone('utc'::text, now())
from public.access_roles ar
where p.role_id is null
  and (
    (p.role = 'admin' and ar.slug = 'gestor')
    or (p.role = 'financeiro' and ar.slug = 'financeiro')
    or (p.role = 'dentista' and ar.slug = 'dentista')
    or (p.role = 'recepcao' and ar.slug = 'secretaria')
  );

-- 7) Novos perfis passam a nascer como pendentes
create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id,
    full_name,
    role,
    access_status,
    role_id,
    approved_by,
    approved_at,
    created_at,
    updated_at
  )
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      split_part(new.email, '@', 1)
    ),
    null,
    'pending',
    null,
    null,
    null,
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

commit;