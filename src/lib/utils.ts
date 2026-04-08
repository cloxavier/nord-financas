/**
 * Funções utilitárias compartilhadas.
 * Este arquivo contém funções para manipulação de classes CSS, formatação de moeda e datas.
 */

import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Função cn (class names): Combina e mescla classes Tailwind CSS.
 * Resolve conflitos de classes Tailwind usando twMerge e gerencia classes condicionais com clsx.
 * @param inputs Lista de classes ou condições de classes.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Formata um valor numérico para o padrão de moeda brasileira (Real - BRL).
 * @param value O número a ser formatado.
 */
export function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

/**
 * Formata uma string de data ou objeto Date para o padrão brasileiro (DD/MM/AAAA).
 * @param date A data a ser formatada.
 */
export function formatDate(date: string | Date | null | undefined) {
  if (!date) return 'N/A';
  const d = new Date(date);
  if (isNaN(d.getTime())) return 'Data Inválida';
  return new Intl.DateTimeFormat('pt-BR').format(d);
}

/**
 * Formata uma string de data YYYY-MM-DD para o padrão brasileiro (DD/MM/AAAA)
 * sem sofrer deslocamento de fuso horário.
 * @param dateStr A string de data no formato YYYY-MM-DD.
 */
export function formatDateOnly(dateStr: string | null | undefined) {
  if (!dateStr) return 'Não informado';
  if (typeof dateStr !== 'string') return formatDate(dateStr);
  
  // Se for uma data ISO completa (com T), pega apenas a parte da data
  const pureDate = dateStr.split('T')[0];
  const parts = pureDate.split('-');
  
  if (parts.length !== 3) return formatDate(dateStr);
  
  const [year, month, day] = parts;
  return `${day}/${month}/${year}`;
}

/**
 * Prepara uma data para ser exibida em um input do tipo date (YYYY-MM-DD),
 * garantindo que não haja deslocamento de fuso horário.
 * @param date A data como string ou objeto Date.
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
