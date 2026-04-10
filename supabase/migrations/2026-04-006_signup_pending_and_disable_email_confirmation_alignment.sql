-- =========================================================
-- 006 — Ajuste final do fluxo de novos usuários
-- =========================================================
-- Objetivo:
-- 1) garantir que novos profiles nasçam com access_status = 'pending'
-- 2) corrigir registros já criados que ficaram com access_status nulo
-- 3) manter o fluxo alinhado ao uso sem confirmação obrigatória de e-mail
--
-- IMPORTANTE:
-- A desativação de "Confirm Email" foi feita na interface do Supabase:
-- Authentication > Sign In / Providers > Email
-- Esta migration registra apenas o ajuste SQL relacionado ao profile.

begin;

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
    email,
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
    new.email,
    null,
    'pending',
    null,
    null,
    null,
    coalesce(new.created_at, timezone('utc'::text, now())),
    timezone('utc'::text, now())
  )
  on conflict (id) do update
  set
    full_name = coalesce(excluded.full_name, public.profiles.full_name),
    email = coalesce(excluded.email, public.profiles.email),
    access_status = coalesce(public.profiles.access_status, 'pending'),
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;

create trigger on_auth_user_created_profile
after insert on auth.users
for each row
execute function public.handle_new_user_profile();

update public.profiles
set
  access_status = 'pending',
  role = case
    when role_id is null and approved_by is null and approved_at is null then null
    else role
  end,
  updated_at = timezone('utc'::text, now())
where access_status is null;

commit;