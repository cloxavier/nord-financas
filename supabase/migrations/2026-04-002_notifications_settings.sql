-- =========================================================
-- 002 — Notificações
-- =========================================================
-- REGISTRO HISTÓRICO:
-- Esta migration adiciona as colunas usadas pelas preferências
-- de alertas internos e cobrança assistida por WhatsApp.
--
-- IMPORTANTE:
-- Este arquivo é um registro do que já foi aplicado.
-- Não execute novamente em produção sem validar o estado atual do banco.

alter table app_settings
  add column if not exists due_alert_days integer default 3,
  add column if not exists highlight_overdue_installments boolean default true,
  add column if not exists show_dashboard_alert_summary boolean default true,
  add column if not exists enable_whatsapp_quick_charge boolean default true,
  add column if not exists reminder_message_template text,
  add column if not exists overdue_message_template text;