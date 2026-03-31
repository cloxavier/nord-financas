/**
 * Camada de acesso a dados financeiros centralizada.
 * Todas as consultas de métricas e estados financeiros devem ser feitas através deste arquivo.
 */

import { supabase } from './supabase';
import { isInstallmentOverdue, resolvePatientName } from './businessRules';

/**
 * Busca as métricas do Dashboard de forma centralizada.
 */
export async function getDashboardMetrics() {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [
    { count: patientCount },
    { count: activeTreatmentsCount },
    { data: monthlyRevenue },
    { data: installments },
    { count: pendingTreatmentsCount }
  ] = await Promise.all([
    // 1. Total de Pacientes
    supabase.from('patients').select('*', { count: 'exact', head: true }),
    // 2. Tratamentos Ativos
    supabase.from('treatments').select('*', { count: 'exact', head: true }).in('status', ['pending', 'in_progress']),
    // 3. Receita Mensal
    supabase.from('installments')
      .select('amount_paid')
      .eq('status', 'paid')
      .gte('payment_date', startOfMonth.toISOString().split('T')[0])
      .lte('payment_date', endOfMonth.toISOString().split('T')[0]),
    // 4. Todas as parcelas pendentes para cálculo de atraso (canonical)
    supabase.from('installments')
      .select('id, amount, amount_paid, status, due_date')
      .not('status', 'in', '("paid","cancelled")'),
    // 5. Tratamentos Pendentes
    supabase.from('treatments').select('*', { count: 'exact', head: true }).eq('status', 'pending')
  ]);

  // Aplica a regra canônica de atraso
  const overdueInstallments = (installments || []).filter(isInstallmentOverdue);
  const dueTodayCount = (installments || []).filter(i => i.due_date === today.toISOString().split('T')[0]).length;
  const totalMonthlyRevenue = monthlyRevenue?.reduce((sum, item) => sum + (item.amount_paid || 0), 0) || 0;

  return {
    patientCount: patientCount || 0,
    activeTreatmentsCount: activeTreatmentsCount || 0,
    monthlyRevenue: totalMonthlyRevenue,
    overdueCount: overdueInstallments.length,
    dueTodayCount,
    pendingTreatmentsCount: pendingTreatmentsCount || 0
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

  const debtorPatientsCount = new Set(overdueInstallments.map((i: any) => (i.treatments as any)?.patient_id || i.patient_id)).size;

  return {
    totalOverdueAmount,
    overdueInstallmentsCount: overdueInstallments.length,
    debtorPatientsCount,
    overdueInstallments
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

  treatments?.forEach(t => {
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
    overdueCount
  };
}

/**
 * Busca o resumo financeiro de um tratamento.
 */
export async function getTreatmentFinancialSummary(treatmentId: string) {
  const [
    { data: treatment },
    { data: installments }
  ] = await Promise.all([
    supabase.from('treatments').select('*').eq('id', treatmentId).single(),
    supabase.from('installments').select('*').eq('treatment_id', treatmentId)
  ]);

  if (!treatment) return null;

  const subtotal = treatment.subtotal || 0;
  const discount = treatment.discount_amount || 0;
  const total = treatment.total_amount || (subtotal - discount);
  
  const paid = (installments || [])
    .filter(i => i.status === 'paid')
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
    paidCount: (installments || []).filter(i => i.status === 'paid').length
  };
}
