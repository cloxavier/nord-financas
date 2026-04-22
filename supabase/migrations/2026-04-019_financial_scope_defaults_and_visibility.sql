-- =========================================================
-- 019 — Escopo financeiro padrão para cargos do sistema
-- =========================================================
-- Objetivo:
-- - preencher financial_scope_json dos cargos padrão já existentes
-- - manter cargos customizados sem sobrescrever configuração manual

begin;

update public.access_roles
set financial_scope_json = jsonb_build_object(
  'financial_access_level', 'executive',
  'months_back_visible', 24,
  'months_forward_visible', 12,
  'can_view_monthly_forecast', true,
  'can_view_open_amount_total', true
),
updated_at = timezone('utc'::text, now())
where slug = 'gestor'
  and (financial_scope_json is null or financial_scope_json = '{}'::jsonb);

update public.access_roles
set financial_scope_json = jsonb_build_object(
  'financial_access_level', 'financial',
  'months_back_visible', 12,
  'months_forward_visible', 6,
  'can_view_monthly_forecast', true,
  'can_view_open_amount_total', true
),
updated_at = timezone('utc'::text, now())
where slug = 'financeiro'
  and (financial_scope_json is null or financial_scope_json = '{}'::jsonb);

update public.access_roles
set financial_scope_json = jsonb_build_object(
  'financial_access_level', 'operational',
  'months_back_visible', 2,
  'months_forward_visible', 2,
  'can_view_monthly_forecast', false,
  'can_view_open_amount_total', false
),
updated_at = timezone('utc'::text, now())
where slug = 'secretaria'
  and (financial_scope_json is null or financial_scope_json = '{}'::jsonb);

update public.access_roles
set financial_scope_json = jsonb_build_object(
  'financial_access_level', 'none',
  'months_back_visible', 0,
  'months_forward_visible', 0,
  'can_view_monthly_forecast', false,
  'can_view_open_amount_total', false
),
updated_at = timezone('utc'::text, now())
where slug = 'dentista'
  and (financial_scope_json is null or financial_scope_json = '{}'::jsonb);

commit;
