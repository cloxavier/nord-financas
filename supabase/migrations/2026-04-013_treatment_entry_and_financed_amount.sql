-- =========================================================
-- 013 — Entrada do tratamento + saldo parcelável
--       e ajuste da RPC de substituição do plano
-- =========================================================

alter table public.treatments
  add column if not exists entry_amount numeric(12,2) not null default 0;

alter table public.treatments
  add column if not exists amount_to_finance numeric(12,2) not null default 0;

comment on column public.treatments.entry_amount is
'Valor de entrada negociado para o tratamento. Nesta fase, é contratual e não gera baixa financeira automática.';

comment on column public.treatments.amount_to_finance is
'Saldo restante do tratamento que será usado como base do parcelamento.';

update public.treatments
set
  entry_amount = coalesce(entry_amount, 0),
  amount_to_finance = greatest(coalesce(total_amount, 0) - coalesce(entry_amount, 0), 0);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_entry_amount_non_negative_chk'
  ) then
    alter table public.treatments
      add constraint treatments_entry_amount_non_negative_chk
      check (entry_amount >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_amount_to_finance_non_negative_chk'
  ) then
    alter table public.treatments
      add constraint treatments_amount_to_finance_non_negative_chk
      check (amount_to_finance >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_entry_amount_not_greater_than_total_chk'
  ) then
    alter table public.treatments
      add constraint treatments_entry_amount_not_greater_than_total_chk
      check (entry_amount <= total_amount);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_amount_to_finance_consistency_chk'
  ) then
    alter table public.treatments
      add constraint treatments_amount_to_finance_consistency_chk
      check (amount_to_finance = greatest(total_amount - entry_amount, 0));
  end if;
end $$;

create or replace function public.replace_treatment_payment_plan(
  p_treatment_id uuid,
  p_total_amount numeric,
  p_installment_count integer,
  p_first_due_date date,
  p_interval_type text,
  p_adjust_last_installment boolean default true
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
  v_existing_installment_ids uuid[];
  v_installment_amount numeric;
  v_current_total numeric := 0;
  v_amount numeric;
  v_due_date date;
  v_treatment_exists boolean;
  v_has_locked_installments boolean;
  i integer;
begin
  select exists(
    select 1
    from public.treatments
    where id = p_treatment_id
  ) into v_treatment_exists;

  if not v_treatment_exists then
    raise exception 'Tratamento não encontrado.';
  end if;

  if coalesce(p_total_amount, 0) < 0 then
    raise exception 'Valor parcelável inválido para o plano.';
  end if;

  if coalesce(p_total_amount, 0) > 0 and coalesce(p_installment_count, 0) <= 0 then
    raise exception 'Quantidade de parcelas inválida.';
  end if;

  if coalesce(p_total_amount, 0) > 0 and p_first_due_date is null then
    raise exception 'Primeira data de vencimento é obrigatória.';
  end if;

  if coalesce(p_total_amount, 0) > 0 and p_interval_type not in ('monthly', 'biweekly', 'weekly') then
    raise exception 'Intervalo de parcelamento inválido.';
  end if;

  select
    exists(
      select 1
      from public.installments i
      where i.treatment_id = p_treatment_id
        and (
          coalesce(i.status, '') = 'paid'
          or coalesce(i.amount_paid, 0) > 0
          or coalesce(i.manual_settlement, false) = true
        )
    )
    or exists(
      select 1
      from public.payment_records pr
      join public.installments i on i.id = pr.installment_id
      where i.treatment_id = p_treatment_id
    )
  into v_has_locked_installments;

  if v_has_locked_installments then
    raise exception 'Este tratamento já possui parcela paga/baixada. O plano não pode ser substituído automaticamente.';
  end if;

  select array_agg(id)
  into v_existing_installment_ids
  from public.installments
  where treatment_id = p_treatment_id;

  if v_existing_installment_ids is not null then
    if to_regclass('public.communication_logs') is not null then
      delete from public.communication_logs
      where installment_id = any(v_existing_installment_ids);
    end if;

    if to_regclass('public.collection_tasks') is not null then
      delete from public.collection_tasks
      where installment_id = any(v_existing_installment_ids);
    end if;

    delete from public.payment_records
    where installment_id = any(v_existing_installment_ids);
  end if;

  delete from public.installments
  where treatment_id = p_treatment_id;

  delete from public.payment_plans
  where treatment_id = p_treatment_id;

  if coalesce(p_total_amount, 0) = 0 then
    return jsonb_build_object(
      'success', true,
      'payment_plan_id', null,
      'generated_installments', 0,
      'adjust_last_installment', false,
      'plan_cleared', true
    );
  end if;

  insert into public.payment_plans (
    treatment_id,
    installment_count,
    first_due_date,
    interval_type,
    total_value,
    adjust_last_installment,
    created_at
  )
  values (
    p_treatment_id,
    p_installment_count,
    p_first_due_date,
    p_interval_type,
    p_total_amount,
    p_adjust_last_installment,
    timezone('utc'::text, now())
  )
  returning id into v_plan_id;

  v_installment_amount := floor((p_total_amount / p_installment_count) * 100) / 100;

  for i in 1..p_installment_count loop
    if p_interval_type = 'monthly' then
      v_due_date := (p_first_due_date + ((i - 1) || ' month')::interval)::date;
    elsif p_interval_type = 'biweekly' then
      v_due_date := p_first_due_date + ((i - 1) * 14);
    else
      v_due_date := p_first_due_date + ((i - 1) * 7);
    end if;

    v_amount := v_installment_amount;

    if i = p_installment_count and p_adjust_last_installment then
      v_amount := round((p_total_amount - v_current_total)::numeric, 2);
    end if;

    v_current_total := v_current_total + v_amount;

    insert into public.installments (
      payment_plan_id,
      treatment_id,
      installment_number,
      due_date,
      amount,
      status,
      amount_paid,
      created_at,
      updated_at
    )
    values (
      v_plan_id,
      p_treatment_id,
      i,
      v_due_date,
      v_amount,
      'pending',
      0,
      timezone('utc'::text, now()),
      timezone('utc'::text, now())
    );
  end loop;

  return jsonb_build_object(
    'success', true,
    'payment_plan_id', v_plan_id,
    'generated_installments', p_installment_count,
    'adjust_last_installment', p_adjust_last_installment,
    'plan_cleared', false
  );
end;
$$;

grant execute on function public.replace_treatment_payment_plan(
  uuid,
  numeric,
  integer,
  date,
  text,
  boolean
) to authenticated;