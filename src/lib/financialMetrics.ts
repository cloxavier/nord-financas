/**
 * Camada de acesso a dados financeiros centralizada.
 * Todas as consultas de métricas e estados financeiros devem ser feitas através deste arquivo.
 *
 * Nesta etapa:
 * - mantemos as métricas já usadas pelo dashboard e cobranças
 * - adicionamos funções centralizadas para relatórios
 * - unificamos a base de dados consumida por:
 *   - ReportViewPage
 *   - ReportPrintPage
 * - adicionamos um resumo executivo enxuto para o dashboard
 */

import { supabase } from './supabase';
import {
  getInstallmentOutstandingAmount,
  isInstallmentOverdue,
  resolvePatientName,
} from './businessRules';
import { parseDateOnlyAsLocalDate } from './utils';

/**
 * Calcula a diferença em dias entre hoje e a data de vencimento.
 * Retorna:
 * - 0 para hoje
 * - positivo para datas futuras
 * - negativo para datas passadas
 */
function getInstallmentDayOffset(dueDateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const dueDate = parseDateOnlyAsLocalDate(dueDateStr);
  if (!dueDate) return 0;

  dueDate.setHours(0, 0, 0, 0);

  const diffMs = dueDate.getTime() - today.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

/**
 * Busca as métricas do Dashboard de forma centralizada.
 * Agora aceita "alertDays" para calcular vencimentos próximos
 * com base nas preferências salvas em Notificações.
 */
export async function getDashboardMetrics(alertDays = 3) {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const safeAlertDays = Number.isFinite(alertDays) && alertDays >= 0 ? alertDays : 3;

  const [
    { count: patientCount },
    { count: activeTreatmentsCount },
    { data: monthlyRevenue },
    { data: installments },
    { count: pendingTreatmentsCount },
  ] = await Promise.all([
    supabase.from('patients').select('*', { count: 'exact', head: true }),

    supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'in_progress'),

    supabase
      .from('installments')
      .select('amount_paid')
      .eq('status', 'paid')
      .gte('payment_date', startOfMonth.toISOString().split('T')[0])
      .lte('payment_date', endOfMonth.toISOString().split('T')[0]),

    supabase
      .from('installments')
      .select('id, amount, amount_paid, status, due_date')
      .not('status', 'in', '("paid","cancelled")'),

    supabase
      .from('treatments')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ]);

  const pendingInstallments = installments || [];

  const overdueInstallments = pendingInstallments.filter(isInstallmentOverdue);

  const dueWithinAlertDaysCount = pendingInstallments.filter((installment) => {
    if (isInstallmentOverdue(installment)) return false;

    const dayOffset = getInstallmentDayOffset(installment.due_date);
    return dayOffset >= 0 && dayOffset <= safeAlertDays;
  }).length;

  const dueTodayCount = pendingInstallments.filter((installment) => {
    const dayOffset = getInstallmentDayOffset(installment.due_date);
    return !isInstallmentOverdue(installment) && dayOffset === 0;
  }).length;

  const totalMonthlyRevenue =
    monthlyRevenue?.reduce((sum, item) => sum + (item.amount_paid || 0), 0) || 0;

  return {
    patientCount: patientCount || 0,
    activeTreatmentsCount: activeTreatmentsCount || 0,
    monthlyRevenue: totalMonthlyRevenue,
    overdueCount: overdueInstallments.length,
    dueTodayCount,
    dueWithinAlertDaysCount,
    alertDays: safeAlertDays,
    pendingTreatmentsCount: pendingTreatmentsCount || 0,
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

  const debtorPatientsCount = new Set(
    overdueInstallments.map((i: any) => (i.treatments as any)?.patient_id || i.patient_id)
  ).size;

  return {
    totalOverdueAmount,
    overdueInstallmentsCount: overdueInstallments.length,
    debtorPatientsCount,
    overdueInstallments,
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

  treatments?.forEach((t) => {
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
    overdueCount,
  };
}

/**
 * Busca o resumo financeiro de um tratamento.
 */
export async function getTreatmentFinancialSummary(treatmentId: string) {
  const [{ data: treatment }, { data: installments }] = await Promise.all([
    supabase.from('treatments').select('*').eq('id', treatmentId).single(),
    supabase.from('installments').select('*').eq('treatment_id', treatmentId),
  ]);

  if (!treatment) return null;

  const subtotal = treatment.subtotal || 0;
  const discount = treatment.discount_amount || 0;
  const total = treatment.total_amount || subtotal - discount;

  const paid = (installments || [])
    .filter((i) => i.status === 'paid')
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
    paidCount: (installments || []).filter((i) => i.status === 'paid').length,
  };
}

/* =========================================================
 * RELATÓRIOS
 * =======================================================*/

export type FinancialReportType =
  | 'financeiro-executivo'
  | 'fluxo-caixa'
  | 'inadimplencia'
  | 'procedimentos'
  | 'pacientes';

export interface ReportFilters {
  startDate: string;
  endDate: string;
}

export interface CashFlowChartPoint {
  rawDate: string;
  date: string;
  amount: number;
}

export interface CashFlowReportData {
  kind: 'fluxo-caixa';
  total: number;
  count: number;
  averageTicket: number;
  chartData: CashFlowChartPoint[];
  details: any[];
}

export interface OverdueReportData {
  kind: 'inadimplencia';
  total: number;
  count: number;
  details: any[];
}

export interface ProcedureProductionPoint {
  name: string;
  count: number;
  total: number;
}

export interface ProcedureProductionReportData {
  kind: 'procedimentos';
  total: number;
  count: number;
  chartData: ProcedureProductionPoint[];
  details: ProcedureProductionPoint[];
}

export interface PatientGrowthPoint {
  monthKey: string;
  monthLabel: string;
  newPatientsCount: number;
}

export interface PatientGrowthReportData {
  kind: 'pacientes';
  count: number;
  chartData: PatientGrowthPoint[];
  details: any[];
}

export interface ExecutiveMonthlyComparisonPoint {
  monthKey: string;
  monthLabel: string;
  scheduledAmount: number;
  receivedAmount: number;
  overdueAmount: number;
}

export interface ExecutiveForecastPoint {
  monthKey: string;
  monthLabel: string;
  openAmount: number;
}

export interface ExecutiveOverdueDetail {
  installmentId: string;
  treatmentId: string | null;
  patientName: string;
  dueDate: string;
  outstandingAmount: number;
  installmentNumber: number | null;
}

export interface ExecutiveFinancialReportData {
  kind: 'financeiro-executivo';
  summary: {
    receivedTotal: number;
    scheduledInPeriodTotal: number;
    overdueInPeriodTotal: number;
    overduePortfolioTotal: number;
    openPortfolioTotal: number;
    averageTicket: number;
    receivedCount: number;
    collectionRatePercent: number | null;
  };
  monthlyComparison: ExecutiveMonthlyComparisonPoint[];
  forecastNext12Months: ExecutiveForecastPoint[];
  topOverdueDetails: ExecutiveOverdueDetail[];
}

export interface DashboardExecutiveSummary {
  monthLabel: string;
  periodStart: string;
  periodEnd: string;
  receivedTotal: number;
  scheduledTotal: number;
  overdueInPeriodTotal: number;
  openPortfolioTotal: number;
  overduePortfolioTotal: number;
  averageTicket: number;
  receivedCount: number;
  collectionRatePercent: number | null;
  previousMonthLabel: string;
  receivedDeltaPercent: number | null;
  overdueDeltaPercent: number | null;
  collectionRateDeltaPercent: number | null;
  forecastPreview: ExecutiveForecastPoint[];
}

export type FinancialReportData =
  | CashFlowReportData
  | OverdueReportData
  | ProcedureProductionReportData
  | PatientGrowthReportData
  | ExecutiveFinancialReportData;

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function toDateOnlyInput(value: string | Date) {
  if (typeof value === 'string') {
    return value.split('T')[0];
  }

  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function parseSafeDate(dateStr: string) {
  const parsed = parseDateOnlyAsLocalDate(dateStr);
  if (parsed) return parsed;

  const fallback = new Date(dateStr);
  if (Number.isNaN(fallback.getTime())) {
    return new Date();
  }

  return fallback;
}

function getMonthKey(dateStr: string | Date) {
  const date = typeof dateStr === 'string' ? parseSafeDate(dateStr) : dateStr;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function getMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1, 12, 0, 0, 0);

  const formatted = new Intl.DateTimeFormat('pt-BR', {
    month: 'short',
    year: '2-digit',
    timeZone: 'America/Sao_Paulo',
  }).format(date);

  return formatted.replace('.', '');
}

function buildMonthKeysInRange(startDate: string, endDate: string) {
  const start = parseSafeDate(startDate);
  const end = parseSafeDate(endDate);

  const normalizedStart = new Date(start.getFullYear(), start.getMonth(), 1, 12, 0, 0, 0);
  const normalizedEnd = new Date(end.getFullYear(), end.getMonth(), 1, 12, 0, 0, 0);

  const cursor = new Date(normalizedStart);
  const result: string[] = [];

  while (cursor <= normalizedEnd) {
    result.push(getMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

function buildNextMonthKeys(count = 12, referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 12, 0, 0, 0);
  const cursor = new Date(start);
  const result: string[] = [];

  for (let i = 0; i < count; i += 1) {
    result.push(getMonthKey(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

function isDateWithinRange(dateStr: string, startDate: string, endDate: string) {
  const current = parseSafeDate(dateStr);
  const start = parseSafeDate(startDate);
  const end = parseSafeDate(endDate);

  current.setHours(0, 0, 0, 0);
  start.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);

  return current >= start && current <= end;
}

function getMonthDateRange(referenceDate = new Date()) {
  const start = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1, 12, 0, 0, 0);
  const end = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0, 12, 0, 0, 0);

  return {
    startDate: toDateOnlyInput(start),
    endDate: toDateOnlyInput(end),
    monthLabel: getMonthLabel(getMonthKey(start)),
  };
}

function getPreviousMonthDateRange(referenceDate = new Date()) {
  const previous = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 1, 1, 12, 0, 0, 0);
  return getMonthDateRange(previous);
}

function calculateDeltaPercent(current: number | null, previous: number | null) {
  if (current === null || previous === null) return null;

  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }

  return roundMoney(((current - previous) / Math.abs(previous)) * 100);
}

async function getCashFlowReportData(filters: ReportFilters): Promise<CashFlowReportData> {
  const { data: payments, error } = await supabase
    .from('payment_records')
    .select('*')
    .gte('payment_date', filters.startDate)
    .lte('payment_date', filters.endDate)
    .order('payment_date', { ascending: true });

  if (error) throw error;

  const grouped = (payments || []).reduce((acc: Record<string, number>, curr: any) => {
    const safeDateKey = String(curr.payment_date || '').split('T')[0];
    acc[safeDateKey] = roundMoney((acc[safeDateKey] || 0) + Number(curr.amount_paid || 0));
    return acc;
  }, {});

  const chartData = Object.entries(grouped)
    .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
    .map(([date, amount]) => ({
      rawDate: date,
      date: date.split('-').reverse().join('/'),
      amount: roundMoney(Number(amount)),
    }));

  const total = roundMoney(
    (payments || []).reduce((sum, p: any) => sum + Number(p.amount_paid || 0), 0)
  );

  const count = payments?.length || 0;

  return {
    kind: 'fluxo-caixa',
    total,
    count,
    averageTicket: roundMoney(total / (count || 1)),
    chartData,
    details: payments || [],
  };
}

async function getOverdueReportData(filters: ReportFilters): Promise<OverdueReportData> {
  const { data: installments, error } = await supabase
    .from('installments')
    .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name))')
    .not('status', 'in', '("paid","cancelled")')
    .order('due_date', { ascending: true });

  if (error) throw error;

  const overdue = (installments || [])
    .filter(
      (item) =>
        isInstallmentOverdue(item) &&
        isDateWithinRange(item.due_date, filters.startDate, filters.endDate)
    )
    .map((item) => ({
      ...item,
      patientName: resolvePatientName(item),
      outstandingAmount: roundMoney(getInstallmentOutstandingAmount(item)),
    }));

  return {
    kind: 'inadimplencia',
    total: roundMoney(overdue.reduce((sum, p: any) => sum + Number(p.outstandingAmount || 0), 0)),
    count: overdue.length,
    details: overdue,
  };
}

async function getProcedureProductionReportData(
  filters: ReportFilters
): Promise<ProcedureProductionReportData> {
  const { data: treatments, error: treatmentsError } = await supabase
    .from('treatments')
    .select('id, created_at')
    .gte('created_at', `${filters.startDate}T00:00:00`)
    .lte('created_at', `${filters.endDate}T23:59:59`);

  if (treatmentsError) throw treatmentsError;

  const treatmentIds = (treatments || []).map((item: any) => item.id);

  if (treatmentIds.length === 0) {
    return {
      kind: 'procedimentos',
      total: 0,
      count: 0,
      chartData: [],
      details: [],
    };
  }

  const { data: items, error } = await supabase
    .from('treatment_items')
    .select('procedure_name_snapshot, quantity, line_total, treatment_id')
    .in('treatment_id', treatmentIds);

  if (error) throw error;

  const grouped = (items || []).reduce((acc: Record<string, ProcedureProductionPoint>, curr: any) => {
    const name = curr.procedure_name_snapshot || 'Procedimento';

    if (!acc[name]) {
      acc[name] = { name, count: 0, total: 0 };
    }

    acc[name].count += Number(curr.quantity || 0);
    acc[name].total = roundMoney(acc[name].total + Number(curr.line_total || 0));

    return acc;
  }, {});

  const details = Object.values(grouped).sort((a, b) => b.total - a.total);

  return {
    kind: 'procedimentos',
    total: roundMoney(details.reduce((sum, item) => sum + item.total, 0)),
    count: details.reduce((sum, item) => sum + item.count, 0),
    chartData: details,
    details,
  };
}

async function getPatientGrowthReportData(
  filters: ReportFilters
): Promise<PatientGrowthReportData> {
  const { data: patients, error } = await supabase
    .from('patients')
    .select('id, full_name, phone, email, created_at')
    .gte('created_at', `${filters.startDate}T00:00:00`)
    .lte('created_at', `${filters.endDate}T23:59:59`)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const monthKeys = buildMonthKeysInRange(filters.startDate, filters.endDate);

  const grouped = monthKeys.reduce((acc: Record<string, PatientGrowthPoint>, monthKey) => {
    acc[monthKey] = {
      monthKey,
      monthLabel: getMonthLabel(monthKey),
      newPatientsCount: 0,
    };
    return acc;
  }, {});

  (patients || []).forEach((patient: any) => {
    const monthKey = getMonthKey(patient.created_at);
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        monthKey,
        monthLabel: getMonthLabel(monthKey),
        newPatientsCount: 0,
      };
    }

    grouped[monthKey].newPatientsCount += 1;
  });

  return {
    kind: 'pacientes',
    count: patients?.length || 0,
    chartData: Object.values(grouped),
    details: patients || [],
  };
}

async function getExecutiveFinancialReportData(
  filters: ReportFilters
): Promise<ExecutiveFinancialReportData> {
  const [{ data: payments, error: paymentsError }, { data: installments, error: installmentsError }] =
    await Promise.all([
      supabase
        .from('payment_records')
        .select('*')
        .gte('payment_date', filters.startDate)
        .lte('payment_date', filters.endDate)
        .order('payment_date', { ascending: true }),
      supabase
        .from('installments')
        .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name))')
        .not('status', 'eq', 'cancelled')
        .order('due_date', { ascending: true }),
    ]);

  if (paymentsError) throw paymentsError;
  if (installmentsError) throw installmentsError;

  const safeInstallments = installments || [];
  const safePayments = payments || [];

  const openInstallments = safeInstallments.filter((item: any) => {
    if (item.status === 'paid' || item.status === 'cancelled') return false;
    return getInstallmentOutstandingAmount(item) > 0;
  });

  const overduePortfolio = openInstallments.filter(isInstallmentOverdue);

  const overdueInPeriod = overduePortfolio.filter((item: any) =>
    isDateWithinRange(item.due_date, filters.startDate, filters.endDate)
  );

  const scheduledInPeriod = safeInstallments.filter((item: any) =>
    isDateWithinRange(item.due_date, filters.startDate, filters.endDate)
  );

  const monthKeys = buildMonthKeysInRange(filters.startDate, filters.endDate);

  const comparisonBase = monthKeys.reduce(
    (acc: Record<string, ExecutiveMonthlyComparisonPoint>, monthKey) => {
      acc[monthKey] = {
        monthKey,
        monthLabel: getMonthLabel(monthKey),
        scheduledAmount: 0,
        receivedAmount: 0,
        overdueAmount: 0,
      };
      return acc;
    },
    {}
  );

  scheduledInPeriod.forEach((item: any) => {
    const monthKey = getMonthKey(item.due_date);
    if (!comparisonBase[monthKey]) return;
    comparisonBase[monthKey].scheduledAmount = roundMoney(
      comparisonBase[monthKey].scheduledAmount + Number(item.amount || 0)
    );
  });

  safePayments.forEach((item: any) => {
    const monthKey = getMonthKey(item.payment_date);
    if (!comparisonBase[monthKey]) return;
    comparisonBase[monthKey].receivedAmount = roundMoney(
      comparisonBase[monthKey].receivedAmount + Number(item.amount_paid || 0)
    );
  });

  overdueInPeriod.forEach((item: any) => {
    const monthKey = getMonthKey(item.due_date);
    if (!comparisonBase[monthKey]) return;
    comparisonBase[monthKey].overdueAmount = roundMoney(
      comparisonBase[monthKey].overdueAmount + getInstallmentOutstandingAmount(item)
    );
  });

  const forecastMonthKeys = buildNextMonthKeys(12);
  const forecastBase = forecastMonthKeys.reduce(
    (acc: Record<string, ExecutiveForecastPoint>, monthKey) => {
      acc[monthKey] = {
        monthKey,
        monthLabel: getMonthLabel(monthKey),
        openAmount: 0,
      };
      return acc;
    },
    {}
  );

  openInstallments.forEach((item: any) => {
    const monthKey = getMonthKey(item.due_date);
    if (!forecastBase[monthKey]) return;
    forecastBase[monthKey].openAmount = roundMoney(
      forecastBase[monthKey].openAmount + getInstallmentOutstandingAmount(item)
    );
  });

  const receivedTotal = roundMoney(
    safePayments.reduce((sum: number, item: any) => sum + Number(item.amount_paid || 0), 0)
  );

  const scheduledInPeriodTotal = roundMoney(
    scheduledInPeriod.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0)
  );

  const overdueInPeriodTotal = roundMoney(
    overdueInPeriod.reduce(
      (sum: number, item: any) => sum + getInstallmentOutstandingAmount(item),
      0
    )
  );

  const overduePortfolioTotal = roundMoney(
    overduePortfolio.reduce(
      (sum: number, item: any) => sum + getInstallmentOutstandingAmount(item),
      0
    )
  );

  const openPortfolioTotal = roundMoney(
    openInstallments.reduce(
      (sum: number, item: any) => sum + getInstallmentOutstandingAmount(item),
      0
    )
  );

  const receivedCount = safePayments.length;

  const topOverdueDetails: ExecutiveOverdueDetail[] = overduePortfolio
    .map((item: any) => ({
      installmentId: item.id,
      treatmentId: item.treatment_id || null,
      patientName: resolvePatientName(item),
      dueDate: item.due_date,
      outstandingAmount: roundMoney(getInstallmentOutstandingAmount(item)),
      installmentNumber: item.installment_number || null,
    }))
    .sort((a, b) => {
      const aDate = parseSafeDate(a.dueDate).getTime();
      const bDate = parseSafeDate(b.dueDate).getTime();
      return aDate - bDate;
    })
    .slice(0, 10);

  return {
    kind: 'financeiro-executivo',
    summary: {
      receivedTotal,
      scheduledInPeriodTotal,
      overdueInPeriodTotal,
      overduePortfolioTotal,
      openPortfolioTotal,
      averageTicket: roundMoney(receivedTotal / (receivedCount || 1)),
      receivedCount,
      collectionRatePercent:
        scheduledInPeriodTotal > 0
          ? roundMoney((receivedTotal / scheduledInPeriodTotal) * 100)
          : null,
    },
    monthlyComparison: Object.values(comparisonBase),
    forecastNext12Months: Object.values(forecastBase),
    topOverdueDetails,
  };
}

export async function getDashboardExecutiveSummary(
  referenceDate = new Date(),
  options?: { forecastMonths?: number }
): Promise<DashboardExecutiveSummary> {
  const currentRange = getMonthDateRange(referenceDate);
  const previousRange = getPreviousMonthDateRange(referenceDate);
  const forecastMonths = Math.min(Math.max(options?.forecastMonths ?? 3, 1), 6);

  const [currentReport, previousReport] = await Promise.all([
    getExecutiveFinancialReportData({
      startDate: currentRange.startDate,
      endDate: currentRange.endDate,
    }),
    getExecutiveFinancialReportData({
      startDate: previousRange.startDate,
      endDate: previousRange.endDate,
    }),
  ]);

  return {
    monthLabel: currentRange.monthLabel,
    periodStart: currentRange.startDate,
    periodEnd: currentRange.endDate,
    receivedTotal: currentReport.summary.receivedTotal,
    scheduledTotal: currentReport.summary.scheduledInPeriodTotal,
    overdueInPeriodTotal: currentReport.summary.overdueInPeriodTotal,
    openPortfolioTotal: currentReport.summary.openPortfolioTotal,
    overduePortfolioTotal: currentReport.summary.overduePortfolioTotal,
    averageTicket: currentReport.summary.averageTicket,
    receivedCount: currentReport.summary.receivedCount,
    collectionRatePercent: currentReport.summary.collectionRatePercent,
    previousMonthLabel: previousRange.monthLabel,
    receivedDeltaPercent: calculateDeltaPercent(
      currentReport.summary.receivedTotal,
      previousReport.summary.receivedTotal
    ),
    overdueDeltaPercent: calculateDeltaPercent(
      currentReport.summary.overdueInPeriodTotal,
      previousReport.summary.overdueInPeriodTotal
    ),
    collectionRateDeltaPercent: calculateDeltaPercent(
      currentReport.summary.collectionRatePercent,
      previousReport.summary.collectionRatePercent
    ),
    forecastPreview: currentReport.forecastNext12Months.slice(1, 1 + forecastMonths),
  };
}

export async function getReportData(
  type: FinancialReportType,
  filters: ReportFilters
): Promise<FinancialReportData> {
  switch (type) {
    case 'financeiro-executivo':
      return getExecutiveFinancialReportData(filters);
    case 'fluxo-caixa':
      return getCashFlowReportData(filters);
    case 'inadimplencia':
      return getOverdueReportData(filters);
    case 'procedimentos':
      return getProcedureProductionReportData(filters);
    case 'pacientes':
      return getPatientGrowthReportData(filters);
    default:
      throw new Error('Tipo de relatório inválido.');
  }
}
