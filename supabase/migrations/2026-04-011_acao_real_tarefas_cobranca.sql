begin;

create or replace function public.update_collection_task_status(
  p_task_id uuid,
  p_new_status public.collection_task_status
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_existing_status public.collection_task_status;
begin
  if auth.role() <> 'authenticated' then
    raise exception 'Acesso negado';
  end if;

  if p_new_status not in ('completed', 'dismissed') then
    raise exception 'Status inválido para esta operação';
  end if;

  select status
  into v_existing_status
  from public.collection_tasks
  where id = p_task_id;

  if not found then
    raise exception 'Tarefa não encontrada';
  end if;

  if v_existing_status <> 'pending' then
    raise exception 'Somente tarefas pendentes podem ser atualizadas';
  end if;

  update public.collection_tasks
  set
    status = p_new_status,
    completed_at = case
      when p_new_status = 'completed' then timezone('utc', now())
      else null
    end,
    completed_by = case
      when p_new_status = 'completed' then auth.uid()
      else null
    end,
    dismissed_at = case
      when p_new_status = 'dismissed' then timezone('utc', now())
      else null
    end,
    dismissed_by = case
      when p_new_status = 'dismissed' then auth.uid()
      else null
    end
  where id = p_task_id;
end;
$function$;

comment on function public.update_collection_task_status(uuid, public.collection_task_status) is
'Atualiza o status de uma tarefa de cobrança pendente para completed ou dismissed, registrando usuário e timestamp.';

commit;