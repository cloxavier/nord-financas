/**
 * Funções utilitárias compartilhadas.
 * Este arquivo concentra:
 * - classes CSS
 * - formatação monetária
 * - regras canônicas de data/hora da aplicação
 *
 * Regra desta fase:
 * a timezone oficial da aplicação é America/Sao_Paulo.
 * Tudo que for exibição, data padrão de input e parsing de datas corridas
 * deve passar por este arquivo.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const APP_TIMEZONE = 'America/Sao_Paulo';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Verifica se a string está no formato puro YYYY-MM-DD.
 */
export function isDateOnlyString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Normaliza uma entrada qualquer em Date válido.
 */
function toValidDate(value: string | Date | number | null | undefined) {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Extrai ano/mês/dia já respeitando a timezone oficial da aplicação.
 * Retorna mês e dia sempre com 2 dígitos.
 */
function getAppDateParts(value: string | Date | number | null | undefined = new Date()) {
  const safeDate = toValidDate(value);
  if (!safeDate) return null;

  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const parts = formatter.formatToParts(safeDate);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) return null;

  return { year, month, day };
}

/**
 * Retorna a data de hoje na timezone da aplicação em YYYY-MM-DD.
 * Esta função substitui o padrão antigo new Date().toISOString().split('T')[0].
 */
export function getTodayDateInAppTimezone() {
  const parts = getAppDateParts(new Date());
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Retorna o primeiro dia do mês corrente na timezone da aplicação.
 */
export function getMonthStartDateInAppTimezone(
  referenceDate: string | Date | number | null | undefined = new Date()
) {
  const parts = getAppDateParts(referenceDate);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-01`;
}

/**
 * Converte uma string YYYY-MM-DD em Date local, sem sofrer deslocamento de fuso.
 * Usa meio-dia local para evitar problemas de DST/UTC.
 */
export function parseDateOnlyAsLocalDate(dateStr: string | null | undefined) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const pureDate = dateStr.split('T')[0];
  if (!isDateOnlyString(pureDate)) return null;

  const [year, month, day] = pureDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Formata uma data YYYY-MM-DD para DD/MM/AAAA sem deslocamento.
 */
export function formatDateOnly(dateStr: string | null | undefined) {
  if (!dateStr) return 'Não informado';
  if (typeof dateStr !== 'string') return formatDate(dateStr);

  const pureDate = dateStr.split('T')[0];
  const parts = pureDate.split('-');

  if (parts.length !== 3) return formatDate(dateStr);

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Formata data para DD/MM/AAAA.
 * - Se receber YYYY-MM-DD puro, trata como data sem horário.
 * - Se receber datetime, formata respeitando America/Sao_Paulo.
 */
export function formatDate(date: string | Date | null | undefined) {
  if (!date) return 'N/A';

  if (typeof date === 'string') {
    const pureDate = date.split('T')[0];
    if (isDateOnlyString(pureDate) && !date.includes('T')) {
      return formatDateOnly(date);
    }
  }

  const safeDate = toValidDate(date);
  if (!safeDate) return 'Data Inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
  }).format(safeDate);
}

/**
 * Formata data e hora completas na timezone da aplicação.
 */
export function formatDateTime(date: string | Date | null | undefined) {
  if (!date) return 'N/A';

  const safeDate = toValidDate(date);
  if (!safeDate) return 'Data Inválida';

  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: APP_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(safeDate);
}

/**
 * Prepara uma data para input[type="date"] em YYYY-MM-DD
 * sem deslocamento indevido de UTC.
 */
export function formatDateOnlyForInput(date: string | Date | null | undefined) {
  if (!date) return '';

  if (typeof date === 'string') {
    return date.split('T')[0];
  }

  const parts = getAppDateParts(date);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}`;
}

/**
 * Normaliza um telefone para uso em links do WhatsApp.
 * Regra atual da aplicação:
 * - assume Brasil (+55) como padrão quando o número vier apenas com DDD + telefone
 * - aceita números já completos com código do país
 * - remove símbolos como espaços, parênteses e hífens
 */
export function normalizePhoneForWhatsApp(
  phone: string | null | undefined,
  defaultCountryCode = '55'
) {
  let digits = String(phone || '').replace(/\D/g, '');

  if (!digits) return null;

  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }

  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith(defaultCountryCode)) {
    return `${defaultCountryCode}${digits}`;
  }

  if (digits.startsWith(defaultCountryCode) && (digits.length === 12 || digits.length === 13)) {
    return digits;
  }

  if (digits.length >= 12 && digits.length <= 15) {
    return digits;
  }

  return null;
}

/**
 * Monta um link do WhatsApp pronto para uso.
 * Retorna null quando o telefone não for válido para abertura do app.
 */
export function buildWhatsAppLink(
  phone: string | null | undefined,
  message: string,
  defaultCountryCode = '55'
) {
  const normalizedPhone = normalizePhoneForWhatsApp(phone, defaultCountryCode);

  if (!normalizedPhone) {
    return null;
  }

  return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
}

