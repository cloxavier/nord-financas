import { supabase } from '@/src/lib/supabase';
import { getDashboardMetrics } from '@/src/lib/financialMetrics';
import { resolvePatientName } from '@/src/lib/businessRules';
import { getNotificationSettings } from '@/src/lib/appSettings';
import { formatDateTime } from '@/src/lib/utils';

const RECENT_ACTIVITIES_LIMIT = 5;

export interface DashboardRecentActivity {
  id: string;
  type: 'payment' | 'treatment' | 'patient' | 'procedure' | 'generic';
  title: string;
  description: string;
  amount: number;
  date: string;
  rawDate: Date;
  to: string | null;
}

export interface DashboardReminderState {
  dueWithinAlertDays: number;
  overdue: number;
  pendingTreatments: number;
}

export interface DashboardNotificationPreferences {
  dueAlertDays: number;
  showDashboardAlertSummary: boolean;
  enableWhatsappQuickCharge: boolean;
}

export interface DashboardMetricsSnapshot {
  patientCount: number;
  activeTreatmentsCount: number;
  monthlyRevenue: number;
  overdueCount: number;
}

export interface DashboardSnapshotOptions {
  includeRecentActivities?: boolean;
}

export interface DashboardSnapshot {
  metrics: DashboardMetricsSnapshot;
  recentActivities: DashboardRecentActivity[];
  reminders: DashboardReminderState;
  notificationPreferences: DashboardNotificationPreferences;
}

function resolveActivityType(
  action?: string | null,
  entityType?: string | null
): DashboardRecentActivity['type'] {
  const safeValue = `${action || ''} ${entityType || ''}`.toLowerCase();

  if (safeValue.includes('payment')) return 'payment';
  if (safeValue.includes('treatment')) return 'treatment';
  if (safeValue.includes('patient')) return 'patient';
  if (safeValue.includes('procedure')) return 'procedure';

  return 'generic';
}

function resolveActivityTitle(
  type: DashboardRecentActivity['type'],
  action?: string | null
) {
  switch (type) {
    case 'payment':
      return 'Pagamento';
    case 'treatment':
      if (action === 'treatment_cancelled') return 'Tratamento cancelado';
      if (action === 'installment_generated') return 'Parcelas geradas';
      if (action === 'installment_recalculated') return 'Parcelas recalculadas';
      if (action === 'payment_plan_synced') return 'Plano sincronizado';
      return 'Tratamento';
    case 'patient':
      return 'Paciente';
    case 'procedure':
      return 'Procedimento';
    default:
      return 'Atividade do sistema';
  }
}

function resolveActivityTarget(params: {
  action?: string | null;
  entityType?: string | null;
  entityId?: string | null;
}) {
  const { action, entityType, entityId } = params;

  if (action === 'treatment_permanently_deleted') {
    return null;
  }

  if (action === 'reminder_sent') {
    return '/cobrancas';
  }

  if (!entityId) return null;

  const type = resolveActivityType(action, entityType);

  switch (type) {
    case 'payment':
      return `/parcelas/${entityId}`;
    case 'treatment':
      return `/tratamentos/${entityId}`;
    case 'patient':
      return `/pacientes/${entityId}`;
    case 'procedure':
      return `/procedimentos/${entityId}`;
    default:
      return null;
  }
}

/**
 * Busca o snapshot do dashboard a partir das fontes consolidadas do projeto.
 *
 * Nesta etapa:
 * - mantém métricas centrais em financialMetrics
 * - respeita includeRecentActivities
 * - evita buscar atividades quando o usuário não possui activities_view
 * - enriquece as atividades com destino clicável
 */
export async function getDashboardSnapshot(
  options: DashboardSnapshotOptions = {}
): Promise<DashboardSnapshot> {
  const { includeRecentActivities = true } = options;

  const notificationSettings = await getNotificationSettings();
  const safeAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));

  const notificationPreferences: DashboardNotificationPreferences = {
    dueAlertDays: safeAlertDays,
    showDashboardAlertSummary: notificationSettings.show_dashboard_alert_summary,
    enableWhatsappQuickCharge: notificationSettings.enable_whatsapp_quick_charge,
  };

  const dashboardMetrics = await getDashboardMetrics(safeAlertDays);

  let recentActivities: DashboardRecentActivity[] = [];

  if (includeRecentActivities) {
    const [{ data: auditLogs }, { data: recentTreatments }, { data: recentPatients }] =
      await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('treatments').select('*').order('created_at', { ascending: false }).limit(10),
        supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(10),
      ]);

    const normalizedActivities: DashboardRecentActivity[] = [];
    const loggedTreatmentIds = new Set<string>();
    const loggedPatientIds = new Set<string>();

    auditLogs?.forEach((log) => {
      const activityType = resolveActivityType(log.action, log.entity_type);
      const target = resolveActivityTarget({
        action: log.action,
        entityType: log.entity_type,
        entityId: log.entity_id,
      });

      if (activityType === 'treatment' && log.entity_id) {
        loggedTreatmentIds.add(log.entity_id);
      }

      if (activityType === 'patient' && log.entity_id) {
        loggedPatientIds.add(log.entity_id);
      }

      normalizedActivities.push({
        id: `audit-${log.id}`,
        type: activityType,
        title: resolveActivityTitle(activityType, log.action),
        description: log.description || log.action || 'Atividade registrada',
        amount: 0,
        date: formatDateTime(log.created_at),
        rawDate: new Date(log.created_at),
        to: target,
      });
    });

    recentTreatments?.forEach((treatment) => {
      if (loggedTreatmentIds.has(treatment.id)) return;

      normalizedActivities.push({
        id: `treatment-${treatment.id}`,
        type: 'treatment',
        title: resolvePatientName(treatment),
        description: 'Novo tratamento criado',
        amount: treatment.total_amount || 0,
        date: formatDateTime(treatment.created_at),
        rawDate: new Date(treatment.created_at),
        to: `/tratamentos/${treatment.id}`,
      });
    });

    recentPatients?.forEach((patient) => {
      if (loggedPatientIds.has(patient.id)) return;

      normalizedActivities.push({
        id: `patient-${patient.id}`,
        type: 'patient',
        title: patient.full_name,
        description: 'Paciente cadastrado',
        amount: 0,
        date: formatDateTime(patient.created_at),
        rawDate: new Date(patient.created_at),
        to: `/pacientes/${patient.id}`,
      });
    });

    recentActivities = normalizedActivities
      .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
      .slice(0, RECENT_ACTIVITIES_LIMIT);
  }

  const reminders: DashboardReminderState = {
    dueWithinAlertDays: dashboardMetrics.dueWithinAlertDaysCount || 0,
    overdue: dashboardMetrics.overdueCount || 0,
    pendingTreatments: dashboardMetrics.pendingTreatmentsCount || 0,
  };

  return {
    metrics: {
      patientCount: dashboardMetrics.patientCount || 0,
      activeTreatmentsCount: dashboardMetrics.activeTreatmentsCount || 0,
      monthlyRevenue: dashboardMetrics.monthlyRevenue || 0,
      overdueCount: dashboardMetrics.overdueCount || 0,
    },
    recentActivities,
    reminders,
    notificationPreferences,
  };
}