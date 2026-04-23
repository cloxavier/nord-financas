-- =========================================================
-- 020 — Ações sensíveis: confirmações reforçadas e RPCs seguras
-- =========================================================
-- Objetivo:
-- - centralizar checagem de permissão no banco para ações sensíveis
-- - reforçar exclusão permanente de tratamento
-- - excluir paciente com bloqueio quando houver tratamentos vinculados
-- - permitir editar recebimento já lançado com consistência entre installments e payment_records
-- - permitir apagar recebimento e reabrir a parcela

create or replace function public.current_user_has_permission(
  p_permission_key text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_permissions jsonb;
begin
  if auth.uid() is null or coalesce(trim(p_permission_key), '') = '' then
    return false;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = auth.uid();

  if not found then
    return false;
  end if;

  -- Compatibilidade legado
  if v_profile.role = 'admin' then
    return true;
  end if;

  if p_permission_key in ('payments_edit', 'payments_register') and v_profile.role = 'financeiro' then
    return true;
  end if;

  select ar.permissions_json
  into v_permissions
  from public.access_roles ar
  where ar.id = v_profile.role_id;

  return coalesce((v_permissions ->> p_permission_key)::boolean, false);
end;
$$;

grant execute on function public.current_user_has_permission(text) to authenticated;

create or replace function public.delete_patient_with_safety(
  p_patient_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_patient public.patients%rowtype;
  v_treatments_count integer := 0;
begin
  if public.current_user_has_permission('settings_manage') is not true then
    return jsonb_build_object(
      'success', false,
      'message', 'Permissão negada: apenas usuários com gestão administrativa podem excluir pacientes.'
    );
  end if;

  if p_patient_id is null then
    return jsonb_build_object('success', false, 'message', 'Paciente inválido.');
  end if;

  select *
  into v_patient
  from public.patients
  where id = p_patient_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Paciente não encontrado.');
  end if;

  select count(*)::integer
  into v_treatments_count
  from public.treatments
  where patient_id = p_patient_id;

  if v_treatments_count > 0 then
    return jsonb_build_object(
      'success', false,
      'message', 'Este paciente possui tratamentos vinculados e não pode ser excluído. Preserve o histórico e avalie desativar o cadastro em vez de apagar.'
    );
  end if;

  delete from public.communication_logs
  where patient_id = p_patient_id;

  delete from public.audit_logs
  where entity_id = p_patient_id and entity_type = 'patient';

  delete from public.patients
  where id = p_patient_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (
    auth.uid(),
    'patient_deleted',
    'system',
    p_patient_id,
    'Paciente permanentemente excluído. Nome: ' || coalesce(v_patient.full_name, 'Sem nome')
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Paciente excluído com sucesso.'
  );
end;
$$;

grant execute on function public.delete_patient_with_safety(uuid) to authenticated;

create or replace function public.permanently_delete_treatment(
  p_treatment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_treatment_exists boolean;
  v_patient_name text;
begin
  if public.current_user_has_permission('settings_manage') is not true then
    return jsonb_build_object(
      'success', false,
      'message', 'Permissão negada: apenas usuários com gestão administrativa podem excluir tratamentos permanentemente.'
    );
  end if;

  select exists(select 1 from public.treatments where id = p_treatment_id), patient_name_snapshot
  into v_treatment_exists, v_patient_name
  from public.treatments
  where id = p_treatment_id;

  if not v_treatment_exists then
    return jsonb_build_object(
      'success', false,
      'message', 'Tratamento não encontrado.'
    );
  end if;

  delete from public.communication_logs
  where installment_id in (
    select id from public.installments where treatment_id = p_treatment_id
  );

  delete from public.audit_logs
  where entity_id = p_treatment_id and entity_type = 'treatment';

  delete from public.treatments
  where id = p_treatment_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (
    auth.uid(),
    'treatment_permanently_deleted',
    'system',
    p_treatment_id,
    'Tratamento permanentemente excluído. Paciente: ' || coalesce(v_patient_name, 'Sem nome') || ' (ID: ' || p_treatment_id || ')'
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Tratamento e todos os registros relacionados foram excluídos com sucesso.'
  );

exception when others then
  return jsonb_build_object(
    'success', false,
    'message', 'Erro durante a exclusão: ' || sqlerrm
  );
end;
$$;

grant execute on function public.permanently_delete_treatment(uuid) to authenticated;

create or replace function public.update_installment_payment_record_with_breakdown(
  p_installment_id uuid,
  p_amount_paid numeric,
  p_payment_date date,
  p_payment_method text,
  p_notes text,
  p_principal_amount numeric,
  p_late_fee_percent numeric,
  p_late_fee_amount numeric,
  p_interest_percent numeric,
  p_interest_period text,
  p_interest_amount numeric,
  p_days_overdue integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_installment public.installments%rowtype;
  v_payment_record_id uuid;
begin
  if public.current_user_has_permission('payments_edit') is not true then
    return jsonb_build_object(
      'success', false,
      'message', 'Permissão negada: seu cargo não pode editar pagamentos recebidos.'
    );
  end if;

  if p_installment_id is null then
    return jsonb_build_object('success', false, 'message', 'Parcela inválida.');
  end if;

  select *
  into v_installment
  from public.installments
  where id = p_installment_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Parcela não encontrada.');
  end if;

  if v_installment.status <> 'paid' then
    return jsonb_build_object('success', false, 'message', 'Apenas parcelas pagas podem ter o recebimento editado.');
  end if;

  if coalesce(p_amount_paid, 0) <= 0 then
    return jsonb_build_object('success', false, 'message', 'Informe um valor recebido válido.');
  end if;

  select pr.id
  into v_payment_record_id
  from public.payment_records pr
  where pr.installment_id = p_installment_id
  order by pr.created_at desc
  limit 1;

  update public.installments
  set
    amount_paid = p_amount_paid,
    payment_date = p_payment_date,
    payment_method_used = p_payment_method,
    notes = nullif(trim(coalesce(p_notes, '')), ''),
    payment_principal_amount = coalesce(p_principal_amount, 0),
    payment_late_fee_percent = coalesce(p_late_fee_percent, 0),
    payment_late_fee_amount = coalesce(p_late_fee_amount, 0),
    payment_interest_percent = coalesce(p_interest_percent, 0),
    payment_interest_period = p_interest_period,
    payment_interest_amount = coalesce(p_interest_amount, 0),
    payment_days_overdue = coalesce(p_days_overdue, 0),
    updated_at = timezone('utc'::text, now())
  where id = p_installment_id;

  if v_payment_record_id is null then
    insert into public.payment_records (
      installment_id,
      amount_paid,
      payment_date,
      payment_method,
      notes,
      principal_amount,
      late_fee_percent,
      late_fee_amount,
      interest_percent,
      interest_period,
      interest_amount,
      days_overdue,
      created_by
    )
    values (
      p_installment_id,
      p_amount_paid,
      p_payment_date,
      p_payment_method,
      nullif(trim(coalesce(p_notes, '')), ''),
      coalesce(p_principal_amount, 0),
      coalesce(p_late_fee_percent, 0),
      coalesce(p_late_fee_amount, 0),
      coalesce(p_interest_percent, 0),
      p_interest_period,
      coalesce(p_interest_amount, 0),
      coalesce(p_days_overdue, 0),
      auth.uid()
    );
  else
    update public.payment_records
    set
      amount_paid = p_amount_paid,
      payment_date = p_payment_date,
      payment_method = p_payment_method,
      notes = nullif(trim(coalesce(p_notes, '')), ''),
      principal_amount = coalesce(p_principal_amount, 0),
      late_fee_percent = coalesce(p_late_fee_percent, 0),
      late_fee_amount = coalesce(p_late_fee_amount, 0),
      interest_percent = coalesce(p_interest_percent, 0),
      interest_period = p_interest_period,
      interest_amount = coalesce(p_interest_amount, 0),
      days_overdue = coalesce(p_days_overdue, 0)
    where id = v_payment_record_id;
  end if;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (
    auth.uid(),
    'payment_record_updated',
    'payment',
    p_installment_id,
    'Recebimento editado para a parcela ' || p_installment_id
  );

  return jsonb_build_object('success', true, 'message', 'Recebimento atualizado com sucesso.');
end;
$$;

grant execute on function public.update_installment_payment_record_with_breakdown(
  uuid, numeric, date, text, text, numeric, numeric, numeric, numeric, text, numeric, integer
) to authenticated;

create or replace function public.delete_installment_payment_and_reopen(
  p_installment_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_installment public.installments%rowtype;
  v_deleted_count integer := 0;
begin
  if public.current_user_has_permission('payments_edit') is not true then
    return jsonb_build_object(
      'success', false,
      'message', 'Permissão negada: seu cargo não pode apagar registros financeiros.'
    );
  end if;

  if p_installment_id is null then
    return jsonb_build_object('success', false, 'message', 'Parcela inválida.');
  end if;

  select *
  into v_installment
  from public.installments
  where id = p_installment_id;

  if not found then
    return jsonb_build_object('success', false, 'message', 'Parcela não encontrada.');
  end if;

  if v_installment.status <> 'paid' then
    return jsonb_build_object('success', false, 'message', 'Apenas parcelas pagas podem ter o recebimento apagado.');
  end if;

  delete from public.payment_records
  where installment_id = p_installment_id;

  get diagnostics v_deleted_count = row_count;

  update public.installments
  set
    status = 'pending',
    amount_paid = 0,
    payment_date = null,
    payment_method_used = null,
    notes = null,
    payment_principal_amount = null,
    payment_late_fee_percent = null,
    payment_late_fee_amount = null,
    payment_interest_percent = null,
    payment_interest_period = null,
    payment_interest_amount = null,
    payment_days_overdue = null,
    updated_at = timezone('utc'::text, now())
  where id = p_installment_id;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, description)
  values (
    auth.uid(),
    'payment_record_deleted',
    'payment',
    p_installment_id,
    'Registro financeiro apagado e parcela reaberta. Parcela: ' || p_installment_id
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Registro financeiro apagado com sucesso.',
    'deleted_records_count', v_deleted_count
  );
end;
$$;

grant execute on function public.delete_installment_payment_and_reopen(uuid) to authenticated;
