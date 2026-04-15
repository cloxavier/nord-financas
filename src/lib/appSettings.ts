/**
 * Serviço central de leitura e escrita das configurações da aplicação.
 * Nesta fase, ele cuida de:
 * - Financeiro & Pix
 * - Notificações
 * - Permissões e Segurança
 *
 * Tudo continua centralizado na tabela app_settings para manter simplicidade e baixo risco.
 */

import { supabase } from './supabase';

/**
 * =========================
 * Financeiro & Pix
 * =========================
 */

export type LateInterestPeriod = 'monthly' | 'daily';

export interface FinancialPixSettingsFormData {
  pix_key_type: string;
  pix_key: string;
  beneficiary_name: string;
  default_payment_instructions: string;
  default_contract_notes: string;
  default_late_fee_enabled: boolean;
  default_late_fee_percent: string;
  default_interest_enabled: boolean;
  default_interest_percent: string;
  default_interest_period: LateInterestPeriod;
  default_late_fee_notes: string;
}

export interface FinancialPixSettingsRecord extends FinancialPixSettingsFormData {
  id: string | null;
  updated_at: string | null;
}

export const EMPTY_FINANCIAL_PIX_SETTINGS: FinancialPixSettingsFormData = {
  pix_key_type: '',
  pix_key: '',
  beneficiary_name: '',
  default_payment_instructions: '',
  default_contract_notes: '',
  default_late_fee_enabled: false,
  default_late_fee_percent: '2',
  default_interest_enabled: false,
  default_interest_percent: '1',
  default_interest_period: 'monthly',
  default_late_fee_notes: '',
};

/**
 * =========================
 * Notificações
 * =========================
 */

export interface NotificationSettingsFormData {
  due_alert_days: string;
  highlight_overdue_installments: boolean;
  show_dashboard_alert_summary: boolean;
  enable_whatsapp_quick_charge: boolean;
  reminder_message_template: string;
  overdue_message_template: string;
}

export interface NotificationSettingsRecord extends NotificationSettingsFormData {
  id: string | null;
  updated_at: string | null;
}

export const DEFAULT_REMINDER_MESSAGE_TEMPLATE =
  'Olá, {nome_paciente}. Passando para lembrar que há um vencimento em aberto com data prevista para {vencimento}. Se já realizou o pagamento, por favor envie o comprovante.';

export const DEFAULT_OVERDUE_MESSAGE_TEMPLATE =
  'Olá, {nome_paciente}. Identificamos uma pendência com vencimento em {vencimento}, no valor de {valor}. Se desejar, podemos te orientar sobre a melhor forma de regularização.';

export const EMPTY_NOTIFICATION_SETTINGS: NotificationSettingsFormData = {
  due_alert_days: '3',
  highlight_overdue_installments: true,
  show_dashboard_alert_summary: true,
  enable_whatsapp_quick_charge: true,
  reminder_message_template: DEFAULT_REMINDER_MESSAGE_TEMPLATE,
  overdue_message_template: DEFAULT_OVERDUE_MESSAGE_TEMPLATE,
};

/**
 * =========================
 * Permissões e Segurança
 * =========================
 */

export interface PermissionSecuritySettingsFormData {
  require_delete_patient_confirmation: boolean;
  require_delete_treatment_confirmation: boolean;
  require_edit_received_payment_confirmation: boolean;
  require_delete_financial_record_confirmation: boolean;
  show_sensitive_action_warning: boolean;
  sensitive_action_guidance_text: string;
}

export interface PermissionSecuritySettingsRecord extends PermissionSecuritySettingsFormData {
  id: string | null;
  updated_at: string | null;
}

export const DEFAULT_SENSITIVE_ACTION_GUIDANCE_TEXT =
  'Antes de confirmar uma ação crítica, revise os dados envolvidos e confirme se a alteração é realmente necessária. Operações sensíveis podem impactar histórico, financeiro e rastreabilidade do sistema.';

export const EMPTY_PERMISSION_SECURITY_SETTINGS: PermissionSecuritySettingsFormData = {
  require_delete_patient_confirmation: true,
  require_delete_treatment_confirmation: true,
  require_edit_received_payment_confirmation: true,
  require_delete_financial_record_confirmation: true,
  show_sensitive_action_warning: true,
  sensitive_action_guidance_text: DEFAULT_SENSITIVE_ACTION_GUIDANCE_TEXT,
};

/**
 * =========================
 * Utilitários internos
 * =========================
 */

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

function nullToEmpty(value?: string | null): string {
  return value ?? '';
}

function booleanOrDefault(value: boolean | null | undefined, fallback: boolean): boolean {
  return value ?? fallback;
}

function stringNumberOrDefault(value: number | null | undefined, fallback: string): string {
  if (value === null || value === undefined) return fallback;
  return String(value);
}

function numericStringToPositiveNumber(value: string, fallback: number): number {
  const parsed = Number(String(value).replace(',', '.'));
  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

/**
 * Busca o registro mais recente da tabela app_settings.
 */
async function getLatestAppSettingsRecord() {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

/**
 * Atualiza ou cria o registro central de app_settings.
 */
async function upsertLatestAppSettings(
  payload: Record<string, any>,
  currentId?: string | null
): Promise<{ id: string; updated_at: string | null }> {
  const completePayload = {
    ...payload,
    updated_at: new Date().toISOString(),
  };

  if (currentId) {
    const { data, error } = await supabase
      .from('app_settings')
      .update(completePayload)
      .eq('id', currentId)
      .select('id, updated_at')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      updated_at: data.updated_at ?? null,
    };
  }

  const existing = await getLatestAppSettingsRecord();

  if (existing?.id) {
    const { data, error } = await supabase
      .from('app_settings')
      .update(completePayload)
      .eq('id', existing.id)
      .select('id, updated_at')
      .single();

    if (error) throw error;

    return {
      id: data.id,
      updated_at: data.updated_at ?? null,
    };
  }

  const { data, error } = await supabase
    .from('app_settings')
    .insert(completePayload)
    .select('id, updated_at')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    updated_at: data.updated_at ?? null,
  };
}

/**
 * =========================
 * Financeiro & Pix
 * =========================
 */

export async function getFinancialPixSettings(): Promise<FinancialPixSettingsRecord> {
  const data = await getLatestAppSettingsRecord();

  if (!data) {
    return {
      id: null,
      updated_at: null,
      ...EMPTY_FINANCIAL_PIX_SETTINGS,
    };
  }

  return {
    id: data.id,
    updated_at: data.updated_at ?? null,
    pix_key_type: nullToEmpty(data.pix_key_type),
    pix_key: nullToEmpty(data.pix_key),
    beneficiary_name: nullToEmpty(data.beneficiary_name),
    default_payment_instructions: nullToEmpty(data.default_payment_instructions),
    default_contract_notes: nullToEmpty(data.default_contract_notes),
    default_late_fee_enabled: booleanOrDefault(data.default_late_fee_enabled, false),
    default_late_fee_percent: stringNumberOrDefault(data.default_late_fee_percent, '2'),
    default_interest_enabled: booleanOrDefault(data.default_interest_enabled, false),
    default_interest_percent: stringNumberOrDefault(data.default_interest_percent, '1'),
    default_interest_period:
      data.default_interest_period === 'daily' ? 'daily' : 'monthly',
    default_late_fee_notes: nullToEmpty(data.default_late_fee_notes),
  };
}

export async function saveFinancialPixSettings(
  values: FinancialPixSettingsFormData,
  currentId?: string | null
): Promise<{ id: string; updated_at: string | null }> {
  const payload = {
    pix_key_type: emptyToNull(values.pix_key_type),
    pix_key: emptyToNull(values.pix_key),
    beneficiary_name: emptyToNull(values.beneficiary_name),
    default_payment_instructions: emptyToNull(values.default_payment_instructions),
    default_contract_notes: emptyToNull(values.default_contract_notes),
    default_late_fee_enabled: values.default_late_fee_enabled,
    default_late_fee_percent: numericStringToPositiveNumber(
      values.default_late_fee_percent,
      2
    ),
    default_interest_enabled: values.default_interest_enabled,
    default_interest_percent: numericStringToPositiveNumber(
      values.default_interest_percent,
      1
    ),
    default_interest_period:
      values.default_interest_period === 'daily' ? 'daily' : 'monthly',
    default_late_fee_notes: emptyToNull(values.default_late_fee_notes),
  };

  return upsertLatestAppSettings(payload, currentId);
}

/**
 * =========================
 * Notificações
 * =========================
 */

export async function getNotificationSettings(): Promise<NotificationSettingsRecord> {
  const data = await getLatestAppSettingsRecord();

  if (!data) {
    return {
      id: null,
      updated_at: null,
      ...EMPTY_NOTIFICATION_SETTINGS,
    };
  }

  return {
    id: data.id,
    updated_at: data.updated_at ?? null,
    due_alert_days: stringNumberOrDefault(data.due_alert_days, '3'),
    highlight_overdue_installments: booleanOrDefault(
      data.highlight_overdue_installments,
      true
    ),
    show_dashboard_alert_summary: booleanOrDefault(
      data.show_dashboard_alert_summary,
      true
    ),
    enable_whatsapp_quick_charge: booleanOrDefault(
      data.enable_whatsapp_quick_charge,
      true
    ),
    reminder_message_template:
      nullToEmpty(data.reminder_message_template) || DEFAULT_REMINDER_MESSAGE_TEMPLATE,
    overdue_message_template:
      nullToEmpty(data.overdue_message_template) || DEFAULT_OVERDUE_MESSAGE_TEMPLATE,
  };
}

export async function saveNotificationSettings(
  values: NotificationSettingsFormData,
  currentId?: string | null
): Promise<{ id: string; updated_at: string | null }> {
  const parsedDays = Number(values.due_alert_days);

  const payload = {
    due_alert_days: Number.isFinite(parsedDays) && parsedDays >= 0 ? parsedDays : 3,
    highlight_overdue_installments: values.highlight_overdue_installments,
    show_dashboard_alert_summary: values.show_dashboard_alert_summary,
    enable_whatsapp_quick_charge: values.enable_whatsapp_quick_charge,
    reminder_message_template:
      emptyToNull(values.reminder_message_template) ?? DEFAULT_REMINDER_MESSAGE_TEMPLATE,
    overdue_message_template:
      emptyToNull(values.overdue_message_template) ?? DEFAULT_OVERDUE_MESSAGE_TEMPLATE,
  };

  return upsertLatestAppSettings(payload, currentId);
}

/**
 * =========================
 * Permissões e Segurança
 * =========================
 */

export async function getPermissionSecuritySettings(): Promise<PermissionSecuritySettingsRecord> {
  const data = await getLatestAppSettingsRecord();

  if (!data) {
    return {
      id: null,
      updated_at: null,
      ...EMPTY_PERMISSION_SECURITY_SETTINGS,
    };
  }

  return {
    id: data.id,
    updated_at: data.updated_at ?? null,
    require_delete_patient_confirmation: booleanOrDefault(
      data.require_delete_patient_confirmation,
      true
    ),
    require_delete_treatment_confirmation: booleanOrDefault(
      data.require_delete_treatment_confirmation,
      true
    ),
    require_edit_received_payment_confirmation: booleanOrDefault(
      data.require_edit_received_payment_confirmation,
      true
    ),
    require_delete_financial_record_confirmation: booleanOrDefault(
      data.require_delete_financial_record_confirmation,
      true
    ),
    show_sensitive_action_warning: booleanOrDefault(
      data.show_sensitive_action_warning,
      true
    ),
    sensitive_action_guidance_text:
      nullToEmpty(data.sensitive_action_guidance_text) || DEFAULT_SENSITIVE_ACTION_GUIDANCE_TEXT,
  };
}

export async function savePermissionSecuritySettings(
  values: PermissionSecuritySettingsFormData,
  currentId?: string | null
): Promise<{ id: string; updated_at: string | null }> {
  const payload = {
    require_delete_patient_confirmation: values.require_delete_patient_confirmation,
    require_delete_treatment_confirmation: values.require_delete_treatment_confirmation,
    require_edit_received_payment_confirmation: values.require_edit_received_payment_confirmation,
    require_delete_financial_record_confirmation: values.require_delete_financial_record_confirmation,
    show_sensitive_action_warning: values.show_sensitive_action_warning,
    sensitive_action_guidance_text:
      emptyToNull(values.sensitive_action_guidance_text) ?? DEFAULT_SENSITIVE_ACTION_GUIDANCE_TEXT,
  };

  return upsertLatestAppSettings(payload, currentId);
}