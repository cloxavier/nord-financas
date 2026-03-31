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
