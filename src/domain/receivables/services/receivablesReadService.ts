import { supabase } from '@/src/lib/supabase';
import { isInstallmentOverdue } from '@/src/lib/businessRules';
import {
  MonthlyReceivablesForecastItem,
  OpenReceivablesSummary,
} from '@/src/domain/receivables/contracts/receivablesContracts';
import {
  MonthReference,
  addMonthsToReference,
  getCurrentMonthReference,
} from '@/src/domain/receivables/utils/monthReference';

function getRemainingAmount(installment: { amount?: number | null; amount_paid?: number | null }) {
  const total = installment.amount || 0;
  const paid = installment.amount_paid || 0;
  return Math.max(0, total - paid);
}

export async function getOpenReceivablesSummary(): Promise<OpenReceivablesSummary> {
  const currentMonth = getCurrentMonthReference();

  const { data: openInstallments, error } = await supabase
    .from('installments')
    .select('id, amount, amount_paid, status, due_date')
    .not('status', 'in', '("paid","cancelled")');

  if (error) {
    throw error;
  }

  const installments = openInstallments || [];

  const overdueInstallments = installments.filter(isInstallmentOverdue);

  const totalOpenAmount = installments.reduce((sum, installment) => {
    return sum + getRemainingAmount(installment);
  }, 0);

  const totalOverdueAmount = overdueInstallments.reduce((sum, installment) => {
    return sum + getRemainingAmount(installment);
  }, 0);

  const totalToReceiveThisMonth = installments
    .filter((installment) => {
      const dueDate = installment.due_date;
      return dueDate >= currentMonth.startDate && dueDate <= currentMonth.endDate;
    })
    .reduce((sum, installment) => {
      return sum + getRemainingAmount(installment);
    }, 0);

  const { data: paidThisMonth, error: paidThisMonthError } = await supabase
    .from('installments')
    .select('amount_paid')
    .eq('status', 'paid')
    .gte('payment_date', currentMonth.startDate)
    .lte('payment_date', currentMonth.endDate);

  if (paidThisMonthError) {
    throw paidThisMonthError;
  }

  const totalReceivedThisMonth = (paidThisMonth || []).reduce((sum, installment) => {
    return sum + (installment.amount_paid || 0);
  }, 0);

  return {
    totalOpenAmount,
    totalOverdueAmount,
    totalToReceiveThisMonth,
    totalReceivedThisMonth,
    overdueInstallmentCount: overdueInstallments.length,
    openInstallmentCount: installments.length,
  };
}

export async function getMonthlyReceivablesForecastItem(
  monthReference: MonthReference
): Promise<MonthlyReceivablesForecastItem> {
  const { data, error } = await supabase
    .from('installments')
    .select('id, amount, amount_paid, status, due_date, treatment_id, treatments(patient_id)')
    .gte('due_date', monthReference.startDate)
    .lte('due_date', monthReference.endDate)
    .neq('status', 'cancelled');

  if (error) {
    throw error;
  }

  const installments = data || [];

  const totalExpectedAmount = installments.reduce((sum, installment) => {
    return sum + (installment.amount || 0);
  }, 0);

  const totalOpenAmount = installments
    .filter((installment) => installment.status !== 'paid')
    .reduce((sum, installment) => {
      return sum + getRemainingAmount(installment);
    }, 0);

  const totalReceivedAmount = installments.reduce((sum, installment) => {
    return sum + (installment.amount_paid || 0);
  }, 0);

  const overdueInstallments = installments.filter(
    (installment) => installment.status !== 'paid' && isInstallmentOverdue(installment)
  );

  const totalOverdueAmount = overdueInstallments.reduce((sum, installment) => {
    return sum + getRemainingAmount(installment);
  }, 0);

  const patientIds = new Set(
    installments
      .map((installment: any) => installment.treatments?.patient_id)
      .filter(Boolean)
  );

  return {
    year: monthReference.year,
    month: monthReference.month,
    reference: monthReference.reference,
    totalExpectedAmount,
    totalOpenAmount,
    totalReceivedAmount,
    totalOverdueAmount,
    installmentCount: installments.length,
    patientCount: patientIds.size,
  };
}

export async function getReceivablesForecastRange(monthsForward = 2) {
  const current = getCurrentMonthReference();
  const safeMonthsForward = Math.max(0, Math.floor(monthsForward));

  const references = Array.from({ length: safeMonthsForward + 1 }, (_, index) =>
    addMonthsToReference(current, index)
  );

  return Promise.all(references.map((reference) => getMonthlyReceivablesForecastItem(reference)));
}