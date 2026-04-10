/**
 * Página de Dashboard.
 * Esta página fornece uma visão geral da clínica, incluindo estatísticas,
 * atividades recentes e lembretes de cobrança.
 *
 * Etapa 2.2:
 * - Mantém os cards principais clicáveis.
 * - Compacta e reorganiza o bloco de Atividades Recentes.
 * - Mostra de forma explícita apenas as 5 mais recentes.
 * - Remove temporariamente o link "Ver todas" para evitar rota morta
 *   até criarmos a página própria de histórico.
 */

import React, { useState, useEffect } from 'react';
import {
  Users,
  ClipboardList,
  TrendingUp,
  AlertCircle,
  Calendar,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { formatCurrency, cn } from '@/src/lib/utils';
import { Link } from 'react-router-dom';
import { supabase } from '@/src/lib/supabase';
import { getDashboardMetrics } from '@/src/lib/financialMetrics';
import { resolvePatientName } from '@/src/lib/businessRules';

/**
 * Quantidade de atividades exibidas no dashboard.
 * Mantida em constante para facilitar mudança futura.
 */
const RECENT_ACTIVITIES_LIMIT = 5;

/**
 * Tipo dos cards principais do dashboard.
 */
interface DashboardStatCard {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  to: string;
  helperText: string;
}

/**
 * Tipo simplificado das atividades recentes.
 */
interface RecentActivity {
  id: string;
  type: 'payment' | 'treatment' | 'patient';
  patient: string;
  description: string;
  amount: number;
  date: string;
  rawDate: Date;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStatCard[]>([]);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>([]);
  const [reminders, setReminders] = useState({
    dueToday: 0,
    overdue: 0,
    pendingTreatments: 0,
  });

  useEffect(() => {
    fetchDashboardData();
  }, []);

  /**
   * Busca todos os dados necessários para o dashboard de forma paralela.
   */
  async function fetchDashboardData() {
    setLoading(true);

    try {
      const metrics = await getDashboardMetrics();

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
        },
        {
          label: 'Parcelas em Atraso',
          value: metrics.overdueCount,
          icon: AlertCircle,
          color: 'bg-red-500',
          to: '/cobrancas',
          helperText: 'Ver cobranças pendentes',
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
        dueToday: metrics.dueTodayCount,
        overdue: metrics.overdueCount,
        pendingTreatments: metrics.pendingTreatmentsCount,
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Retorna cor e ícone da atividade para manter visual consistente.
   */
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabeçalho do Dashboard */}
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

      {/* Cards principais clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
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
        {/* Bloco de atividades recentes reorganizado */}
        <div className="lg:col-span-2 bg-white rounded-xl border shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-bold text-gray-900">Atividades Recentes</h3>
              <p className="text-xs text-gray-500 mt-1">
                Resumo rápido das últimas movimentações registradas no sistema.
              </p>
            </div>

            <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              Mostrando {RECENT_ACTIVITIES_LIMIT} mais recentes
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

        {/* Coluna lateral */}
        <div className="space-y-6">
          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
            <h3 className="font-bold text-lg mb-2">Ações Rápidas</h3>
            <p className="text-blue-100 text-sm mb-6">
              Agilize o atendimento e controle financeiro da sua clínica.
            </p>

            <div className="space-y-3">
              <Link
                to="/pacientes/novo"
                className="block w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold text-center transition-colors"
              >
                Novo Paciente
              </Link>

              <Link
                to="/tratamentos/novo"
                className="block w-full py-2 px-4 bg-white text-blue-600 hover:bg-blue-50 rounded-lg text-sm font-bold text-center transition-colors"
              >
                Novo Tratamento
              </Link>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4">Lembretes de Cobrança</h3>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    reminders.dueToday > 0 ? 'bg-red-500' : 'bg-gray-300'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {reminders.dueToday} parcelas vencem hoje
                  </p>
                  <p className="text-xs text-gray-500">Enviar lembretes via WhatsApp</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    reminders.overdue > 0 ? 'bg-red-600' : 'bg-gray-300'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {reminders.overdue} parcelas em atraso
                  </p>
                  <p className="text-xs text-gray-500">Revisar cobranças pendentes</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full mt-1.5 shrink-0',
                    reminders.pendingTreatments > 0 ? 'bg-yellow-500' : 'bg-gray-300'
                  )}
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {reminders.pendingTreatments} tratamentos aguardando aprovação
                  </p>
                  <p className="text-xs text-gray-500">Revisar orçamentos pendentes</p>
                </div>
              </div>
            </div>

            <Link
              to="/cobrancas"
              className="block w-full mt-6 py-2 text-center text-sm font-semibold text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100 transition-colors"
            >
              Ver Cobranças
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}