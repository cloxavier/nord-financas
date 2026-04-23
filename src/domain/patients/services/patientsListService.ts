
import { supabase } from '@/src/lib/supabase';
import { digitsOnly, getPatientPhoneDisplay } from '@/src/lib/utils';

export interface PatientListRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  cpf: string | null;
  created_at: string;
  isActive: boolean;
}

export interface PatientsListParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  onlyActive: boolean;
}

export interface PatientsListResult {
  rows: PatientListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function normalizeSearchTerm(value: string) {
  return value.trim();
}

async function loadAllActivePatientIds(): Promise<Set<string>> {
  const activePatientIds = new Set<string>();

  const { data: activeTreatments, error: activeTreatmentsError } = await supabase
    .from('treatments')
    .select('patient_id')
    .in('status', ['pending', 'in_progress']);

  if (activeTreatmentsError) throw activeTreatmentsError;

  (activeTreatments || []).forEach((item: any) => {
    if (item?.patient_id) activePatientIds.add(item.patient_id);
  });

  const { data: openInstallments, error: openInstallmentsError } = await supabase
    .from('installments')
    .select('treatment_id')
    .not('status', 'in', '("paid","cancelled")');

  if (openInstallmentsError) throw openInstallmentsError;

  const treatmentIds = Array.from(
    new Set(
      (openInstallments || [])
        .map((item: any) => item?.treatment_id)
        .filter((id: string | null | undefined): id is string => !!id)
    )
  );

  if (treatmentIds.length > 0) {
    const { data: treatmentsByOpenInstallments, error: treatmentsByOpenInstallmentsError } =
      await supabase.from('treatments').select('id, patient_id').in('id', treatmentIds);

    if (treatmentsByOpenInstallmentsError) throw treatmentsByOpenInstallmentsError;

    (treatmentsByOpenInstallments || []).forEach((item: any) => {
      if (item?.patient_id) activePatientIds.add(item.patient_id);
    });
  }

  return activePatientIds;
}

async function loadActivePatientIdsForPage(patientIds: string[]): Promise<Set<string>> {
  const activePatientIds = new Set<string>();
  if (patientIds.length === 0) return activePatientIds;

  const uniquePatientIds = Array.from(new Set(patientIds));

  const { data: treatments, error: treatmentsError } = await supabase
    .from('treatments')
    .select('id, patient_id, status')
    .in('patient_id', uniquePatientIds);

  if (treatmentsError) throw treatmentsError;

  const treatmentPatientMap = new Map<string, string>();

  (treatments || []).forEach((item: any) => {
    if (item?.id && item?.patient_id) treatmentPatientMap.set(item.id, item.patient_id);
    if (item?.patient_id && ['pending', 'in_progress'].includes(item.status)) {
      activePatientIds.add(item.patient_id);
    }
  });

  const treatmentIds = Array.from(treatmentPatientMap.keys());
  if (treatmentIds.length > 0) {
    const { data: openInstallments, error: openInstallmentsError } = await supabase
      .from('installments')
      .select('treatment_id')
      .in('treatment_id', treatmentIds)
      .not('status', 'in', '("paid","cancelled")');

    if (openInstallmentsError) throw openInstallmentsError;

    (openInstallments || []).forEach((item: any) => {
      const patientId = treatmentPatientMap.get(item?.treatment_id || '');
      if (patientId) activePatientIds.add(patientId);
    });
  }

  return activePatientIds;
}

function buildPatientSearchFilter(searchTerm: string) {
  const digits = digitsOnly(searchTerm);
  if (digits) {
    return `full_name.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,phone.ilike.%${digits}%,email.ilike.%${searchTerm}%`;
  }
  return `full_name.ilike.%${searchTerm}%,cpf.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`;
}

export async function getPatientsListData(params: PatientsListParams): Promise<PatientsListResult> {
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(params.pageSize || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const searchTerm = normalizeSearchTerm(params.searchTerm);

  let activePatientIds: Set<string> | null = null;
  if (params.onlyActive) {
    activePatientIds = await loadAllActivePatientIds();
    if (activePatientIds.size === 0) {
      return { rows: [], totalCount: 0, page, pageSize, totalPages: 0 };
    }
  }

  let query = supabase
    .from('patients')
    .select(
      'id, full_name, phone, phone_country_code, phone_area_code, phone_number, email, cpf, created_at',
      { count: 'exact' }
    )
    .order('full_name', { ascending: true });

  if (searchTerm) query = query.or(buildPatientSearchFilter(searchTerm));
  if (activePatientIds) query = query.in('id', Array.from(activePatientIds));

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const safePatients = data || [];
  const pageActivePatientIds = activePatientIds
    ? activePatientIds
    : await loadActivePatientIdsForPage(safePatients.map((patient: any) => patient.id));

  const rows: PatientListRow[] = safePatients.map((patient: any) => ({
    id: patient.id,
    full_name: patient.full_name,
    phone: getPatientPhoneDisplay(patient) || null,
    email: patient.email || null,
    cpf: patient.cpf || null,
    created_at: patient.created_at,
    isActive: pageActivePatientIds.has(patient.id),
  }));

  const totalCount = count || 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  return { rows, totalCount, page, pageSize, totalPages };
}
