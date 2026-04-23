
import { supabase } from '@/src/lib/supabase';
import {
  getInstallmentEffectiveStatus,
  getInstallmentEffectiveStatusLabel,
  getInstallmentOutstandingAmount,
  isInstallmentOverdue,
  resolvePatientName,
} from '@/src/lib/businessRules';
import { digitsOnly } from '@/src/lib/utils';

export type InstallmentListFilter = 'all' | 'pending' | 'paid' | 'overdue';

export interface InstallmentListRow {
  id: string;
  treatment_id: string | null;
  due_date: string;
  installment_number: number | null;
  amount: number;
  amount_paid: number;
  payment_date: string | null;
  payment_method_used: string | null;
  status: string;
  effectiveStatus: 'pending' | 'paid' | 'overdue';
  effectiveStatusLabel: string;
  patientName: string;
  outstandingAmount: number;
  actualReceivedAmount: number;
}

export interface InstallmentListSummary {
  overdueAmount: number;
  overdueCount: number;
  pendingAmount: number;
  pendingCount: number;
  paidAmount: number;
  paidCount: number;
}

export interface InstallmentListResult {
  rows: InstallmentListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  summary: InstallmentListSummary;
}

export interface InstallmentListParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  statusFilter: InstallmentListFilter;
}

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function getTodayDateOnly() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  const day = String(today.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.trim());
}

function buildPatientSearchFilter(term: string) {
  const digits = digitsOnly(term);
  if (digits) return `full_name.ilike.%${term}%,phone.ilike.%${digits}%`;
  return `full_name.ilike.%${term}%`;
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

function normalizeInstallmentRow(item: any): InstallmentListRow {
  const effectiveStatus = getInstallmentEffectiveStatus(item);
  const outstandingAmount = roundMoney(getInstallmentOutstandingAmount(item));
  const actualReceivedAmount = roundMoney(Number(item.amount_paid || item.amount || 0));

  return {
    ...item,
    amount: Number(item.amount || 0),
    amount_paid: Number(item.amount_paid || 0),
    effectiveStatus,
    effectiveStatusLabel: getInstallmentEffectiveStatusLabel(item),
    patientName: resolvePatientName(item),
    outstandingAmount,
    actualReceivedAmount,
  };
}

async function getInstallmentListSummary(): Promise<InstallmentListSummary> {
  const [{ data: paidInstallments, error: paidError }, { data: openInstallments, error: openError }] =
    await Promise.all([
      supabase.from('installments').select('amount_paid').eq('status', 'paid'),
      supabase
        .from('installments')
        .select('amount, amount_paid, due_date, status')
        .not('status', 'in', '("paid","cancelled")'),
    ]);

  if (paidError) throw paidError;
  if (openError) throw openError;

  const safeOpenInstallments = openInstallments || [];
  const overdueInstallments = safeOpenInstallments.filter(isInstallmentOverdue);
  const pendingInstallments = safeOpenInstallments.filter((item: any) => !isInstallmentOverdue(item));

  return {
    overdueAmount: roundMoney(overdueInstallments.reduce((sum: number, item: any) => sum + Number(getInstallmentOutstandingAmount(item) || 0), 0)),
    overdueCount: overdueInstallments.length,
    pendingAmount: roundMoney(pendingInstallments.reduce((sum: number, item: any) => sum + Number(getInstallmentOutstandingAmount(item) || 0), 0)),
    pendingCount: pendingInstallments.length,
    paidAmount: roundMoney((paidInstallments || []).reduce((sum: number, item: any) => sum + Number(item.amount_paid || 0), 0)),
    paidCount: paidInstallments?.length || 0,
  };
}

export async function getInstallmentsListData(params: InstallmentListParams): Promise<InstallmentListResult> {
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(params.pageSize || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const today = getTodayDateOnly();

  const treatmentIds = await resolveTreatmentIdsBySearchTerm(params.searchTerm);
  const summary = await getInstallmentListSummary();

  if (treatmentIds && treatmentIds.length === 0) {
    return { rows: [], totalCount: 0, page, pageSize, totalPages: 0, summary };
  }

  let query = supabase
    .from('installments')
    .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name))', { count: 'exact' })
    .neq('status', 'cancelled');

  if (params.statusFilter === 'paid') {
    query = query.eq('status', 'paid');
  } else if (params.statusFilter === 'overdue') {
    query = query.not('status', 'in', '("paid","cancelled")').lt('due_date', today);
  } else if (params.statusFilter === 'pending') {
    query = query.not('status', 'in', '("paid","cancelled")').gte('due_date', today);
  }

  if (treatmentIds && treatmentIds.length > 0) {
    query = query.in('treatment_id', treatmentIds);
  }

  const { data, error, count } = await query
    .order('due_date', { ascending: true })
    .order('installment_number', { ascending: true })
    .range(from, to);

  if (error) throw error;

  const rows = (data || []).map(normalizeInstallmentRow);
  const totalCount = count || 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  return { rows, totalCount, page, pageSize, totalPages, summary };
}
