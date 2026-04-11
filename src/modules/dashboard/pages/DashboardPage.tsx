/**
 * Página de Dashboard.
 * Esta página fornece uma visão geral da clínica, incluindo estatísticas,
 * atividades recentes e lembretes de cobrança.
 *
 * Etapa 3A.2a:
 * - Aplica permissões reais no dashboard.
 * - Esconde visão executiva para quem não possui dashboard_executive.
 * - Esconde lembretes de cobrança para quem não possui collections_view.
 * - Mantém os cards clicáveis e o bloco de atividades sem regressão.
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/src/contexts/AuthContext';
import {
  Users,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  Calendar,
  Loader2,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { getWidgetsBySlot } from '@/src/app/moduleRegistry';
import { getDashboardMetrics } from '@/src/lib/financialMetrics';
import { resolvePatientName } from '@/src/lib/businessRules';
import { getNotificationSettings } from '@/src/lib/appSettings';

const RECENT_ACTIVITIES_LIMIT = 5;

interface DashboardStatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  to: string;
  helperText: string;
  requiredPermission?: 'dashboard_executive';
}

interface RecentActivity {
  id: string;
  type: 'payment' | 'treatment' | 'patient';
  patient: string;
  description: string;
  amount: number;
  date: string;
  rawDate: Date;
}

interface ReminderState {
  dueWithinAlertDays: number;
  overdue: number;
  pendingTreatments: number;
}

interface DashboardNotificationPreferences {
  dueAlertDays: number;
  showDashboardAlertSummary: boolean;
  enableWhatsappQuickCharge: boolean;
}

interface ReminderAction {
  label: string;
  helperText: string;
  to: string;
  dotColor: string;
}

export default function DashboardPage() {
  const { hasPermission } = useAuth();

  const canSeeExecutiveDashboard = hasPermission('dashboard_executive');
  const canSeeCollections = hasPermission('collections_view');

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStatCard[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [reminders, setReminders] = useState<ReminderState>({
    dueWithinAlertDays: 0,
    overdue: 0,
    pendingTreatments: 0,
  });

  const [notificationPreferences, setNotificationPreferences] =
    useState<DashboardNotificationPreferences>({
      dueAlertDays: 3,
      showDashboardAlertSummary: true,
      enableWhatsappQuickCharge: true,
    });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    setLoading(true);

    try {
      const notificationSettings = await getNotificationSettings();
      const safeAlertDays = Math.max(0, Number(notificationSettings.due_alert_days || '3'));

      setNotificationPreferences({
        dueAlertDays: safeAlertDays,
        showDashboardAlertSummary: notificationSettings.show_dashboard_alert_summary,
        enableWhatsappQuickCharge: notificationSettings.enable_whatsapp_quick_charge,
      });

      const metrics = await getDashboardMetrics(safeAlertDays);

      const [{ data: auditLogs }, { data: recentTreatments }, { data: recentPatients }] =
        await Promise.all([
          supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('treatments').select('*').order('created_at', { ascending: false }).limit(10),
          supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(10),
        ]);

      setStats([
        {
          label: 'Total de Pacientes',
          value: metrics.patientCount,
          icon: Users,
          color: 'bg-blue-500',
          to: '/pacientes',
          helperText: 'Ver lista de pacientes',
        },
        {
          label: 'Tratamentos Ativos',
          value: metrics.activeTreatmentsCount,
          icon: ClipboardList,
          color: 'bg-green-500',
          to: '/tratamentos',
          helperText: 'Ver lista de tratamentos',
        },
        {
          label: 'Recebido no Mês',
          value: formatCurrency(metrics.monthlyRevenue),
          icon: TrendingUp,
          color: 'bg-purple-500',
          to: '/parcelas',
          helperText: 'Ver parcelas e recebimentos',
          requiredPermission: 'dashboard_executive',
        },
        {
          label: 'Parcelas em Atraso',
          value: metrics.overdueCount,
          icon: AlertCircle,
          color: 'bg-red-500',
          to: '/cobrancas',
          helperText: 'Ver cobranças pendentes',
          requiredPermission: 'dashboard_executive',
        },
      ]);

      const normalizedActivities: RecentActivity[] = [];

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

      recentTreatments?.forEach((t) => {
        normalizedActivities.push({
          id: `treatment-${t.id}`,
          type: 'treatment',
          patient: resolvePatientName(t),
          description: 'Novo tratamento criado',
          amount: t.total_amount || 0,
          date: new Date(t.created_at).toLocaleString('pt-BR'),
          rawDate: new Date(t.created_at),
        });
      });

      recentPatients?.forEach((p) => {
        normalizedActivities.push({
          id: `patient-${p.id}`,
          type: 'patient',
          patient: p.full_name,
          description: 'Paciente cadastrado',
          amount: 0,
          date: new Date(p.created_at).toLocaleString('pt-BR'),
          rawDate: new Date(p.created_at),
        });
      });

      setRecentActivities(
        normalizedActivities
          .sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
          .slice(0, RECENT_ACTIVITIES_LIMIT)
      );

      setReminders({
        dueWithinAlertDays: metrics.dueWithinAlertDaysCount || 0,
        overdue: metrics.overdueCount || 0,
        pendingTreatments: metrics.pendingTreatmentsCount || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);

      setNotificationPreferences({
        dueAlertDays: 3,
        showDashboardAlertSummary: true,
        enableWhatsappQuickCharge: true,
      });
    } finally {
      setLoading(false);
    }
  }

  function getActivityVisual(type: RecentActivity['type']) {
    if (type === 'payment') {
      return {
        bg: 'bg-green-100',
        text: 'text-green-700',
        icon: TrendingUp,
      };
    }

    if (type === 'treatment') {
      return {
        bg: 'bg-blue-100',
        text: 'text-blue-700',
        icon: ClipboardList,
      };
    }

    return {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: Users,
    };
  }

  function getUpcomingReminderLabel() {
    if (notificationPreferences.dueAlertDays === 0) {
      return `${reminders.dueWithinAlertDays} parcelas vencem hoje`;
    }

    if (notificationPreferences.dueAlertDays === 1) {
      return `${reminders.dueWithinAlertDays} parcelas vencem em até 1 dia`;
    }

    return `${reminders.dueWithinAlertDays} parcelas vencem em até ${notificationPreferences.dueAlertDays} dias`;
  }

  function getUpcomingReminderHelperText() {
    return notificationPreferences.enableWhatsappQuickCharge
      ? 'Preparar cobrança assistida por WhatsApp'
      : 'Acompanhar vencimentos próximos';
  }

  function getReminderActions(): ReminderAction[] {
    return [
      {
        label: getUpcomingReminderLabel(),
        helperText: getUpcomingReminderHelperText(),
        to: notificationPreferences.enableWhatsappQuickCharge ? '/cobrancas' : '/parcelas',
        dotColor: reminders.dueWithinAlertDays > 0 ? 'bg-yellow-500' : 'bg-gray-300',
      },
      {
        label: `${reminders.overdue} parcelas em atraso`,
        helperText: 'Revisar cobranças pendentes',
        to: '/cobrancas',
        dotColor: reminders.overdue > 0 ? 'bg-red-600' : 'bg-gray-300',
      },
      {
        label: `${reminders.pendingTreatments} tratamentos aguardando aprovação`,
        helperText: 'Revisar orçamentos pendentes',
        to: '/tratamentos',
        dotColor: reminders.pendingTreatments > 0 ? 'bg-yellow-500' : 'bg-gray-300',
      },
    ];
  }

  function getPrimaryReminderCTA() {
    if (reminders.overdue > 0) {
      return {
        label: 'Revisar cobranças em atraso',
        to: '/cobrancas',
      };
    }

    if (reminders.dueWithinAlertDays > 0 && notificationPreferences.enableWhatsappQuickCharge) {
      return {
        label: 'Preparar cobranças do período',
        to: '/cobrancas',
      };
    }

    if (reminders.dueWithinAlertDays > 0) {
      return {
        label: 'Acompanhar vencimentos',
        to: '/parcelas',
      };
    }

    if (reminders.pendingTreatments > 0) {
      return {
        label: 'Ver tratamentos pendentes',
        to: '/tratamentos',
      };
    }

    return {
      label: 'Abrir cobranças',
      to: '/cobrancas',
    };
  }

  const visibleStats = useMemo(() => {
    return stats.filter((stat) => {
      if (!stat.requiredPermission) {
        return true;
      }

      if (stat.requiredPermission === 'dashboard_executive') {
        return canSeeExecutiveDashboard;
      }

      return true;
    });
  }, [stats, canSeeExecutiveDashboard]);

const reminderActions = getReminderActions();
const primaryReminderCTA = getPrimaryReminderCTA();

const rightColumnWidgets = useMemo(() => {
  return getWidgetsBySlot('dashboard.panel.right').filter((widget) => {
    if (!widget.requiredPermission) {
      return true;
    }

    return hasPermission(widget.requiredPermission);
  });
}, [hasPermission]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500">
            Bem-vindo ao Nord Finanças. Aqui está o resumo da sua clínica.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg border shadow-sm">
          <Calendar size={18} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">
            {new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' })}
          </span>
        </div>
      </div>

      <div
        className={cn(
          'grid grid-cols-1 sm:grid-cols-2 gap-6',
          visibleStats.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-2'
        )}
      >
        {visibleStats.map((stat) => (
          <Link
            key={stat.label}
            to={stat.to}
            className="group bg-white p-6 rounded-xl border shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`${stat.label}: abrir ${stat.helperText.toLowerCase()}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={cn('p-3 rounded-lg text-white', stat.color)}>
                <stat.icon size={24} />
              </div>

              <div className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                <span>Ver</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="mt-4">
              <p className="text-sm font-medium text-gray-500">{stat.label}</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stat.value}</p>
              <p className="text-xs text-gray-400 mt-2">{stat.helperText}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div
          className={cn(
            'bg-white rounded-xl border shadow-sm overflow-hidden',
            canSeeCollections ? 'lg:col-span-2' : 'lg:col-span-3'
          )}
        >
          <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Atividades Recentes</h3>
              <p className="text-xs text-gray-500 mt-1">
                Resumo rápido das últimas movimentações registradas no sistema.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
                Mostrando {RECENT_ACTIVITIES_LIMIT} mais recentes
              </div>

              <Link
                to="/atividades"
                className="inline-flex items-center gap-1 rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
              >
                Ver histórico completo
                <ArrowRight size={13} />
              </Link>
            </div>
          </div>

          <div className="divide-y">
            {recentActivities.length > 0 ? (
              recentActivities.map((activity) => {
                const visual = getActivityVisual(activity.type);
                const ActivityIcon = visual.icon;

                return (
                  <div
                    key={activity.id}
                    className="px-6 py-3.5 flex items-center justify-between gap-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={cn(
                          'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                          visual.bg,
                          visual.text
                        )}
                      >
                        <ActivityIcon size={16} />
                      </div>

                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-gray-900 truncate">
                          {activity.patient}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">
                          {activity.description}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      {activity.amount > 0 && (
                        <p className="text-sm font-bold text-gray-900">
                          {formatCurrency(activity.amount)}
                        </p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">{activity.date}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="px-6 py-10 text-center">
                <p className="text-sm text-gray-500">Nenhuma atividade recente encontrada.</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          {rightColumnWidgets.map((widget) => {
            const WidgetComponent = widget.component as React.ComponentType;

            return <WidgetComponent key={widget.key} />;
          })}

  {canSeeCollections && notificationPreferences.showDashboardAlertSummary && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-gray-900">Lembretes de Cobrança</h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Acompanhe vencimentos próximos, atrasos e pendências que merecem atenção.
                  </p>
                </div>

                {notificationPreferences.enableWhatsappQuickCharge && (
                  <div className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-100 px-2.5 py-1 text-[11px] font-medium text-emerald-700 shrink-0">
                    <MessageCircle size={12} />
                    WhatsApp pronto
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {reminderActions.map((item) => (
                  <Link
                    key={item.label}
                    to={item.to}
                    className="flex items-start gap-3 rounded-lg border px-3 py-3 hover:bg-gray-50 transition-colors"
                  >
                    <div className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', item.dotColor)} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{item.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{item.helperText}</p>
                    </div>
                  </Link>
                ))}
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Link
                  to={primaryReminderCTA.to}
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  {primaryReminderCTA.label}
                  <ArrowRight size={16} />
                </Link>

                <Link
                  to="/parcelas"
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-blue-100 text-blue-600 text-sm font-semibold hover:bg-blue-50 transition-colors"
                >
                  Abrir parcelas
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}