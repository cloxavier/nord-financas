import { supabase } from '@/src/lib/supabase';
import { getOpenReceivablesSummary } from '@/src/domain/receivables/services/receivablesReadService';
import { getCollectionOperationalSummary } from '@/src/domain/collections/services/collectionsReadService';
import { resolvePatientName } from '@/src/lib/businessRules';
import { getNotificationSettings } from '@/src/lib/appSettings';

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

export async function getDashboardSnapshot(): Promise<DashboardSnapshot> {
  const notificationSettings = await getNotificationSettings();
  const safeAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));

  const notificationPreferences: DashboardNotificationPreferences = {
    dueAlertDays: safeAlertDays,
    showDashboardAlertSummary: notificationSettings.show_dashboard_alert_summary,
    enableWhatsappQuickCharge: notificationSettings.enable_whatsapp_quick_charge,
  };

    const [receivablesSummary, collectionsSummary, patientsResult, treatmentsResult] =
    await Promise.all([
      getOpenReceivablesSummary(),
      getCollectionOperationalSummary(),
      supabase.from('patients').select('id', { count: 'exact', head: true }),
      supabase
        .from('treatments')
        .select('id', { count: 'exact', head: true })
        .in('status', ['approved', 'active']),
    ]);

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
      date: new Date(log.created_at).toLocaleString('pt-BR'),
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
      date: new Date(treatment.created_at).toLocaleString('pt-BR'),
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
      date: new Date(patient.created_at).toLocaleString('pt-BR'),
      rawDate: new Date(patient.created_at),
    });
  });

  const recentActivities = normalizedActivities
    .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
    .slice(0, RECENT_ACTIVITIES_LIMIT);

    const reminders: DashboardReminderState = {
    dueWithinAlertDays: 0,
    overdue: collectionsSummary.overdueInstallmentsCount || 0,
    pendingTreatments: 0,
  };

  return {
      metrics: {
      patientCount: patientsResult.count || 0,
      activeTreatmentsCount: treatmentsResult.count || 0,
      monthlyRevenue: receivablesSummary.totalReceivedThisMonth,
      overdueCount: collectionsSummary.overdueInstallmentsCount,
    },
    recentActivities,
    reminders,
    notificationPreferences,
  };
}