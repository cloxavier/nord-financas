-- =========================================================
-- 003 — Permissões e Segurança
-- =========================================================
-- REGISTRO HISTÓRICO:
-- Esta migration adiciona as colunas de preferências da tela
-- "Permissões e Segurança".
--
-- IMPORTANTE:
-- Este arquivo é um registro do que já foi aplicado.
-- Não execute novamente em produção sem validar o estado atual do banco.

alter table app_settings
  add column if not exists require_delete_patient_confirmation boolean default true,
  add column if not exists require_delete_treatment_confirmation boolean default true,
  add column if not exists require_edit_received_payment_confirmation boolean default true,
  add column if not exists require_delete_financial_record_confirmation boolean default true,
  add column if not exists show_sensitive_action_warning boolean default true,
  add column if not exists sensitive_action_guidance_text text;