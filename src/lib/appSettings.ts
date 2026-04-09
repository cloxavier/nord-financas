/**
 * Serviço central de leitura e escrita das configurações da aplicação.
 * Nesta fase, ele cuida de:
 * - Financeiro & Pix
 * - Notificações
 *
 * Tudo continua centralizado na tabela app_settings para manter simplicidade e baixo risco.
 */

import { supabase } from './supabase';

/**
 * =========================
 * Financeiro & Pix
 * =========================
 */

export interface FinancialPixSettingsFormData {
  pix_key_type: string;
  pix_key: string;
  beneficiary_name: string;
  default_payment_instructions: string;
  default_contract_notes: string;
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

/**
 * Busca o registro mais recente da tabela app_settings.
 * O sistema hoje trabalha como configuração central da clínica,
 * então o registro mais recente continua sendo a fonte de verdade.
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
 * Reutilizado pelos módulos de configurações.
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

    if (error) {
      throw error;
    }

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

    if (error) {
      throw error;
    }

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

  if (error) {
    throw error;
  }

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