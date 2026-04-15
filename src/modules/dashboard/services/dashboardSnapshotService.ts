import { supabase } from '@/src/lib/supabase';
import { getDashboardMetrics } from '@/src/lib/financialMetrics';
import { resolvePatientName } from '@/src/lib/businessRules';
import { getNotificationSettings } from '@/src/lib/appSettings';
import { formatDateTime } from '@/src/lib/utils';

const RECENT_ACTIVITIES_LIMIT = 5;

export interface DashboardRecentActivity {
  id: string;
  type: 'payment' | 'treatment' | 'patient';
  patient: string;
  description: string;
  amount: number;
  date: string;
  rawDate: Date;
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

export interface DashboardSnapshot {
  metrics: DashboardMetricsSnapshot;
  recentActivities: DashboardRecentActivity[];
  reminders: DashboardReminderState;
  notificationPreferences: DashboardNotificationPreferences;
}

/**
 * Busca o snapshot do dashboard a partir das fontes consolidadas do projeto.
 *
 * Nesta etapa:
 * - o dashboard continua usando as métricas centrais
 * - atividades recentes passam a respeitar a timezone oficial da aplicação
 */
export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const notificationSettings = await getNotificationSettings();

  const safeAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));

  const notificationPreferences: DashboardNotificationPreferences = {
    dueAlertDays: safeAlertDays,
    showDashboardAlertSummary: notificationSettings.show_dashboard_alert_summary,
    enableWhatsappQuickCharge: notificationSettings.enable_whatsapp_quick_charge,
  };

  const dashboardMetrics = await getDashboardMetrics(safeAlertDays);

  const [{ data: auditLogs }, { data: recentTreatments }, { data: recentPatients }] =
    await Promise.all([
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('treatments').select('*').order('created_at', { ascending: false }).limit(10),
      supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(10),
    ]);

  const normalizedActivities: DashboardRecentActivity[] = [];

  auditLogs?.forEach((log) => {
    normalizedActivities.push({
      id: `audit-${log.id}`,
      type: log.action.includes('payment')
        ? 'payment'
        : log.action.includes('treatment')
        ? 'treatment'
        : 'patient',
      patient: log.description?.split(':')?.pop()?.trim() || 'Sistema',
      description: log.description || log.action,
      amount: 0,
      date: formatDateTime(log.created_at),
      rawDate: new Date(log.created_at),
    });
  });

  recentTreatments?.forEach((treatment) => {
    normalizedActivities.push({
      id: `treatment-${treatment.id}`,
      type: 'treatment',
      patient: resolvePatientName(treatment),
      description: 'Novo tratamento criado',
      amount: treatment.total_amount || 0,
      date: formatDateTime(treatment.created_at),
      rawDate: new Date(treatment.created_at),
    });
  });

  recentPatients?.forEach((patient) => {
    normalizedActivities.push({
      id: `patient-${patient.id}`,
      type: 'patient',
      patient: patient.full_name,
      description: 'Paciente cadastrado',
      amount: 0,
      date: formatDateTime(patient.created_at),
      rawDate: new Date(patient.created_at),
    });
  });

  const recentActivities = normalizedActivities
    .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
    .slice(0, RECENT_ACTIVITIES_LIMIT);

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