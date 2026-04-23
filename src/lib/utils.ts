
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

export function isDateOnlyString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function toValidDate(value: string | Date | number | null | undefined) {
  if (!value) return null;

  const parsed = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

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

export function getTodayDateInAppTimezone() {
  const parts = getAppDateParts(new Date());
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function getMonthStartDateInAppTimezone(
  referenceDate: string | Date | number | null | undefined = new Date()
) {
  const parts = getAppDateParts(referenceDate);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-01`;
}

export function parseDateOnlyAsLocalDate(dateStr: string | null | undefined) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const pureDate = dateStr.split('T')[0];
  if (!isDateOnlyString(pureDate)) return null;

  const [year, month, day] = pureDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

export function formatDateOnly(dateStr: string | null | undefined) {
  if (!dateStr) return 'Não informado';
  if (typeof dateStr !== 'string') return formatDate(dateStr);

  const pureDate = dateStr.split('T')[0];
  const parts = pureDate.split('-');
  if (parts.length !== 3) return formatDate(dateStr);

  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

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

export function formatDateOnlyForInput(date: string | Date | null | undefined) {
  if (!date) return '';

  if (typeof date === 'string') {
    return date.split('T')[0];
  }

  const parts = getAppDateParts(date);
  if (!parts) return '';

  return `${parts.year}-${parts.month}-${parts.day}`;
}

export interface PhonePartsInput {
  countryCode?: string | null;
  areaCode?: string | null;
  number?: string | null;
}

export interface NormalizedPhoneParts {
  countryCode: string;
  areaCode: string;
  number: string;
}

const COUNTRY_DIAL_CODE_BY_REGION: Record<string, string> = {
  BR: '55',
  PT: '351',
  US: '1',
  CA: '1',
  AR: '54',
  CL: '56',
  CO: '57',
  MX: '52',
  PY: '595',
  UY: '598',
  ES: '34',
  GB: '44',
};

export const PHONE_COUNTRY_OPTIONS = [
  { code: '55', label: 'Brasil (+55)' },
  { code: '351', label: 'Portugal (+351)' },
  { code: '1', label: 'Estados Unidos / Canadá (+1)' },
  { code: '34', label: 'Espanha (+34)' },
  { code: '44', label: 'Reino Unido (+44)' },
  { code: '52', label: 'México (+52)' },
  { code: '54', label: 'Argentina (+54)' },
  { code: '56', label: 'Chile (+56)' },
  { code: '57', label: 'Colômbia (+57)' },
  { code: '598', label: 'Uruguai (+598)' },
  { code: '595', label: 'Paraguai (+595)' },
];

export function digitsOnly(value: string | number | null | undefined) {
  return String(value || '').replace(/\D/g, '');
}

export function getDefaultCountryCodeForLocale() {
  const localeFromBrowser =
    typeof navigator !== 'undefined' ? navigator.language || navigator.languages?.[0] : '';

  const regionMatch = String(localeFromBrowser).match(/[-_]([A-Z]{2})$/i);
  const region = regionMatch?.[1]?.toUpperCase() || 'BR';

  return COUNTRY_DIAL_CODE_BY_REGION[region] || '55';
}

export function normalizeCountryCode(value: string | null | undefined) {
  return digitsOnly(value).slice(0, 4);
}

export function normalizeAreaCode(value: string | null | undefined) {
  return digitsOnly(value).slice(0, 4);
}

export function normalizePhoneNumber(value: string | null | undefined) {
  return digitsOnly(value).slice(0, 15);
}

export function normalizePhoneParts(parts: PhonePartsInput): NormalizedPhoneParts {
  return {
    countryCode: normalizeCountryCode(parts.countryCode),
    areaCode: normalizeAreaCode(parts.areaCode),
    number: normalizePhoneNumber(parts.number),
  };
}

export function buildPhoneStorageValue(parts: PhonePartsInput) {
  const normalized = normalizePhoneParts(parts);
  const digits = `${normalized.countryCode}${normalized.areaCode}${normalized.number}`;
  return digits || null;
}

export function buildPhoneE164(parts: PhonePartsInput) {
  const normalized = normalizePhoneParts(parts);

  if (!normalized.countryCode || !normalized.areaCode || !normalized.number) {
    return null;
  }

  return `${normalized.countryCode}${normalized.areaCode}${normalized.number}`;
}

function formatBrazilLocalNumber(number: string) {
  if (number.length === 9) return `${number.slice(0, 5)}-${number.slice(5)}`;
  if (number.length === 8) return `${number.slice(0, 4)}-${number.slice(4)}`;
  return number;
}

export function formatPhoneDisplay(parts: PhonePartsInput) {
  const normalized = normalizePhoneParts(parts);

  if (!normalized.countryCode && !normalized.areaCode && !normalized.number) {
    return '';
  }

  const countryPrefix = normalized.countryCode ? `+${normalized.countryCode}` : '';
  const areaText = normalized.areaCode ? `(${normalized.areaCode})` : '';
  const numberText = normalized.countryCode === '55' ? formatBrazilLocalNumber(normalized.number) : normalized.number;

  return [countryPrefix, areaText, numberText].filter(Boolean).join(' ').trim();
}

export function parseLegacyPhoneToParts(phone: string | null | undefined): NormalizedPhoneParts {
  let digits = digitsOnly(phone);
  if (!digits) return { countryCode: '', areaCode: '', number: '' };

  if (digits.startsWith('00')) digits = digits.slice(2);

  if (digits.length === 10 || digits.length === 11) {
    return { countryCode: '55', areaCode: digits.slice(0, 2), number: digits.slice(2) };
  }

  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    return { countryCode: '55', areaCode: digits.slice(2, 4), number: digits.slice(4) };
  }

  for (let countryLength = 1; countryLength <= 4; countryLength += 1) {
    const countryCode = digits.slice(0, countryLength);
    const remaining = digits.slice(countryLength);
    if (remaining.length === 10 || remaining.length === 11) {
      return { countryCode, areaCode: remaining.slice(0, 2), number: remaining.slice(2) };
    }
  }

  return { countryCode: '', areaCode: '', number: digits };
}

export function getPhonePartsFromPatient(patient: any): NormalizedPhoneParts {
  const countryCode = normalizeCountryCode(patient?.phone_country_code);
  const areaCode = normalizeAreaCode(patient?.phone_area_code);
  const number = normalizePhoneNumber(patient?.phone_number);

  if (countryCode || areaCode || number) {
    return { countryCode, areaCode, number };
  }

  return parseLegacyPhoneToParts(patient?.phone);
}

export function getPatientPhoneDisplay(patient: any) {
  return formatPhoneDisplay(getPhonePartsFromPatient(patient));
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string) {
  const digits = digitsOnly(phone);
  if (digits.length < 10 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
