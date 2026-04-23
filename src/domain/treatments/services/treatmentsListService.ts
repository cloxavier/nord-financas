import { supabase } from '@/src/lib/supabase';
import { resolvePatientName } from '@/src/lib/businessRules';

export type TreatmentListFilter =
  | 'all'
  | 'draft'
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

export interface TreatmentListRow {
  id: string;
  patient_id: string | null;
  patientName: string;
  status: string;
  subtotal: number;
  total_amount: number;
  created_at: string;
}

export interface TreatmentsListParams {
  page: number;
  pageSize: number;
  searchTerm: string;
  statusFilter: TreatmentListFilter;
}

export interface TreatmentsListResult {
  rows: TreatmentListRow[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function isUuidLike(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

async function resolvePatientIdsBySearchTerm(searchTerm: string) {
  const term = searchTerm.trim();
  if (!term) return null;

  const { data, error } = await supabase
    .from('patients')
    .select('id')
    .or(`full_name.ilike.%${term}%,phone.ilike.%${term}%`)
    .limit(200);

  if (error) throw error;

  return (data || []).map((item: any) => item.id).filter(Boolean);
}

export async function getTreatmentsListData(
  params: TreatmentsListParams
): Promise<TreatmentsListResult> {
  const page = Math.max(1, Math.floor(params.page || 1));
  const pageSize = Math.max(1, Math.min(100, Math.floor(params.pageSize || 25)));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const term = params.searchTerm.trim();

  let query = supabase
    .from('treatments')
    .select('*, patients(id, full_name)', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (params.statusFilter !== 'all') {
    query = query.eq('status', params.statusFilter);
  }

  if (term) {
    if (isUuidLike(term)) {
      query = query.eq('id', term);
    } else {
      const patientIds = await resolvePatientIdsBySearchTerm(term);

      if (patientIds && patientIds.length > 0) {
        query = query.or(
          `patient_name_snapshot.ilike.%${term}%,id.eq.${term},patient_id.in.(${patientIds.join(',')})`
        );
      } else {
        query = query.ilike('patient_name_snapshot', `%${term}%`);
      }
    }
  }

  const { data, error, count } = await query.range(from, to);

  if (error) throw error;

  const rows: TreatmentListRow[] = (data || []).map((item: any) => ({
    id: item.id,
    patient_id: item.patient_id || null,
    patientName: resolvePatientName(item),
    status: item.status,
    subtotal: Number(item.subtotal || 0),
    total_amount: Number(item.total_amount || 0),
    created_at: item.created_at,
  }));

  const totalCount = count || 0;
  const totalPages = totalCount > 0 ? Math.ceil(totalCount / pageSize) : 0;

  return {
    rows,
    totalCount,
    page,
    pageSize,
    totalPages,
  };
}
