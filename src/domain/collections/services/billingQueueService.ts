import { supabase } from '@/src/lib/supabase';
import { getNotificationSettings } from '@/src/lib/appSettings';
import { isInstallmentOverdue } from '@/src/lib/businessRules';
import { getCollectionsSummary } from '@/src/lib/financialMetrics';
import {
  CollectionQueueItem,
  CollectionOperationalSummary,
} from '@/src/domain/collections/contracts/collectionsContracts';
import {
  getCollectionOperationalSummary,
  getCollectionTaskQueue,
} from '@/src/domain/collections/services/collectionsReadService';

export type BillingQueueFilter = 'overdue' | 'pending';

export interface BillingQueueRow {
  /**
   * Identificador visual da linha.
   * - overdue: usa o id da parcela
   * - pending: usa o id da tarefa operacional
   */
  id: string;

  /**
   * Define se a linha representa uma parcela real
   * ou uma tarefa operacional da fila.
   */
  sourceType: 'installment' | 'task';

  /**
   * Id da tarefa operacional, quando existir.
   * Na aba "Em Atraso", as linhas passam a ser parcelas reais,
   * então normalmente taskId será null.
   */
  taskId: string | null;

  patientId: string;
  patientName: string;
  patientPhone: string;

  treatmentId?: string | null;
  installmentId?: string | null;
  installmentNumber?: number | null;

  taskType?: CollectionQueueItem['type'] | null;
  taskTitle: string;
  taskDescription: string;

  dueDate: string;
  scheduledFor: string;
  amount: number;
  isOverdue: boolean;
}

function toDateOnlyLocal(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysToDateOnly(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12, 0, 0, 0);
  date.setDate(date.getDate() + days);

  const shiftedYear = date.getFullYear();
  const shiftedMonth = String(date.getMonth() + 1).padStart(2, '0');
  const shiftedDay = String(date.getDate()).padStart(2, '0');

  return `${shiftedYear}-${shiftedMonth}-${shiftedDay}`;
}

async function loadPatientPhoneMap(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, string>();
  }

  const uniquePatientIds = Array.from(new Set(patientIds));

  const { data, error } = await supabase
    .from('patients')
    .select('id, phone')
    .in('id', uniquePatientIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((patient: any) => [patient.id, patient.phone || '-']));
}

async function loadPatientDirectory(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, { name: string; phone: string }>();
  }

  const uniquePatientIds = Array.from(new Set(patientIds));

  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone')
    .in('id', uniquePatientIds);

  if (error) {
    throw error;
  }

  return new Map(
    (data || []).map((patient: any) => [
      patient.id,
      {
        name: patient.full_name || 'Paciente sem nome',
        phone: patient.phone || '-',
      },
    ])
  );
}

async function loadTreatmentPatientMap(treatmentIds: string[]) {
  if (treatmentIds.length === 0) {
    return new Map<string, string>();
  }

  const uniqueTreatmentIds = Array.from(new Set(treatmentIds));

  const { data, error } = await supabase
    .from('treatments')
    .select('id, patient_id')
    .in('id', uniqueTreatmentIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((treatment: any) => [treatment.id, treatment.patient_id]));
}

/**
 * Monta as linhas da aba "Em Atraso" a partir da fonte canônica:
 * parcelas reais em atraso.
 *
 * Isso garante alinhamento com:
 * - Dashboard
 * - Relatório de inadimplência
 * - Tela de Parcelas
 */
async function loadOverdueInstallmentRows(): Promise<BillingQueueRow[]> {
  const { data: installments, error } = await supabase
    .from('installments')
    .select(
      'id, treatment_id, installment_number, due_date, amount, amount_paid, status'
    )
    .not('status', 'in', '("paid","cancelled")')
    .order('due_date', { ascending: true })
    .order('installment_number', { ascending: true });

  if (error) {
    throw error;
  }

  const overdueInstallments = (installments || []).filter(isInstallmentOverdue);

  const treatmentIds = overdueInstallments
    .map((installment: any) => installment.treatment_id)
    .filter((id): id is string => !!id);

  const treatmentPatientMap = await loadTreatmentPatientMap(treatmentIds);

  const patientIds = overdueInstallments
    .map((installment: any) => treatmentPatientMap.get(installment.treatment_id))
    .filter((id): id is string => !!id);

  const patientDirectory = await loadPatientDirectory(patientIds);

  return overdueInstallments.map((installment: any) => {
    const patientId = treatmentPatientMap.get(installment.treatment_id) || '';
    const patient = patientDirectory.get(patientId) || {
      name: 'Paciente não encontrado',
      phone: '-',
    };

    const openAmount = Math.max(
      0,
      (installment.amount || 0) - (installment.amount_paid || 0)
    );

    return {
      id: installment.id,
      sourceType: 'installment',
      taskId: null,
      patientId,
      patientName: patient.name,
      patientPhone: patient.phone,
      treatmentId: installment.treatment_id || null,
      installmentId: installment.id,
      installmentNumber: installment.installment_number ?? null,
      taskType: null,
      taskTitle: `Parcela ${installment.installment_number ?? '-'}`,
      taskDescription: 'Parcela real em atraso',
      dueDate: installment.due_date,
      scheduledFor: installment.due_date,
      amount: openAmount,
      isOverdue: true,
    };
  });
}

/**
 * Monta as linhas da aba "Próximos Vencimentos" a partir da fila operacional real.
 */
function normalizePendingTaskRows(
  tasks: CollectionQueueItem[],
  patientPhoneMap: Map<string, string>,
  dueAlertDays: number
): BillingQueueRow[] {
  const today = toDateOnlyLocal();
  const upcomingLimit = addDaysToDateOnly(today, Math.max(0, dueAlertDays));

  return tasks
    .filter((task) => {
      const isUpcomingTask =
        task.type === 'pre_due_reminder' || task.type === 'due_today_reminder';

      return (
        isUpcomingTask &&
        task.dueDate >= today &&
        task.scheduledFor <= upcomingLimit
      );
    })
    .map((task) => ({
      id: task.id,
      sourceType: 'task',
      taskId: task.id,
      patientId: task.patientId,
      patientName: task.patientName,
      patientPhone: patientPhoneMap.get(task.patientId) || '-',
      treatmentId: task.treatmentId || null,
      installmentId: task.installmentId || null,
      installmentNumber: null,
      taskType: task.type,
      taskTitle: task.title,
      taskDescription: task.description,
      dueDate: task.dueDate,
      scheduledFor: task.scheduledFor,
      amount: task.amount || 0,
      isOverdue: false,
    }));
}

function buildBillingSummary(
  overdueSummary: Awaited<ReturnType<typeof getCollectionsSummary>>,
  operationalSummary: CollectionOperationalSummary
): CollectionOperationalSummary {
  return {
    pendingTasksCount: operationalSummary.pendingTasksCount,
    overduePatientsCount: overdueSummary.debtorPatientsCount,
    overdueInstallmentsCount: overdueSummary.overdueInstallmentsCount,
    totalOverdueAmount: overdueSummary.totalOverdueAmount,
  };
}

export async function getBillingQueueData(
  filter: BillingQueueFilter
): Promise<{
  rows: BillingQueueRow[];
  summary: CollectionOperationalSummary;
}> {
  const [overdueSummary, operationalSummary, notificationSettings] = await Promise.all([
    getCollectionsSummary(),
    getCollectionOperationalSummary(),
    getNotificationSettings(),
  ]);

  const dueAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));

  /**
   * A aba "Em Atraso" usa parcelas reais.
   * A aba "Próximos Vencimentos" usa a fila operacional real.
   */
  if (filter === 'overdue') {
    const rows = await loadOverdueInstallmentRows();

    return {
      rows,
      summary: buildBillingSummary(overdueSummary, operationalSummary),
    };
  }

  const tasks = await getCollectionTaskQueue('pending');
  const patientPhoneMap = await loadPatientPhoneMap(tasks.map((task) => task.patientId));
  const rows = normalizePendingTaskRows(tasks, patientPhoneMap, dueAlertDays);

  return {
    rows,
    summary: buildBillingSummary(overdueSummary, operationalSummary),
  };
}