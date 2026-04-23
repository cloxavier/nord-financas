/**
 * Página de Dashboard.
 * Nesta etapa:
 * - aplica dashboard_executive
 * - aplica collections_view
 * - aplica activities_view
 * - não busca nem exibe atividades recentes para quem não possui essa permissão
 * - torna as atividades recentes clicáveis quando existe destino válido
 * - incorpora um resumo executivo do mês para gestores com visão financeira adequada
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
  WalletCards,
  BarChart3,
  AlertTriangle,
  CircleDollarSign,
  Target,
} from 'lucide-react';

import { useAuth } from '@/src/contexts/AuthContext';
import {
  canSeeCollections as resolveCanSeeCollections,
  canSeeExecutiveDashboard as resolveCanSeeExecutiveDashboard,
  filterItemsByPermission,
} from '@/src/domain/access/policies/accessPolicies';
import {
  canViewFinancialSummary,
  canViewMonthlyForecast,
  canViewOpenAmountTotal,
  getMonthsForwardVisible,
} from '@/src/domain/access/policies/financialScopePolicies';
import { formatCurrency, cn } from '@/src/lib/utils';
import { getWidgetsBySlot } from '@/src/app/moduleRegistry';
import { dashboardStatCardDefinitions } from '@/src/modules/dashboard/config/statCards';
import {
  DashboardRecentActivity,
  DashboardReminderState,
  getDashboardSnapshot,
} from '@/src/modules/dashboard/services/dashboardSnapshotService';
import type { DashboardExecutiveSummary } from '@/src/lib/financialMetrics';

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

function formatDeltaLabel(value: number | null, mode: 'currency' | 'percentage' = 'percentage') {
  if (value === null) return 'Sem base anterior';

  const prefix = value > 0 ? '+' : '';
  if (mode === 'currency') {
    return `${prefix}${value.toFixed(1).replace('.', ',')}%`;
  }

  return `${prefix}${value.toFixed(1).replace('.', ',')}%`;
}

function getDeltaTone(value: number | null, inverse = false) {
  if (value === null || value === 0) return 'text-gray-500';

  const isPositive = value > 0;
  const shouldBeGood = inverse ? !isPositive : isPositive;

  return shouldBeGood ? 'text-green-600' : 'text-red-600';
}

export default function DashboardPage() {
  const { permissions, hasPermission, financialScope } = useAuth();

  const canSeeCollections = resolveCanSeeCollections(permissions);
  const canSeeActivities = hasPermission('activities_view');
  const canSeeExecutiveDashboard = resolveCanSeeExecutiveDashboard(permissions);
  const canSeeExecutiveSummary =
    canSeeExecutiveDashboard && canViewFinancialSummary(financialScope);
  const canSeeExecutiveOpenTotals = canViewOpenAmountTotal(financialScope);
  const canSeeExecutiveForecast = canViewMonthlyForecast(financialScope);
  const executiveForecastMonths = Math.min(
    Math.max(getMonthsForwardVisible(financialScope) || 3, 1),
    4
  );

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStatCard[]>([]);
  const [recentActivities, setRecentActivities] = useState<DashboardRecentActivity[]>([]);
  const [reminders, setReminders] = useState<DashboardReminderState>({
    dueWithinAlertDays: 0,
    overdue: 0,
    pendingTreatments: 0,
  });
  const [executiveSummary, setExecutiveSummary] = useState<DashboardExecutiveSummary | null>(null);

  const [notificationPreferences, setNotificationPreferences] =
    useState<DashboardNotificationPreferences>({
      dueAlertDays: 3,
      showDashboardAlertSummary: true,
      enableWhatsappQuickCharge: true,
    });

  useEffect(() => {
    fetchDashboardData();
  }, [canSeeActivities, canSeeExecutiveSummary, executiveForecastMonths]);

  async function fetchDashboardData() {
    setLoading(true);

    try {
      const snapshot = await getDashboardSnapshot({
        includeRecentActivities: canSeeActivities,
        includeExecutiveSummary: canSeeExecutiveSummary,
        executiveForecastMonths,
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
      setExecutiveSummary(canSeeExecutiveSummary ? snapshot.executiveSummary : null);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);

      setNotificationPreferences({
        dueAlertDays: 3,
        showDashboardAlertSummary: true,
        enableWhatsappQuickCharge: true,
      });

      setRecentActivities([]);
      setExecutiveSummary(null);
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

      {canSeeExecutiveSummary && executiveSummary && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4 mb-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-indigo-700 mb-3">
                  <WalletCards size={13} />
                  Resumo executivo do mês
                </div>
                <h2 className="text-xl font-bold text-gray-900">
                  Visão financeira rápida de {executiveSummary.monthLabel}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Leitura gerencial do mês atual, sem precisar abrir o relatório completo.
                </p>
              </div>

              <Link
                to="/relatorios/financeiro-executivo"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg border border-indigo-100 text-indigo-700 font-semibold hover:bg-indigo-50 transition-colors"
              >
                Abrir relatório executivo
                <ArrowRight size={16} />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-green-700 mb-2">
                  <CircleDollarSign size={16} />
                  <p className="text-[11px] font-bold uppercase tracking-wider">
                    Recebido no mês
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(executiveSummary.receivedTotal)}
                </p>
                <p className={cn('text-xs mt-2 font-semibold', getDeltaTone(executiveSummary.receivedDeltaPercent))}>
                  vs {executiveSummary.previousMonthLabel}: {formatDeltaLabel(executiveSummary.receivedDeltaPercent)}
                </p>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <Target size={16} />
                  <p className="text-[11px] font-bold uppercase tracking-wider">
                    Previsto no mês
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(executiveSummary.scheduledTotal)}
                </p>
                <p className="text-xs mt-2 text-gray-500 font-medium">
                  Ticket médio: {formatCurrency(executiveSummary.averageTicket)}
                </p>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-red-700 mb-2">
                  <AlertTriangle size={16} />
                  <p className="text-[11px] font-bold uppercase tracking-wider">
                    Em atraso no mês
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {formatCurrency(executiveSummary.overdueInPeriodTotal)}
                </p>
                <p className={cn('text-xs mt-2 font-semibold', getDeltaTone(executiveSummary.overdueDeltaPercent, true))}>
                  vs {executiveSummary.previousMonthLabel}: {formatDeltaLabel(executiveSummary.overdueDeltaPercent)}
                </p>
              </div>

              <div className="rounded-xl border bg-gray-50 p-4">
                <div className="flex items-center gap-2 text-indigo-700 mb-2">
                  <BarChart3 size={16} />
                  <p className="text-[11px] font-bold uppercase tracking-wider">
                    Taxa de recebimento
                  </p>
                </div>
                <p className="text-2xl font-bold text-gray-900">
                  {executiveSummary.collectionRatePercent === null
                    ? 'N/A'
                    : `${executiveSummary.collectionRatePercent.toFixed(1).replace('.', ',')}%`}
                </p>
                <p className={cn('text-xs mt-2 font-semibold', getDeltaTone(executiveSummary.collectionRateDeltaPercent))}>
                  vs {executiveSummary.previousMonthLabel}: {formatDeltaLabel(executiveSummary.collectionRateDeltaPercent)}
                </p>
              </div>
            </div>

            {canSeeExecutiveOpenTotals && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-amber-700">
                    Carteira em aberto
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-2">
                    {formatCurrency(executiveSummary.openPortfolioTotal)}
                  </p>
                  <p className="text-xs text-amber-800 mt-2">
                    Total ainda pendente na carteira aberta da clínica.
                  </p>
                </div>

                <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-red-700">
                    Carteira vencida
                  </p>
                  <p className="text-xl font-bold text-gray-900 mt-2">
                    {formatCurrency(executiveSummary.overduePortfolioTotal)}
                  </p>
                  <p className="text-xs text-red-800 mt-2">
                    Valor total hoje em atraso dentro da carteira.
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border shadow-sm p-5 xl:col-span-2">
              <h3 className="font-bold text-gray-900">Comparativo do mês atual</h3>
              <p className="text-xs text-gray-500 mt-1">
                Leitura resumida contra {executiveSummary.previousMonthLabel}.
              </p>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">
                    Recebimento
                  </p>
                  <p className={cn('text-sm font-bold', getDeltaTone(executiveSummary.receivedDeltaPercent))}>
                    {formatDeltaLabel(executiveSummary.receivedDeltaPercent)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Mede a evolução do caixa recebido no mês.
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">
                    Inadimplência do mês
                  </p>
                  <p className={cn('text-sm font-bold', getDeltaTone(executiveSummary.overdueDeltaPercent, true))}>
                    {formatDeltaLabel(executiveSummary.overdueDeltaPercent)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Queda é positiva; alta merece acompanhamento.
                  </p>
                </div>

                <div className="rounded-lg border p-4">
                  <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">
                    Eficiência de recebimento
                  </p>
                  <p className={cn('text-sm font-bold', getDeltaTone(executiveSummary.collectionRateDeltaPercent))}>
                    {formatDeltaLabel(executiveSummary.collectionRateDeltaPercent)}
                  </p>
                  <p className="text-xs text-gray-500 mt-2">
                    Relação entre previsto e efetivamente recebido.
                  </p>
                </div>
              </div>
            </div>

            {canSeeExecutiveForecast && executiveSummary.forecastPreview.length > 0 && (
              <div className="bg-white rounded-xl border shadow-sm p-5">
                <h3 className="font-bold text-gray-900">Próximos meses</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Carteira aberta prevista para os próximos {executiveSummary.forecastPreview.length} meses.
                </p>

                <div className="mt-4 space-y-3">
                  {executiveSummary.forecastPreview.map((item) => (
                    <div key={item.monthKey} className="rounded-lg border px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{item.monthLabel}</p>
                        <p className="text-xs text-gray-500">Carteira aberta prevista</p>
                      </div>

                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.openAmount)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
