import { getCollectionsSummary } from '@/src/lib/financialMetrics';
import {
  CollectionOperationalSummary,
  CollectionQueueItem,
} from '@/src/domain/collections/contracts/collectionsContracts';

export async function getCollectionOperationalSummary(): Promise<CollectionOperationalSummary> {
  const summary = await getCollectionsSummary();

  return {
    pendingTasksCount: summary.overdueInstallmentsCount,
    overduePatientsCount: summary.debtorPatientsCount,
    overdueInstallmentsCount: summary.overdueInstallmentsCount,
    totalOverdueAmount: summary.totalOverdueAmount,
  };
}

/**
 * Fila operacional provisória de cobrança.
 * Nesta fase, ainda não existe tabela própria de tarefas de cobrança.
 * Então a fila é derivada das parcelas em atraso.
 */
export async function getProvisionalCollectionQueue(): Promise<CollectionQueueItem[]> {
  const summary = await getCollectionsSummary();

  return (summary.overdueInstallments || []).map((installment: any) => ({
    id: `overdue-${installment.id}`,
    patientId: installment.treatments?.patient_id || installment.patient_id || 'unknown',
    patientName: installment.patient_name || 'Paciente com parcela em atraso',
    treatmentId: installment.treatment_id || null,
    installmentId: installment.id,
    type: 'post_due_followup',
    status: 'pending',
    title: 'Cobrança de parcela em atraso',
    description: 'Parcela vencida aguardando acompanhamento da equipe.',
    dueDate: installment.due_date,
    scheduledFor: installment.due_date,
    amount: Math.max(0, (installment.amount || 0) - (installment.amount_paid || 0)),
    daysOffset: 0,
  }));
}