import { supabase } from '@/src/lib/supabase';
import { getCollectionsSummary } from '@/src/lib/financialMetrics';
import {
  CollectionOperationalSummary,
  CollectionQueueItem,
  CollectionTaskStatus,
} from '@/src/domain/collections/contracts/collectionsContracts';

interface CollectionTaskRow {
  id: string;
  patient_id: string;
  treatment_id?: string | null;
  installment_id?: string | null;
  task_type: CollectionQueueItem['type'];
  status: CollectionTaskStatus;
  title: string;
  description?: string | null;
  due_date: string;
  scheduled_for: string;
  amount?: number | null;
  days_offset?: number | null;
}

interface PatientNameRow {
  id: string;
  full_name: string;
}

async function loadPatientNameMap(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, string>();
  }

  const uniquePatientIds = Array.from(new Set(patientIds));

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name')
    .in('id', uniquePatientIds);

  if (error) {
    throw error;
  }

  return new Map((data as PatientNameRow[]).map((patient) => [patient.id, patient.full_name]));
}

/**
 * Resumo operacional ainda baseado na leitura financeira consolidada.
 * Mantemos essa fonte nesta fase para evitar dupla contagem por existir mais de uma tarefa por parcela.
 */
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
 * Lê tarefas reais de cobrança a partir da tabela collection_tasks.
 */
export async function getCollectionTaskQueue(
  status: CollectionTaskStatus = 'pending'
): Promise<CollectionQueueItem[]> {
  const { data, error } = await supabase
    .from('collection_tasks')
    .select(
      `
        id,
        patient_id,
        treatment_id,
        installment_id,
        task_type,
        status,
        title,
        description,
        due_date,
        scheduled_for,
        amount,
        days_offset
      `
    )
    .eq('status', status)
    .order('scheduled_for', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    throw error;
  }

  const tasks = (data || []) as CollectionTaskRow[];
  const patientNameMap = await loadPatientNameMap(tasks.map((task) => task.patient_id));

  return tasks.map((task) => ({
    id: task.id,
    patientId: task.patient_id,
    patientName: patientNameMap.get(task.patient_id) || 'Paciente',
    treatmentId: task.treatment_id || null,
    installmentId: task.installment_id || null,
    type: task.task_type,
    status: task.status,
    title: task.title,
    description: task.description || '',
    dueDate: task.due_date,
    scheduledFor: task.scheduled_for,
    amount: task.amount ?? undefined,
    daysOffset: task.days_offset ?? undefined,
  }));
}

/**
 * Fila operacional compatível com a etapa anterior.
 * Agora prioriza tarefas reais; se ainda não houver tarefas geradas, cai no fallback antigo.
 */
export async function getProvisionalCollectionQueue(): Promise<CollectionQueueItem[]> {
  const realTasks = await getCollectionTaskQueue('pending');

  if (realTasks.length > 0) {
    return realTasks;
  }

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