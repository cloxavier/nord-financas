-- =========================================================
-- 016 — Propagação de permissões para telas já existentes
-- =========================================================
-- Objetivo:
-- - adicionar novas chaves no permissions_json dos cargos padrão
-- - manter coerência com as telas já existentes no sistema
-- - sem alterar a estrutura das tabelas nesta etapa
--
-- IMPORTANTE:
-- Esta migration não recria as tabelas de acesso.
-- Ela apenas complementa o permissions_json dos cargos padrão.

begin;

update public.access_roles
set
  permissions_json =
    coalesce(permissions_json, '{}'::jsonb)
    || jsonb_build_object(
      'activities_view', true,
      'procedures_view', true,
      'procedures_create', true,
      'procedures_edit', true,
      'reports_view', true
    ),
  updated_at = timezone('utc'::text, now())
where slug = 'gestor';

update public.access_roles
set
  permissions_json =
    coalesce(permissions_json, '{}'::jsonb)
    || jsonb_build_object(
      'activities_view', true,
      'procedures_view', true,
      'procedures_create', false,
      'procedures_edit', false,
      'reports_view', false
    ),
  updated_at = timezone('utc'::text, now())
where slug = 'secretaria';

update public.access_roles
set
  permissions_json =
    coalesce(permissions_json, '{}'::jsonb)
    || jsonb_build_object(
      'activities_view', true,
      'procedures_view', false,
      'procedures_create', false,
      'procedures_edit', false,
      'reports_view', true
    ),
  updated_at = timezone('utc'::text, now())
where slug = 'financeiro';

update public.access_roles
set
  permissions_json =
    coalesce(permissions_json, '{}'::jsonb)
    || jsonb_build_object(
      'activities_view', true,
      'procedures_view', true,
      'procedures_create', true,
      'procedures_edit', true,
      'reports_view', false
    ),
  updated_at = timezone('utc'::text, now())
where slug = 'dentista';

commit;