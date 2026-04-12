/**
 * Camada de acesso a dados financeiros centralizada.
 * Todas as consultas de métricas e estados financeiros devem ser feitas através deste arquivo.
 */

import { supabase } from './supabase';
import { isInstallmentOverdue } from './businessRules';
import { parseDateOnlyAsLocalDate } from './utils';

/**
 * Calcula a diferença em dias entre hoje e a data de vencimento.
 * Retorna:
 * - 0 para hoje
 * - positivo para datas futuras
 * - negativo para datas passadas
 */
function getInstallmentDayOffset(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = parseDateOnlyAsLocalDate(dueDateStr);
  if (!dueDate) return 0;

  dueDate.setHours(0, 0, 0, 0);

  const diffMs = dueDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Busca as métricas do Dashboard de forma centralizada.
 * Agora aceita "alertDays" para calcular vencimentos próximos
 * com base nas preferências salvas em Notificações.
 */
export async function getDashboardMetrics(alertDays = 3) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const safeAlertDays = Number.isFinite(alertDays) && alertDays >= 0 ? alertDays : 3;

  const [
    { count: patientCount },
    { count: activeTreatmentsCount },
    { data: monthlyRevenue },
    { data: installments },
    { count: pendingTreatmentsCount },
  ] = await Promise.all([
    // 1. Total de Pacientes
    supabase.from('patients').select('*', { count: 'exact', head: true }),

    // 2. Tratamentos Ativos
    // Regra de negócio:
    // - ativo = somente tratamento realmente em andamento
    // - pendente fica separado no lembrete "aguardando aprovação"
    // - rascunho não entra em nenhum dos dois
    supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress'),

    // 3. Receita Mensal
    supabase
      .from('installments')
      .select('amount_paid')
      .eq('status', 'paid')
      .gte('payment_date', startOfMonth.toISOString().split('T')[0])
      .lte('payment_date', endOfMonth.toISOString().split('T')[0]),

    // 4. Parcelas não pagas/canceladas para cálculos de cobrança
    supabase
      .from('installments')
      .select('id, amount, amount_paid, status, due_date')
      .not('status', 'in', '("paid","cancelled")'),

    // 5. Tratamentos pendentes
    supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  const pendingInstallments = installments || [];

  const overdueInstallments = pendingInstallments.filter(isInstallmentOverdue);

  /**
   * Parcela "próxima do vencimento" nesta fase significa:
   * - não está em atraso
   * - vence hoje ou nos próximos X dias
   */
  const dueWithinAlertDaysCount = pendingInstallments.filter((installment) => {
    if (isInstallmentOverdue(installment)) return false;

    const dayOffset = getInstallmentDayOffset(installment.due_date);
    return dayOffset >= 0 && dayOffset <= safeAlertDays;
  }).length;

  const dueTodayCount = pendingInstallments.filter((installment) => {
    const dayOffset = getInstallmentDayOffset(installment.due_date);
    return !isInstallmentOverdue(installment) && dayOffset === 0;
  }).length;

  const totalMonthlyRevenue =
    monthlyRevenue?.reduce((sum, item) => sum + (item.amount_paid || 0), 0) || 0;

  return {
    patientCount: patientCount || 0,
    activeTreatmentsCount: activeTreatmentsCount || 0,
    monthlyRevenue: totalMonthlyRevenue,
    overdueCount: overdueInstallments.length,
    dueTodayCount,
    dueWithinAlertDaysCount,
    alertDays: safeAlertDays,
    pendingTreatmentsCount: pendingTreatmentsCount || 0,
  };
}

/**
 * Busca o resumo de cobranças de forma centralizada.
 */
export async function getCollectionsSummary() {
  const { data: installments, error } = await supabase
    .from('installments')
    .select('id, amount, amount_paid, status, due_date, treatment_id, treatments(patient_id)')
    .not('status', 'in', '("paid","cancelled")');

  if (error) throw error;

  const overdueInstallments = (installments || []).filter(isInstallmentOverdue);

  const totalOverdueAmount = overdueInstallments.reduce((sum, i) => {
    const remaining = (i.amount || 0) - (i.amount_paid || 0);
    return sum + remaining;
  }, 0);

  const debtorPatientsCount = new Set(
    overdueInstallments.map((i: any) => (i.treatments as any)?.patient_id || i.patient_id)
  ).size;

  return {
    totalOverdueAmount,
    overdueInstallmentsCount: overdueInstallments.length,
    debtorPatientsCount,
    overdueInstallments,
  };
}

/**
 * Busca o resumo financeiro de um paciente.
 */
export async function getPatientFinancialSummary(patientId: string) {
  const { data: treatments, error } = await supabase
    .from('treatments')
    .select('*, installments(*)')
    .eq('patient_id', patientId);

  if (error) throw error;

  let totalContracted = 0;
  let totalPaid = 0;
  let totalPending = 0;
  let overdueCount = 0;

  treatments?.forEach((t) => {
    totalContracted += t.total_amount || 0;
    const insts = t.installments || [];

    insts.forEach((i: any) => {
      totalPaid += i.amount_paid || 0;
      if (isInstallmentOverdue(i)) {
        overdueCount++;
      }
    });
  });

  totalPending = totalContracted - totalPaid;

  return {
    totalContracted,
    totalPaid,
    totalPending,
    overdueCount,
  };
}

/**
 * Busca o resumo financeiro de um tratamento.
 */
export async function getTreatmentFinancialSummary(treatmentId: string) {
  const [{ data: treatment }, { data: installments }] = await Promise.all([
    supabase.from('treatments').select('*').eq('id', treatmentId).single(),
    supabase.from('installments').select('*').eq('treatment_id', treatmentId),
  ]);

  if (!treatment) return null;

  const subtotal = treatment.subtotal || 0;
  const discount = treatment.discount_amount || 0;
  const total = treatment.total_amount || subtotal - discount;

  const paid = (installments || [])
    .filter((i) => i.status === 'paid')
    .reduce((sum, i) => sum + (i.amount_paid || i.amount), 0);

  const pending = total - paid;
  const overdue = (installments || []).filter(isInstallmentOverdue).length;

  return {
    subtotal,
    discount,
    total,
    paid,
    pending,
    overdue,
    isFullyPaid: pending <= 0,
    installmentsCount: installments?.length || 0,
    paidCount: (installments || []).filter((i) => i.status === 'paid').length,
  };
}