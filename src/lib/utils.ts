/**
 * Funções utilitárias compartilhadas.
 * Este arquivo contém funções para manipulação de classes CSS, formatação de moeda e datas.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

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
 * Verifica se a string está no formato puro de data YYYY-MM-DD.
 */
export function isDateOnlyString(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Converte uma string YYYY-MM-DD em Date local, sem sofrer deslocamento de fuso.
 * Usa meio-dia local para evitar problemas de timezone/DST na criação.
 */
export function parseDateOnlyAsLocalDate(dateStr: string | null | undefined) {
  if (!dateStr || typeof dateStr !== 'string') return null;

  const pureDate = dateStr.split('T')[0];
  if (!isDateOnlyString(pureDate)) return null;

  const [year, month, day] = pureDate.split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0, 0);
}

/**
 * Formata uma string de data YYYY-MM-DD para o padrão brasileiro (DD/MM/AAAA)
 * sem sofrer deslocamento de fuso horário.
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
 * Formata uma string de data ou objeto Date para o padrão brasileiro (DD/MM/AAAA).
 * Se a entrada for YYYY-MM-DD puro, trata como data sem horário para não deslocar um dia.
 */
export function formatDate(date: string | Date | null | undefined) {
  if (!date) return 'N/A';

  if (typeof date === 'string' && isDateOnlyString(date.split('T')[0]) && !date.includes('T')) {
    return formatDateOnly(date);
  }

  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return 'Data Inválida';

  return new Intl.DateTimeFormat('pt-BR').format(d);
}

/**
 * Prepara uma data para ser exibida em um input do tipo date (YYYY-MM-DD),
 * garantindo que não haja deslocamento de fuso horário.
 */
export function formatDateOnlyForInput(date: string | Date | null | undefined) {
  if (!date) return '';

  if (typeof date === 'string') {
    return date.split('T')[0];
  }

  if (date instanceof Date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}