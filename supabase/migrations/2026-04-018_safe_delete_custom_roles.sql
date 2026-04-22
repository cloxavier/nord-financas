-- =========================================================
-- 018 — Exclusão segura de cargos customizados
-- =========================================================
-- Objetivo:
-- - permitir preview da exclusão de um cargo
-- - listar usuários vinculados
-- - exigir remapeamento dos usuários antes da exclusão
-- - impedir exclusão de cargos de sistema
-- - reaproveitar update_user_access_control para manter compatibilidade

create or replace function public.preview_access_role_deletion(
  p_role_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.access_roles%rowtype;
  v_assigned_users jsonb := '[]'::jsonb;
  v_assigned_count integer := 0;
begin
  if public.current_user_can_manage_roles() is not true then
    raise exception 'Você não tem permissão para gerenciar cargos.';
  end if;

  if p_role_id is null then
    raise exception 'Informe o cargo que deseja analisar.';
  end if;

  select *
  into v_role
  from public.access_roles
  where id = p_role_id;

  if not found then
    raise exception 'Cargo não encontrado.';
  end if;

  select
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'profile_id', p.id,
          'full_name', p.full_name,
          'email', p.email,
          'access_status', p.access_status,
          'current_role_id', ar.id,
          'current_role_name', ar.name,
          'current_role_slug', ar.slug
        )
        order by p.full_name asc
      ),
      '[]'::jsonb
    ),
    count(*)::integer
  into v_assigned_users, v_assigned_count
  from public.profiles p
  left join public.access_roles ar
    on ar.id = p.role_id
  where p.role_id = p_role_id;

  return jsonb_build_object(
    'role_id', v_role.id,
    'role_name', v_role.name,
    'role_slug', v_role.slug,
    'is_system_role', v_role.is_system_role,
    'assigned_users_count', v_assigned_count,
    'assigned_users', v_assigned_users
  );
end;
$$;

grant execute on function public.preview_access_role_deletion(uuid) to authenticated;

create or replace function public.delete_access_role_with_reassignment(
  p_role_id uuid,
  p_reassignments jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role public.access_roles%rowtype;
  v_assigned_count integer := 0;
  v_missing_reassignments integer := 0;
  v_invalid_profiles integer := 0;
  v_invalid_targets integer := 0;
  v_migrated_count integer := 0;
  v_row record;
begin
  if public.current_user_can_manage_roles() is not true then
    raise exception 'Você não tem permissão para gerenciar cargos.';
  end if;

  if p_role_id is null then
    raise exception 'Informe o cargo que deseja excluir.';
  end if;

  select *
  into v_role
  from public.access_roles
  where id = p_role_id;

  if not found then
    raise exception 'Cargo não encontrado.';
  end if;

  if v_role.is_system_role then
    raise exception 'Cargos de sistema não podem ser excluídos.';
  end if;

  select count(*)::integer
  into v_assigned_count
  from public.profiles
  where role_id = p_role_id;

  if v_assigned_count > 0 then
    if jsonb_typeof(coalesce(p_reassignments, '[]'::jsonb)) <> 'array' then
      raise exception 'O remapeamento dos usuários precisa ser enviado em formato de lista.';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(coalesce(p_reassignments, '[]'::jsonb)) as r(
        profile_id uuid,
        target_role_id uuid
      )
      where r.profile_id is null
         or r.target_role_id is null
    ) then
      raise exception 'Todos os usuários impactados precisam receber um cargo de destino.';
    end if;

    select count(*)::integer
    into v_missing_reassignments
    from public.profiles p
    left join (
      select distinct r.profile_id
      from jsonb_to_recordset(coalesce(p_reassignments, '[]'::jsonb)) as r(
        profile_id uuid,
        target_role_id uuid
      )
    ) m
      on m.profile_id = p.id
    where p.role_id = p_role_id
      and m.profile_id is null;

    if v_missing_reassignments > 0 then
      raise exception 'Existem usuários vinculados ao cargo sem cargo de destino definido.';
    end if;

    select count(*)::integer
    into v_invalid_profiles
    from (
      select distinct r.profile_id
      from jsonb_to_recordset(coalesce(p_reassignments, '[]'::jsonb)) as r(
        profile_id uuid,
        target_role_id uuid
      )
      left join public.profiles p
        on p.id = r.profile_id
       and p.role_id = p_role_id
      where p.id is null
    ) invalid_profiles;

    if v_invalid_profiles > 0 then
      raise exception 'Foi enviado remapeamento para usuário que não pertence a este cargo.';
    end if;

    select count(*)::integer
    into v_invalid_targets
    from jsonb_to_recordset(coalesce(p_reassignments, '[]'::jsonb)) as r(
      profile_id uuid,
      target_role_id uuid
    )
    left join public.access_roles ar
      on ar.id = r.target_role_id
    where ar.id is null
       or ar.is_active is not true
       or ar.id = p_role_id;

    if v_invalid_targets > 0 then
      raise exception 'Um ou mais cargos de destino são inválidos, inativos ou iguais ao cargo que será excluído.';
    end if;

    for v_row in
      select
        p.id as profile_id,
        p.access_status,
        m.target_role_id
      from public.profiles p
      join (
        select distinct on (r.profile_id)
          r.profile_id,
          r.target_role_id
        from jsonb_to_recordset(coalesce(p_reassignments, '[]'::jsonb)) as r(
          profile_id uuid,
          target_role_id uuid
        )
        order by r.profile_id
      ) m
        on m.profile_id = p.id
      where p.role_id = p_role_id
    loop
      perform public.update_user_access_control(
        v_row.profile_id,
        v_row.target_role_id,
        v_row.access_status
      );

      v_migrated_count := v_migrated_count + 1;
    end loop;
  end if;

  delete from public.access_roles
  where id = p_role_id;

  return jsonb_build_object(
    'deleted_role_id', v_role.id,
    'deleted_role_slug', v_role.slug,
    'migrated_users_count', v_migrated_count
  );
end;
$$;

grant execute on function public.delete_access_role_with_reassignment(uuid, jsonb) to authenticated;