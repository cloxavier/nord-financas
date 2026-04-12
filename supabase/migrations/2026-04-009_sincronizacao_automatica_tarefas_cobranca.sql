begin;

-- =========================================================
-- 1. Garantir unicidade entre regra e parcela
-- =========================================================
create unique index if not exists idx_collection_tasks_rule_installment_unique
  on public.collection_tasks (rule_id, installment_id);

-- =========================================================
-- 2. Sincroniza tarefas de cobrança para uma parcela
-- =========================================================
create or replace function public.sync_collection_tasks_for_installment(p_installment_id uuid)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_installment record;
  v_rows_affected integer := 0;
begin
  select
    i.id,
    i.treatment_id,
    i.due_date,
    i.status,
    i.amount,
    i.amount_paid,
    t.patient_id
  into v_installment
  from public.installments i
  join public.treatments t on t.id = i.treatment_id
  where i.id = p_installment_id;

  if not found then
    return 0;
  end if;

  -- Se a parcela foi paga ou cancelada, remove tarefas pendentes
  if coalesce(v_installment.status, '') in ('paid', 'cancelled') then
    delete from public.collection_tasks
    where installment_id = v_installment.id
      and status = 'pending';

    return 0;
  end if;

  insert into public.collection_tasks (
    patient_id,
    treatment_id,
    installment_id,
    rule_id,
    task_type,
    status,
    title,
    description,
    due_date,
    scheduled_for,
    amount,
    days_offset
  )
  select
    v_installment.patient_id,
    v_installment.treatment_id,
    v_installment.id,
    r.id,
    r.task_type,
    'pending',
    r.title,
    r.description,
    v_installment.due_date,
    v_installment.due_date + r.days_offset,
    greatest(0, coalesce(v_installment.amount, 0) - coalesce(v_installment.amount_paid, 0)),
    r.days_offset
  from public.collection_rules r
  where r.is_active = true
  on conflict (rule_id, installment_id) do update
  set
    patient_id = excluded.patient_id,
    treatment_id = excluded.treatment_id,
    task_type = excluded.task_type,
    title = excluded.title,
    description = excluded.description,
    due_date = excluded.due_date,
    scheduled_for = excluded.scheduled_for,
    amount = excluded.amount,
    days_offset = excluded.days_offset,
    updated_at = timezone('utc', now())
  where public.collection_tasks.status = 'pending';

  get diagnostics v_rows_affected = row_count;

  return v_rows_affected;
end;
$function$;

comment on function public.sync_collection_tasks_for_installment(uuid) is
'Sincroniza tarefas de cobrança para uma parcela com base nas regras ativas. Remove tarefas pendentes quando a parcela é paga ou cancelada.';

-- =========================================================
-- 3. Sincroniza todas as parcelas elegíveis
-- =========================================================
create or replace function public.sync_all_collection_tasks()
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_installment record;
  v_total integer := 0;
begin
  for v_installment in
    select id
    from public.installments
    where coalesce(status, '') not in ('paid', 'cancelled')
  loop
    v_total := v_total + public.sync_collection_tasks_for_installment(v_installment.id);
  end loop;

  return v_total;
end;
$function$;

comment on function public.sync_all_collection_tasks() is
'Sincroniza tarefas de cobrança para todas as parcelas abertas ou em acompanhamento.';

-- =========================================================
-- 4. Trigger para sincronização automática após alteração de parcela
-- =========================================================
create or replace function public.handle_installment_collection_task_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  perform public.sync_collection_tasks_for_installment(new.id);
  return new;
end;
$function$;

drop trigger if exists trg_installments_sync_collection_tasks on public.installments;

create trigger trg_installments_sync_collection_tasks
after insert or update of due_date, status, amount, amount_paid, treatment_id
on public.installments
for each row
execute function public.handle_installment_collection_task_sync();

comment on function public.handle_installment_collection_task_sync() is
'Trigger handler para manter tarefas de cobrança sincronizadas quando parcelas mudam.';

commit;