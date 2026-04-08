/**
 * Centralização das regras de negócio da aplicação.
 * Todas as métricas derivadas e estados de negócio devem ser definidos aqui.
 */

import { formatCurrency, formatDate } from './utils';

/**
 * Regra canônica para determinar se uma parcela está em atraso.
 * Uma parcela é considerada em atraso se:
 * - A data de vencimento é anterior à data atual
 * - O status não é 'paid' (pago)
 * - O status não é 'cancelled' (cancelado)
 * - O valor restante (amount - amount_paid) é maior que zero
 */
export function isInstallmentOverdue(installment: any): boolean {
  if (!installment) return false;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(installment.due_date);
  dueDate.setHours(0, 0, 0, 0);
  
  const isPaid = installment.status === 'paid';
  const isCancelled = installment.status === 'cancelled';
  const remainingAmount = (installment.amount || 0) - (installment.amount_paid || 0);
  
  return dueDate < today && !isPaid && !isCancelled && remainingAmount > 0;
}

/**
 * Calcula os dias de atraso de uma parcela.
 */
export function getDaysOverdue(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const dueDate = new Date(dueDateStr);
  dueDate.setHours(0, 0, 0, 0);
  
  if (dueDate >= today) return 0;
  
  const diffTime = Math.abs(today.getTime() - dueDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Resolve o nome do paciente de forma padronizada em toda a aplicação.
 * Prioridade:
 * 1. Nome completo do paciente (join)
 * 2. Snapshot do nome no tratamento
 * 3. Snapshot do nome na parcela
 * 4. Fallback para ID do tratamento
 */
export function resolvePatientName(record: any): string {
  if (!record) return 'Paciente Desconhecido';
  
  // Se for uma parcela com join de tratamento e paciente
  if (record.treatments?.patients?.full_name) return record.treatments.patients.full_name;
  if (record.treatments?.patient_name_snapshot) return record.treatments.patient_name_snapshot;
  
  // Se for um tratamento com join de paciente
  if (record.patients?.full_name) return record.patients.full_name;
  if (record.patient_name_snapshot) return record.patient_name_snapshot;
  
  // Fallback para ID
  if (record.treatment_id) return `Tratamento #${record.treatment_id.slice(0, 8)}`;
  if (record.id) return `Registro #${record.id.slice(0, 8)}`;
  
  return 'Paciente';
}

/**
 * Calcula o resumo financeiro de um tratamento.
 */
export function calculateTreatmentFinancials(treatment: any, installments: any[] = []) {
  const subtotal = treatment.subtotal || 0;
  const discount = treatment.discount_amount || 0;
  const total = treatment.total_amount || (subtotal - discount);
  
  const paid = installments
    .filter(i => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount_paid || i.amount), 0);
    
  const pending = total - paid;
  
  return {
    subtotal,
    discount,
    total,
    paid,
    pending,
    isFullyPaid: pending <= 0,
    installmentsCount: installments.length,
    paidCount: installments.filter(i => i.status === 'paid').length
  };
}
