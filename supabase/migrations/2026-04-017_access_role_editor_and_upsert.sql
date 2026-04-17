-- =========================================================
-- 017 — Editor de cargos e permissões
-- =========================================================
-- Objetivo:
-- - permitir criação e edição de cargos reais (access_roles)
-- - manter cargos de sistema protegidos
-- - centralizar escrita via RPC com validação de permissão
--
-- Observação:
-- - esta etapa NÃO apaga cargos
-- - cargos de sistema continuam ativos por segurança
-- - cargos personalizados podem ser desativados

create or replace function public.current_user_can_manage_roles()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_permissions jsonb;
begin
  if auth.uid() is null then
    return false;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    return false;
  end if;

  -- Compatibilidade com legado
  if v_profile.role = 'admin' then
    return true;
  end if;

  select ar.permissions_json
  into v_permissions
  from public.access_roles ar
  where ar.id = v_profile.role_id;

  return coalesce((v_permissions ->> 'roles_manage')::boolean, false);
end;
$$;

grant execute on function public.current_user_can_manage_roles() to authenticated;

create or replace function public.upsert_access_role_definition(
  p_role_id uuid default null,
  p_name text default null,
  p_description text default null,
  p_is_active boolean default true,
  p_permissions_json jsonb default '{}'::jsonb,
  p_financial_scope_json jsonb default '{}'::jsonb
)
returns table (
  role_id uuid,
  role_slug text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_role public.access_roles%rowtype;
  v_now timestamptz := timezone('utc'::text, now());
  v_name text;
  v_slug_base text;
  v_slug text;
begin
  if public.current_user_can_manage_roles() is not true then
    raise exception 'Você não tem permissão para gerenciar cargos.';
  end if;

  v_name := btrim(coalesce(p_name, ''));

  if v_name = '' then
    raise exception 'Informe o nome do cargo.';
  end if;

  v_slug_base := lower(v_name);
  v_slug_base := translate(
    v_slug_base,
    'áàãâäéèêëíìîïóòõôöúùûüçñ',
    'aaaaaeeeeiiiiooooouuuucn'
  );
  v_slug := regexp_replace(v_slug_base, '[^a-z0-9]+', '-', 'g');
  v_slug := trim(both '-' from v_slug);

  if v_slug = '' then
    raise exception 'Não foi possível gerar um slug válido para o cargo.';
  end if;

  if p_role_id is null then
    if exists (
      select 1
      from public.access_roles
      where lower(slug) = lower(v_slug)
    ) then
      raise exception 'Já existe um cargo com este nome/slug.';
    end if;

    insert into public.access_roles (
      name,
      slug,
      description,
      is_system_role,
      is_active,
      permissions_json,
      financial_scope_json,
      created_at,
      updated_at
    )
    values (
      v_name,
      v_slug,
      nullif(btrim(coalesce(p_description, '')), ''),
      false,
      coalesce(p_is_active, true),
      coalesce(p_permissions_json, '{}'::jsonb),
      coalesce(p_financial_scope_json, '{}'::jsonb),
      v_now,
      v_now
    )
    returning id, slug, public.access_roles.updated_at
    into role_id, role_slug, updated_at;

    return next;
    return;
  end if;

  select *
  into v_target_role
  from public.access_roles
  where id = p_role_id;

  if not found then
    raise exception 'Cargo não encontrado.';
  end if;

  if v_target_role.is_system_role then
    update public.access_roles
    set
      name = v_name,
      description = nullif(btrim(coalesce(p_description, '')), ''),
      is_active = true,
      permissions_json = coalesce(p_permissions_json, '{}'::jsonb),
      financial_scope_json = coalesce(p_financial_scope_json, '{}'::jsonb),
      updated_at = v_now
    where id = p_role_id
    returning id, slug, public.access_roles.updated_at
    into role_id, role_slug, updated_at;

    return next;
    return;
  end if;

  if exists (
    select 1
    from public.access_roles
    where lower(slug) = lower(v_slug)
      and id <> p_role_id
  ) then
    raise exception 'Já existe outro cargo com este nome/slug.';
  end if;

  update public.access_roles
  set
    name = v_name,
    slug = v_slug,
    description = nullif(btrim(coalesce(p_description, '')), ''),
    is_active = coalesce(p_is_active, true),
    permissions_json = coalesce(p_permissions_json, '{}'::jsonb),
    financial_scope_json = coalesce(p_financial_scope_json, '{}'::jsonb),
    updated_at = v_now
  where id = p_role_id
  returning id, slug, public.access_roles.updated_at
  into role_id, role_slug, updated_at;

  return next;
end;
$$;

grant execute on function public.upsert_access_role_definition(
  uuid,
  text,
  text,
  boolean,
  jsonb,
  jsonb
) to authenticated;