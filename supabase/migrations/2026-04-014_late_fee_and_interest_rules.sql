-- =========================================================
-- 014 — Regras de multa e juros por atraso
--       padrão da clínica + snapshot no tratamento
-- =========================================================

alter table public.app_settings
  add column if not exists default_late_fee_enabled boolean not null default false;

alter table public.app_settings
  add column if not exists default_late_fee_percent numeric(6,3) not null default 0;

alter table public.app_settings
  add column if not exists default_interest_enabled boolean not null default false;

alter table public.app_settings
  add column if not exists default_interest_percent numeric(6,3) not null default 0;

alter table public.app_settings
  add column if not exists default_interest_period text not null default 'monthly';

alter table public.app_settings
  add column if not exists default_late_fee_notes text;

alter table public.treatments
  add column if not exists use_clinic_default_late_rules boolean not null default true;

alter table public.treatments
  add column if not exists late_fee_enabled boolean not null default false;

alter table public.treatments
  add column if not exists late_fee_percent numeric(6,3) not null default 0;

alter table public.treatments
  add column if not exists interest_enabled boolean not null default false;

alter table public.treatments
  add column if not exists interest_percent numeric(6,3) not null default 0;

alter table public.treatments
  add column if not exists interest_period text not null default 'monthly';

alter table public.treatments
  add column if not exists late_fee_notes text;

comment on column public.app_settings.default_late_fee_enabled is
'Define se a multa por atraso vem habilitada por padrão na clínica.';

comment on column public.app_settings.default_late_fee_percent is
'Percentual padrão de multa por atraso aplicado sobre o valor em aberto.';

comment on column public.app_settings.default_interest_enabled is
'Define se os juros por atraso vêm habilitados por padrão na clínica.';

comment on column public.app_settings.default_interest_percent is
'Percentual padrão de juros por atraso.';

comment on column public.app_settings.default_interest_period is
'Período padrão do juro por atraso: monthly ou daily.';

comment on column public.app_settings.default_late_fee_notes is
'Texto padrão contratual das regras de atraso da clínica.';

comment on column public.treatments.use_clinic_default_late_rules is
'Indica se o tratamento usou o padrão da clínica ao gerar o snapshot das regras de atraso.';

comment on column public.treatments.late_fee_enabled is
'Snapshot da multa por atraso habilitada para este tratamento.';

comment on column public.treatments.late_fee_percent is
'Snapshot do percentual de multa por atraso para este tratamento.';

comment on column public.treatments.interest_enabled is
'Snapshot dos juros por atraso habilitados para este tratamento.';

comment on column public.treatments.interest_percent is
'Snapshot do percentual de juros por atraso para este tratamento.';

comment on column public.treatments.interest_period is
'Snapshot do período do juro por atraso: monthly ou daily.';

comment on column public.treatments.late_fee_notes is
'Texto contratual/snapshot das condições de atraso deste tratamento.';

update public.treatments
set
  use_clinic_default_late_rules = coalesce(use_clinic_default_late_rules, true),
  late_fee_enabled = coalesce(late_fee_enabled, false),
  late_fee_percent = coalesce(late_fee_percent, 0),
  interest_enabled = coalesce(interest_enabled, false),
  interest_percent = coalesce(interest_percent, 0),
  interest_period = coalesce(interest_period, 'monthly');

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_default_late_fee_percent_non_negative_chk'
  ) then
    alter table public.app_settings
      add constraint app_settings_default_late_fee_percent_non_negative_chk
      check (default_late_fee_percent >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_default_interest_percent_non_negative_chk'
  ) then
    alter table public.app_settings
      add constraint app_settings_default_interest_percent_non_negative_chk
      check (default_interest_percent >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'app_settings_default_interest_period_valid_chk'
  ) then
    alter table public.app_settings
      add constraint app_settings_default_interest_period_valid_chk
      check (default_interest_period in ('monthly', 'daily'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_late_fee_percent_non_negative_chk'
  ) then
    alter table public.treatments
      add constraint treatments_late_fee_percent_non_negative_chk
      check (late_fee_percent >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_interest_percent_non_negative_chk'
  ) then
    alter table public.treatments
      add constraint treatments_interest_percent_non_negative_chk
      check (interest_percent >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'treatments_interest_period_valid_chk'
  ) then
    alter table public.treatments
      add constraint treatments_interest_period_valid_chk
      check (interest_period in ('monthly', 'daily'));
  end if;
end $$;