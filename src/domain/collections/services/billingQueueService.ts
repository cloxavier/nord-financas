import { supabase } from '@/src/lib/supabase';
import { getNotificationSettings } from '@/src/lib/appSettings';
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
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  treatmentId?: string | null;
  installmentId?: string | null;
  taskType: CollectionQueueItem['type'];
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

function normalizeBillingRows(
  tasks: CollectionQueueItem[],
  patientPhoneMap: Map<string, string>,
  filter: BillingQueueFilter,
  dueAlertDays: number
): BillingQueueRow[] {
  const today = toDateOnlyLocal();
  const upcomingLimit = addDaysToDateOnly(today, Math.max(0, dueAlertDays));

  return tasks
    .filter((task) => {
      if (filter === 'overdue') {
        const isOverdueTask =
          task.type === 'post_due_followup' || task.type === 'manual_call';

        return isOverdueTask && task.scheduledFor <= today;
      }

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
      patientId: task.patientId,
      patientName: task.patientName,
      patientPhone: patientPhoneMap.get(task.patientId) || '-',
      treatmentId: task.treatmentId || null,
      installmentId: task.installmentId || null,
      taskType: task.type,
      taskTitle: task.title,
      taskDescription: task.description,
      dueDate: task.dueDate,
      scheduledFor: task.scheduledFor,
      amount: task.amount || 0,
      isOverdue:
        task.type === 'post_due_followup' || task.type === 'manual_call',
    }));
}

export async function getBillingQueueData(
  filter: BillingQueueFilter
): Promise<{
  rows: BillingQueueRow[];
  summary: CollectionOperationalSummary;
}> {
  const [tasks, summary, notificationSettings] = await Promise.all([
    getCollectionTaskQueue('pending'),
    getCollectionOperationalSummary(),
    getNotificationSettings(),
  ]);

  const dueAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));
  const patientPhoneMap = await loadPatientPhoneMap(tasks.map((task) => task.patientId));
  const rows = normalizeBillingRows(tasks, patientPhoneMap, filter, dueAlertDays);

  return {
    rows,
    summary,
  };
}