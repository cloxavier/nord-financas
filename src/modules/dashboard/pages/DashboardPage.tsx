/**
 * Página de Dashboard.
 * Nesta etapa:
 * - aplica dashboard_executive
 * - aplica collections_view
 * - aplica activities_view
 * - não busca nem exibe atividades recentes para quem não possui essa permissão
 * - torna as atividades recentes clicáveis quando existe destino válido
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  ClipboardList,
  TrendingUp,
  Calendar,
  Loader2,
  ArrowRight,
  MessageCircle,
  Stethoscope,
  Bell,
} from 'lucide-react';

import { useAuth } from '@/src/contexts/AuthContext';
import {
  canSeeCollections as resolveCanSeeCollections,
  filterItemsByPermission,
} from '@/src/domain/access/policies/accessPolicies';
import { formatCurrency, cn } from '@/src/lib/utils';
import { getWidgetsBySlot } from '@/src/app/moduleRegistry';
import { dashboardStatCardDefinitions } from '@/src/modules/dashboard/config/statCards';
import {
  DashboardRecentActivity,
  DashboardReminderState,
  getDashboardSnapshot,
} from '@/src/modules/dashboard/services/dashboardSnapshotService';

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
  const { permissions, hasPermission } = useAuth();

  const canSeeCollections = resolveCanSeeCollections(permissions);
  const canSeeActivities = hasPermission('activities_view');

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStatCard[]>([]);
  const [recentActivities, setRecentActivities] = useState<DashboardRecentActivity[]>([]);
  const [reminders, setReminders] = useState<DashboardReminderState>({
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
  }, [canSeeActivities]);

  async function fetchDashboardData() {
    setLoading(true);

    try {
      const snapshot = await getDashboardSnapshot({
        includeRecentActivities: canSeeActivities,
      });

      setNotificationPreferences(snapshot.notificationPreferences);

      setStats(
        dashboardStatCardDefinitions.map((card) => {
          let value: string | number = 0;

          switch (card.key) {
            case 'patients.total':
              value = snapshot.metrics.patientCount;
              break;
            case 'treatments.active':
              value = snapshot.metrics.activeTreatmentsCount;
              break;
            case 'revenue.month':
              value = formatCurrency(snapshot.metrics.monthlyRevenue);
              break;
            case 'collections.overdue':
              value = snapshot.metrics.overdueCount;
              break;
            default:
              value = 0;
          }

          return {
            label: card.label,
            value,
            icon: card.icon,
            color: card.color,
            to: card.to,
            helperText: card.helperText,
            requiredPermission: card.requiredPermission,
          };
        })
      );

      setRecentActivities(canSeeActivities ? snapshot.recentActivities : []);
      setReminders(snapshot.reminders);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);

      setNotificationPreferences({
        dueAlertDays: 3,
        showDashboardAlertSummary: true,
        enableWhatsappQuickCharge: true,
      });

      setRecentActivities([]);
    } finally {
      setLoading(false);
    }
  }

  function getActivityVisual(type: DashboardRecentActivity['type']) {
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

    if (type === 'procedure') {
      return {
        bg: 'bg-violet-100',
        text: 'text-violet-700',
        icon: Stethoscope,
      };
    }

    if (type === 'patient') {
      return {
        bg: 'bg-purple-100',
        text: 'text-purple-700',
        icon: Users,
      };
    }

    return {
      bg: 'bg-gray-100',
      text: 'text-gray-700',
      icon: Bell,
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
    return filterItemsByPermission(stats, permissions);
  }, [stats, permissions]);

  const rightColumnWidgets = useMemo(() => {
    return filterItemsByPermission(getWidgetsBySlot('dashboard.panel.right'), permissions);
  }, [permissions]);

  const reminderActions = getReminderActions();
  const primaryReminderCTA = getPrimaryReminderCTA();

  const showReminderCard =
    canSeeCollections && notificationPreferences.showDashboardAlertSummary;

  const showRightColumn = rightColumnWidgets.length > 0 || showReminderCard;

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
            {new Date().toLocaleString('pt-BR', {
              month: 'long',
              year: 'numeric',
              timeZone: 'America/Sao_Paulo',
            })}
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

      {(canSeeActivities || showRightColumn) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {canSeeActivities && (
            <div
              className={cn(
                'bg-white rounded-xl border shadow-sm overflow-hidden',
                showRightColumn ? 'lg:col-span-2' : 'lg:col-span-3'
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

                    const content = (
                      <div className="px-6 py-3.5 flex items-center justify-between gap-4">
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
                              {activity.title}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5 truncate">
                              {activity.description}
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          {activity.to && (
                            <p className="text-[11px] font-bold text-blue-600 mb-0.5">
                              Abrir item
                            </p>
                          )}

                          {activity.amount > 0 && (
                            <p className="text-sm font-bold text-gray-900">
                              {formatCurrency(activity.amount)}
                            </p>
                          )}

                          <p className="text-xs text-gray-400 mt-0.5">{activity.date}</p>
                        </div>
                      </div>
                    );

                    if (activity.to) {
                      return (
                        <Link
                          key={activity.id}
                          to={activity.to}
                          className="block hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {content}
                        </Link>
                      );
                    }

                    return (
                      <div key={activity.id} className="hover:bg-gray-50 transition-colors">
                        {content}
                      </div>
                    );
                  })
                ) : (
                  <div className="px-6 py-10 text-center">
                    <p className="text-sm text-gray-500">
                      Nenhuma atividade recente encontrada.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {showRightColumn && (
            <div className={cn('space-y-6', !canSeeActivities && 'lg:col-span-3')}>
              {rightColumnWidgets.map((widget) => {
                const WidgetComponent = widget.component as React.ComponentType;
                return <WidgetComponent key={widget.key} />;
              })}

              {showReminderCard && (
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
                        <div
                          className={cn('w-2 h-2 rounded-full mt-1.5 shrink-0', item.dotColor)}
                        />
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
          )}
        </div>
      )}
    </div>
  );
}