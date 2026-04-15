-- =========================================================
-- 015 — Snapshot de breakdown do pagamento da parcela
--       + base para status efetivo consistente nas telas
-- =========================================================

alter table public.installments
  add column if not exists payment_principal_amount numeric(12,2),
  add column if not exists payment_late_fee_percent numeric(6,3),
  add column if not exists payment_late_fee_amount numeric(12,2),
  add column if not exists payment_interest_percent numeric(6,3),
  add column if not exists payment_interest_period text,
  add column if not exists payment_interest_amount numeric(12,2),
  add column if not exists payment_days_overdue integer;

alter table public.payment_records
  add column if not exists principal_amount numeric(12,2),
  add column if not exists late_fee_percent numeric(6,3),
  add column if not exists late_fee_amount numeric(12,2),
  add column if not exists interest_percent numeric(6,3),
  add column if not exists interest_period text,
  add column if not exists interest_amount numeric(12,2),
  add column if not exists days_overdue integer;

comment on column public.installments.payment_principal_amount is
'Valor principal da parcela no momento da baixa.';
comment on column public.installments.payment_late_fee_percent is
'Percentual de multa aplicado no momento da baixa.';
comment on column public.installments.payment_late_fee_amount is
'Valor de multa aplicado no momento da baixa.';
comment on column public.installments.payment_interest_percent is
'Percentual de juros aplicado no momento da baixa.';
comment on column public.installments.payment_interest_period is
'Período do juros aplicado no momento da baixa: monthly ou daily.';
comment on column public.installments.payment_interest_amount is
'Valor de juros aplicado no momento da baixa.';
comment on column public.installments.payment_days_overdue is
'Dias de atraso considerados no momento da baixa.';

comment on column public.payment_records.principal_amount is
'Valor principal da parcela associado ao recebimento.';
comment on column public.payment_records.late_fee_percent is
'Percentual de multa considerado no recebimento.';
comment on column public.payment_records.late_fee_amount is
'Valor de multa considerado no recebimento.';
comment on column public.payment_records.interest_percent is
'Percentual de juros considerado no recebimento.';
comment on column public.payment_records.interest_period is
'Período do juros considerado no recebimento: monthly ou daily.';
comment on column public.payment_records.interest_amount is
'Valor de juros considerado no recebimento.';
comment on column public.payment_records.days_overdue is
'Dias de atraso considerados no recebimento.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'installments_payment_interest_period_valid_chk'
  ) then
    alter table public.installments
      add constraint installments_payment_interest_period_valid_chk
      check (
        payment_interest_period is null
        or payment_interest_period in ('monthly', 'daily')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'payment_records_interest_period_valid_chk'
  ) then
    alter table public.payment_records
      add constraint payment_records_interest_period_valid_chk
      check (
        interest_period is null
        or interest_period in ('monthly', 'daily')
      );
  end if;
end $$;

with installment_backfill as (
  select
    i.id,
    round(coalesce(i.amount, 0)::numeric, 2) as principal_amount,
    case
      when i.payment_date is not null
       and i.due_date is not null
       and i.payment_date::date > i.due_date::date
        then (i.payment_date::date - i.due_date::date)
      else 0
    end as days_overdue,
    case
      when i.payment_date is not null
       and i.due_date is not null
       and i.payment_date::date > i.due_date::date
       and coalesce(t.late_fee_enabled, false) = true
        then round(coalesce(t.late_fee_percent, 0)::numeric, 3)
      else 0
    end as late_fee_percent,
    case
      when i.payment_date is not null
       and i.due_date is not null
       and i.payment_date::date > i.due_date::date
       and coalesce(t.late_fee_enabled, false) = true
        then round(
          (
            coalesce(i.amount, 0)::numeric
            * (coalesce(t.late_fee_percent, 0)::numeric / 100)
          ),
          2
        )
      else 0
    end as late_fee_amount,
    case
      when i.payment_date is not null
       and i.due_date is not null
       and i.payment_date::date > i.due_date::date
       and coalesce(t.interest_enabled, false) = true
        then round(coalesce(t.interest_percent, 0)::numeric, 3)
      else 0
    end as interest_percent,
    case
      when coalesce(t.interest_enabled, false) = true
        then coalesce(t.interest_period, 'monthly')
      else null
    end as interest_period,
    case
      when i.payment_date is not null
       and i.due_date is not null
       and i.payment_date::date > i.due_date::date
       and coalesce(t.interest_enabled, false) = true
       and coalesce(t.interest_period, 'monthly') = 'daily'
        then round(
          (
            coalesce(i.amount, 0)::numeric
            * (coalesce(t.interest_percent, 0)::numeric / 100)
            * (i.payment_date::date - i.due_date::date)
          ),
          2
        )
      when i.payment_date is not null
       and i.due_date is not null
       and i.payment_date::date > i.due_date::date
       and coalesce(t.interest_enabled, false) = true
        then round(
          (
            coalesce(i.amount, 0)::numeric
            * (coalesce(t.interest_percent, 0)::numeric / 100)
            * ((i.payment_date::date - i.due_date::date) / 30.0)
          ),
          2
        )
      else 0
    end as interest_amount
  from public.installments i
  join public.treatments t on t.id = i.treatment_id
  where i.status = 'paid'
    and i.payment_date is not null
)
update public.installments i
set
  payment_principal_amount = b.principal_amount,
  payment_late_fee_percent = b.late_fee_percent,
  payment_late_fee_amount = b.late_fee_amount,
  payment_interest_percent = b.interest_percent,
  payment_interest_period = b.interest_period,
  payment_interest_amount = b.interest_amount,
  payment_days_overdue = b.days_overdue
from installment_backfill b
where i.id = b.id;

with payment_record_backfill as (
  select
    pr.id,
    round(coalesce(i.amount, 0)::numeric, 2) as principal_amount,
    case
      when pr.payment_date is not null
       and i.due_date is not null
       and pr.payment_date::date > i.due_date::date
        then (pr.payment_date::date - i.due_date::date)
      else 0
    end as days_overdue,
    case
      when pr.payment_date is not null
       and i.due_date is not null
       and pr.payment_date::date > i.due_date::date
       and coalesce(t.late_fee_enabled, false) = true
        then round(coalesce(t.late_fee_percent, 0)::numeric, 3)
      else 0
    end as late_fee_percent,
    case
      when pr.payment_date is not null
       and i.due_date is not null
       and pr.payment_date::date > i.due_date::date
       and coalesce(t.late_fee_enabled, false) = true
        then round(
          (
            coalesce(i.amount, 0)::numeric
            * (coalesce(t.late_fee_percent, 0)::numeric / 100)
          ),
          2
        )
      else 0
    end as late_fee_amount,
    case
      when pr.payment_date is not null
       and i.due_date is not null
       and pr.payment_date::date > i.due_date::date
       and coalesce(t.interest_enabled, false) = true
        then round(coalesce(t.interest_percent, 0)::numeric, 3)
      else 0
    end as interest_percent,
    case
      when coalesce(t.interest_enabled, false) = true
        then coalesce(t.interest_period, 'monthly')
      else null
    end as interest_period,
    case
      when pr.payment_date is not null
       and i.due_date is not null
       and pr.payment_date::date > i.due_date::date
       and coalesce(t.interest_enabled, false) = true
       and coalesce(t.interest_period, 'monthly') = 'daily'
        then round(
          (
            coalesce(i.amount, 0)::numeric
            * (coalesce(t.interest_percent, 0)::numeric / 100)
            * (pr.payment_date::date - i.due_date::date)
          ),
          2
        )
      when pr.payment_date is not null
       and i.due_date is not null
       and pr.payment_date::date > i.due_date::date
       and coalesce(t.interest_enabled, false) = true
        then round(
          (
            coalesce(i.amount, 0)::numeric
            * (coalesce(t.interest_percent, 0)::numeric / 100)
            * ((pr.payment_date::date - i.due_date::date) / 30.0)
          ),
          2
        )
      else 0
    end as interest_amount
  from public.payment_records pr
  join public.installments i on i.id = pr.installment_id
  join public.treatments t on t.id = i.treatment_id
)
update public.payment_records pr
set
  principal_amount = b.principal_amount,
  late_fee_percent = b.late_fee_percent,
  late_fee_amount = b.late_fee_amount,
  interest_percent = b.interest_percent,
  interest_period = b.interest_period,
  interest_amount = b.interest_amount,
  days_overdue = b.days_overdue
from payment_record_backfill b
where pr.id = b.id;