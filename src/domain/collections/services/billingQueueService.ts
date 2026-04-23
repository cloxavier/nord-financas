
import { supabase } from '@/src/lib/supabase';
import { getNotificationSettings } from '@/src/lib/appSettings';
import { isInstallmentOverdue } from '@/src/lib/businessRules';
import { getCollectionsSummary } from '@/src/lib/financialMetrics';
import { digitsOnly, formatPhoneDisplay, getPhonePartsFromPatient } from '@/src/lib/utils';
import {
  CollectionQueueItem,
  CollectionOperationalSummary,
} from '@/src/domain/collections/contracts/collectionsContracts';
import { getCollectionOperationalSummary } from '@/src/domain/collections/services/collectionsReadService';

export type BillingQueueFilter = 'overdue' | 'pending';

export interface BillingQueueRow {
  id: string;
  sourceType: 'installment' | 'task';
  taskId: string | null;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientWhatsappPhone: string | null;
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

export interface BillingQueueDataResult {
  rows: BillingQueueRow[];
  summary: CollectionOperationalSummary;
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface BillingQueueParams {
  filter: BillingQueueFilter;
  page: number;
  pageSize: number;
  searchTerm: string;
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

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function buildPatientSearchFilter(value: string) {
  const digits = digitsOnly(value);
  if (digits) return `full_name.ilike.%${value}%,phone.ilike.%${digits}%`;
  return `full_name.ilike.%${value}%`;
}

function buildPatientPhonePayload(patient: any) {
  const parts = getPhonePartsFromPatient(patient);
  return {
    display: formatPhoneDisplay(parts) || '-',
    whatsapp: `${parts.countryCode}${parts.areaCode}${parts.number}` || null,
  };
}

async function loadPatientPhoneMap(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, { display: string; whatsapp: string | null }>();
  }

  const uniquePatientIds = Array.from(new Set(patientIds));
  const { data, error } = await supabase
    .from('patients')
    .select('id, phone, phone_country_code, phone_area_code, phone_number')
    .in('id', uniquePatientIds);

  if (error) throw error;

  return new Map((data || []).map((patient: any) => [patient.id, buildPatientPhonePayload(patient)]));
}

async function loadPatientDirectory(patientIds: string[]) {
  if (patientIds.length === 0) {
    return new Map<string, { name: string; phone: string; whatsapp: string | null }>();
  }

  const uniquePatientIds = Array.from(new Set(patientIds));
  const { data, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, phone_country_code, phone_area_code, phone_number')
    .in('id', uniquePatientIds);

  if (error) throw error;

  return new Map(
    (data || []).map((patient: any) => {
      const phonePayload = buildPatientPhonePayload(patient);
      return [
        patient.id,
        {
          name: patient.full_name || 'Paciente sem nome',
          phone: phonePayload.display,
          whatsapp: phonePayload.whatsapp,
        },
      ];
    })
  );
}

async function loadTreatmentPatientMap(treatmentIds: string[]) {
  if (treatmentIds.length === 0) return new Map<string, string>();

  const uniqueTreatmentIds = Array.from(new Set(treatmentIds));
  const { data, error } = await supabase
    .from('treatments')
    .select('id, patient_id')
    .in('id', uniqueTreatmentIds);
  if (error) throw error;

  return new Map((data || []).map((treatment: any) => [treatment.id, treatment.patient_id || '']));
}

async function resolveTreatmentIdsBySearchTerm(searchTerm: string) {
  const term = searchTerm.trim();
  if (!term) return null;

  const treatmentIds = new Set<string>();
  if (isUuidLike(term)) treatmentIds.add(term);

  const { data: treatmentsBySnapshot, error: treatmentsBySnapshotError } = await supabase
    .from('treatments')
    .select('id')
    .ilike('patient_name_snapshot', `%${term}%`)
    .limit(100);
  if (treatmentsBySnapshotError) throw treatmentsBySnapshotError;
  (treatmentsBySnapshot || []).forEach((item: any) => { if (item?.id) treatmentIds.add(item.id); });

  const { data: patients, error: patientsError } = await supabase
    .from('patients')
    .select('id')
    .or(buildPatientSearchFilter(term))
    .limit(100);
  if (patientsError) throw patientsError;

  const patientIds = (patients || []).map((item: any) => item.id).filter(Boolean);
  if (patientIds.length > 0) {
    const { data: treatmentsByPatient, error: treatmentsByPatientError } = await supabase
      .from('treatments')
      .select('id')
      .in('patient_id', patientIds)
      .limit(200);
    if (treatmentsByPatientError) throw treatmentsByPatientError;
    (treatmentsByPatient || []).forEach((item: any) => { if (item?.id) treatmentIds.add(item.id); });
  }

  return Array.from(treatmentIds);
}

async function resolvePatientIdsBySearchTerm(searchTerm: string) {
  const term = searchTerm.trim();
  if (!term) return null;

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .or(buildPatientSearchFilter(term))
    .limit(100);
  if (error) throw error;

  return (data || []).map((item: any) => item.id).filter(Boolean);
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

async function loadOverdueInstallmentRows(params: { page: number; pageSize: number; searchTerm: string; }) {
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(params.pageSize || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = toDateOnlyLocal();

  const treatmentIds = await resolveTreatmentIdsBySearchTerm(params.searchTerm);
  if (treatmentIds && treatmentIds.length === 0) return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };

  let query = supabase
    .from('installments')
    .select('id, treatment_id, installment_number, due_date, amount, amount_paid, status', { count: 'exact' })
    .not('status', 'in', '("paid","cancelled")')
    .lt('due_date', today);

  if (treatmentIds && treatmentIds.length > 0) query = query.in('treatment_id', treatmentIds);

  const { data: installments, error, count } = await query
    .order('due_date', { ascending: true })
    .order('installment_number', { ascending: true })
    .range(from, to);
  if (error) throw error;

  const safeInstallments = (installments || []).filter(isInstallmentOverdue);
  const treatmentIdsFromPage = safeInstallments.map((installment: any) => installment.treatment_id).filter((id): id is string => !!id);
  const treatmentPatientMap = await loadTreatmentPatientMap(treatmentIdsFromPage);
  const patientIds = safeInstallments.map((installment: any) => treatmentPatientMap.get(installment.treatment_id)).filter((id): id is string => !!id);
  const patientDirectory = await loadPatientDirectory(patientIds);

  const rows: BillingQueueRow[] = safeInstallments.map((installment: any) => {
    const patientId = treatmentPatientMap.get(installment.treatment_id) || '';
    const patient = patientDirectory.get(patientId) || { name: 'Paciente não encontrado', phone: '-', whatsapp: null };
    const openAmount = Math.max(0, (installment.amount || 0) - (installment.amount_paid || 0));

    return {
      id: installment.id,
      sourceType: 'installment',
      taskId: null,
      patientId,
      patientName: patient.name,
      patientPhone: patient.phone,
      patientWhatsappPhone: patient.whatsapp,
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

  const totalCount = count || 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  return { rows, totalCount, page, pageSize, totalPages };
}

async function loadPendingTaskRows(params: { page: number; pageSize: number; searchTerm: string; dueAlertDays: number; }) {
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(params.pageSize || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = toDateOnlyLocal();
  const upcomingLimit = addDaysToDateOnly(today, Math.max(0, params.dueAlertDays));

  const patientIds = await resolvePatientIdsBySearchTerm(params.searchTerm);
  const treatmentIds = await resolveTreatmentIdsBySearchTerm(params.searchTerm);
  const exactTreatmentId = isUuidLike(params.searchTerm.trim()) ? params.searchTerm.trim() : null;

  let query = supabase
    .from('collection_tasks')
    .select(`
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
      `, { count: 'exact' })
    .eq('status', 'pending')
    .in('task_type', ['pre_due_reminder', 'due_today_reminder'])
    .gte('due_date', today)
    .lte('scheduled_for', upcomingLimit);

  if (params.searchTerm.trim()) {
    if (patientIds && patientIds.length > 0) {
      query = query.in('patient_id', patientIds);
    } else if (exactTreatmentId) {
      query = query.eq('treatment_id', exactTreatmentId);
    } else if (treatmentIds && treatmentIds.length > 0) {
      query = query.in('treatment_id', treatmentIds);
    } else {
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  const { data: tasks, error, count } = await query
    .order('scheduled_for', { ascending: true })
    .order('created_at', { ascending: true })
    .range(from, to);
  if (error) throw error;

  const safeTasks = (tasks || []) as Array<any>;
  const patientPhoneMap = await loadPatientPhoneMap(safeTasks.map((task: any) => task.patient_id).filter(Boolean));
  const patientDirectory = await loadPatientDirectory(safeTasks.map((task: any) => task.patient_id).filter(Boolean));

  const rows: BillingQueueRow[] = safeTasks.map((task: any) => {
    const patient = patientDirectory.get(task.patient_id) || { name: 'Paciente', phone: '-', whatsapp: null };
    const phonePayload = patientPhoneMap.get(task.patient_id);

    return {
      id: task.id,
      sourceType: 'task',
      taskId: task.id,
      patientId: task.patient_id,
      patientName: patient.name,
      patientPhone: phonePayload?.display || patient.phone || '-',
      patientWhatsappPhone: phonePayload?.whatsapp || patient.whatsapp || null,
      treatmentId: task.treatment_id || null,
      installmentId: task.installment_id || null,
      installmentNumber: null,
      taskType: task.task_type,
      taskTitle: task.title,
      taskDescription: task.description || '',
      dueDate: task.due_date,
      scheduledFor: task.scheduled_for,
      amount: Number(task.amount || 0),
      isOverdue: false,
    };
  });

  const totalCount = count || 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;
  return { rows, totalCount, page, pageSize, totalPages };
}

export async function getBillingQueueData(params: BillingQueueParams): Promise<BillingQueueDataResult> {
  const [overdueSummary, operationalSummary, notificationSettings] = await Promise.all([
    getCollectionsSummary(),
    getCollectionOperationalSummary(),
    getNotificationSettings(),
  ]);

  const dueAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));
  const summary = buildBillingSummary(overdueSummary, operationalSummary);

  if (params.filter === 'overdue') {
    const result = await loadOverdueInstallmentRows({ page: params.page, pageSize: params.pageSize, searchTerm: params.searchTerm });
    return { ...result, summary };
  }

  const result = await loadPendingTaskRows({ page: params.page, pageSize: params.pageSize, searchTerm: params.searchTerm, dueAlertDays });
  return { ...result, summary };
}
