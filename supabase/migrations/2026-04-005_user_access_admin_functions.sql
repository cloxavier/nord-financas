begin;

-- =========================================================
-- 005 — Administração de usuários
-- =========================================================

-- 1) Adiciona e-mail no profile para facilitar a tela administrativa
alter table public.profiles
  add column if not exists email text;

-- 2) Backfill de e-mails a partir do auth.users
update public.profiles p
set email = u.email,
    updated_at = timezone('utc'::text, now())
from auth.users u
where p.id = u.id
  and (p.email is null or trim(p.email) = '');

-- 3) Atualiza a função de criação automática de perfil
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
    timezone('utc'::text, now()),
    timezone('utc'::text, now())
  )
  on conflict (id) do update
  set
    email = excluded.email,
    updated_at = timezone('utc'::text, now());

  return new;
end;
$$;

-- 4) Função auxiliar: verifica se o usuário atual é gestor ativo
create or replace function public.is_current_user_gestor()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.profiles p
    join public.access_roles ar on ar.id = p.role_id
    where p.id = auth.uid()
      and p.access_status = 'active'
      and ar.slug = 'gestor'
      and ar.is_active = true
  );
$$;

-- 5) Função para listar usuários na tela administrativa
create or replace function public.list_user_access_overview()
returns table (
  profile_id uuid,
  full_name text,
  email text,
  access_status text,
  role_id uuid,
  role_name text,
  role_slug text,
  created_at timestamptz,
  approved_at timestamptz,
  approved_by uuid,
  approved_by_name text,
  is_me boolean
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_current_user_gestor() then
    raise exception 'Acesso negado';
  end if;

  return query
  select
    p.id as profile_id,
    p.full_name,
    coalesce(p.email, '') as email,
    coalesce(p.access_status, 'pending') as access_status,
    p.role_id,
    ar.name as role_name,
    ar.slug as role_slug,
    p.created_at,
    p.approved_at,
    p.approved_by,
    approver.full_name as approved_by_name,
    (p.id = auth.uid()) as is_me
  from public.profiles p
  left join public.access_roles ar on ar.id = p.role_id
  left join public.profiles approver on approver.id = p.approved_by
  order by
    case coalesce(p.access_status, 'pending')
      when 'pending' then 1
      when 'active' then 2
      when 'blocked' then 3
      else 4
    end,
    p.created_at desc;
end;
$$;

-- 6) Função para atualizar acesso/cargo do usuário
create or replace function public.update_user_access_control(
  p_profile_id uuid,
  p_role_id uuid,
  p_access_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_selected_slug text;
  v_legacy_role text;
begin
  if not public.is_current_user_gestor() then
    raise exception 'Acesso negado';
  end if;

  if p_profile_id is null then
    raise exception 'Usuário alvo é obrigatório';
  end if;

  if p_access_status not in ('pending', 'active', 'blocked') then
    raise exception 'Status inválido';
  end if;

  if auth.uid() = p_profile_id and p_access_status = 'blocked' then
    raise exception 'Você não pode bloquear a própria conta';
  end if;

  if p_access_status = 'active' and p_role_id is null then
    raise exception 'Selecione um cargo antes de ativar o usuário';
  end if;

  if p_role_id is not null then
    select slug
    into v_selected_slug
    from public.access_roles
    where id = p_role_id
      and is_active = true;

    if v_selected_slug is null then
      raise exception 'Cargo inválido ou inativo';
    end if;

    v_legacy_role := case v_selected_slug
      when 'gestor' then 'admin'
      when 'secretaria' then 'recepcao'
      when 'financeiro' then 'financeiro'
      when 'dentista' then 'dentista'
      else null
    end;
  end if;

  update public.profiles
  set
    access_status = p_access_status,
    role_id = case
      when p_access_status = 'pending' then null
      else coalesce(p_role_id, role_id)
    end,
    role = case
      when p_access_status = 'pending' then role
      else coalesce(v_legacy_role, role)
    end,
    approved_by = case
      when p_access_status = 'active' then auth.uid()
      when p_access_status = 'pending' then null
      else approved_by
    end,
    approved_at = case
      when p_access_status = 'active' then coalesce(approved_at, timezone('utc'::text, now()))
      when p_access_status = 'pending' then null
      else approved_at
    end,
    updated_at = timezone('utc'::text, now())
  where id = p_profile_id;

  if not found then
    raise exception 'Usuário não encontrado';
  end if;
end;
$$;

grant execute on function public.is_current_user_gestor() to authenticated;
grant execute on function public.list_user_access_overview() to authenticated;
grant execute on function public.update_user_access_control(uuid, uuid, text) to authenticated;

commit;