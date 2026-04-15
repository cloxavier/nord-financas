/**
 * Centralização das regras de negócio da aplicação.
 * Todas as métricas derivadas e estados de negócio devem ser definidos aqui.
 */

import { parseDateOnlyAsLocalDate } from './utils';

/**
 * Retorna o valor em aberto de uma parcela.
 * Nunca deixa retornar valor negativo.
 */
export function getInstallmentOutstandingAmount(installment: any): number {
  if (!installment) return 0;

  const amount = Number(installment.amount || 0);
  const amountPaid = Number(installment.amount_paid || 0);

  return Math.max(amount - amountPaid, 0);
}

/**
 * Regra canônica para determinar se uma parcela está em atraso.
 * Uma parcela é considerada em atraso se:
 * - A data de vencimento é anterior à data atual
 * - O status não é 'paid' (pago)
 * - O status não é 'cancelled' (cancelado)
 * - O valor restante é maior que zero
 */
export function isInstallmentOverdue(installment: any): boolean {
  if (!installment) return false;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = parseDateOnlyAsLocalDate(installment.due_date);
  if (!dueDate) return false;

  dueDate.setHours(0, 0, 0, 0);

  const isPaid = installment.status === 'paid';
  const isCancelled = installment.status === 'cancelled';
  const remainingAmount = getInstallmentOutstandingAmount(installment);

  return dueDate < today && !isPaid && !isCancelled && remainingAmount > 0;
}

/**
 * Retorna o status efetivo de uma parcela para uso nas telas.
 * Esse status pode divergir do valor puro salvo no banco, porque atraso
 * é um estado derivado pela data de vencimento + pagamento.
 */
export function getInstallmentEffectiveStatus(
  installment: any
): 'paid' | 'cancelled' | 'overdue' | 'pending' {
  if (!installment) return 'pending';

  if (installment.status === 'paid' || getInstallmentOutstandingAmount(installment) <= 0) {
    return 'paid';
  }

  if (installment.status === 'cancelled') {
    return 'cancelled';
  }

  if (isInstallmentOverdue(installment)) {
    return 'overdue';
  }

  return 'pending';
}

/**
 * Label amigável do status efetivo.
 */
export function getInstallmentEffectiveStatusLabel(installment: any): string {
  const effectiveStatus = getInstallmentEffectiveStatus(installment);

  if (effectiveStatus === 'paid') return 'Pago';
  if (effectiveStatus === 'cancelled') return 'Cancelado';
  if (effectiveStatus === 'overdue') return 'Atrasado';
  return 'Pendente';
}

/**
 * Calcula os dias de atraso de uma parcela.
 */
export function getDaysOverdue(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = parseDateOnlyAsLocalDate(dueDateStr);
  if (!dueDate) return 0;

  dueDate.setHours(0, 0, 0, 0);

  if (dueDate >= today) return 0;

  const diffTime = Math.abs(today.getTime() - dueDate.getTime());
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Resolve o nome do paciente de forma padronizada em toda a aplicação.
 */
export function resolvePatientName(record: any): string {
  if (!record) return 'Paciente Desconhecido';

  if (record.treatments?.patients?.full_name) return record.treatments.patients.full_name;
  if (record.treatments?.patient_name_snapshot) return record.treatments.patient_name_snapshot;

  if (record.patients?.full_name) return record.patients.full_name;
  if (record.patient_name_snapshot) return record.patient_name_snapshot;

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
  const total = treatment.total_amount || subtotal - discount;

  const paid = installments
    .filter((i) => getInstallmentEffectiveStatus(i) === 'paid')
    .reduce((sum, i) => sum + Number(i.amount_paid || i.amount || 0), 0);

  const pending = total - paid;

  return {
    subtotal,
    discount,
    total,
    paid,
    pending,
    isFullyPaid: pending <= 0,
    installmentsCount: installments.length,
    paidCount: installments.filter((i) => getInstallmentEffectiveStatus(i) === 'paid').length,
  };
}