export type CollectionTaskType =
  | 'pre_due_reminder'
  | 'due_today_reminder'
  | 'post_due_followup'
  | 'manual_call';

export type CollectionTaskStatus =
  | 'pending'
  | 'completed'
  | 'dismissed';

export interface CollectionQueueItem {
  id: string;
  patientId: string;
  patientName: string;
  treatmentId?: string | null;
  installmentId?: string | null;
  type: CollectionTaskType;
  status: CollectionTaskStatus;
  title: string;
  description: string;
  dueDate: string;
  scheduledFor: string;
  amount?: number;
  daysOffset?: number;
}

export interface CollectionOperationalSummary {
  pendingTasksCount: number;
  overduePatientsCount: number;
  overdueInstallmentsCount: number;
  totalOverdueAmount: number;
}