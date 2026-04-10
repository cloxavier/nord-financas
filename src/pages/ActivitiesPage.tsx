/**
 * Página de Histórico de Atividades.
 * Consolida logs de auditoria, pagamentos, novos tratamentos e pacientes
 * em um feed detalhado, com busca e filtros simples.
 *
 * Etapa 3.1:
 * - Reaproveita a página já existente no projeto.
 * - Melhora clareza visual e posicionamento como tela de aprofundamento.
 * - Mantém busca e filtros sem ainda entrar em retenção e limpeza automática.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Calendar,
  ClipboardList,
  Clock,
  Loader2,
  Search,
  Stethoscope,
  TrendingUp,
  Users,
  Bell,
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

const AUDIT_LOG_LIMIT = 100;
const TREATMENTS_LIMIT = 50;
const PATIENTS_LIMIT = 50;
const PAYMENTS_LIMIT = 50;

type ActivityFilter = 'all' | 'payments' | 'treatments' | 'patients';

interface ActivityItem {
  id: string;
  type: string;
  description: string;
  date: Date;
  amount?: number;
  patient?: string;
  metadata?: Record<string, any>;
}

export default function ActivitiesPage() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filter, setFilter] = useState<ActivityFilter>('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchActivities();
  }, []);

  /**
   * Busca e normaliza atividades de múltiplas fontes.
   * Nesta etapa ainda não aplicamos retenção: apenas consolidamos melhor o histórico.
   */
  async function fetchActivities() {
    setLoading(true);

    try {
      const [
        { data: auditLogs },
        { data: recentTreatments },
        { data: recentPatients },
        { data: paidInstallments },
      ] = await Promise.all([
        supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(AUDIT_LOG_LIMIT),

        supabase
          .from('treatments')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(TREATMENTS_LIMIT),

        supabase
          .from('patients')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(PATIENTS_LIMIT),

        supabase
          .from('installments')
          .select('*')
          .eq('status', 'paid')
          .order('payment_date', { ascending: false })
          .limit(PAYMENTS_LIMIT),
      ]);

      const normalizedActivities: ActivityItem[] = [];

      // 1) Audit logs do sistema
      auditLogs?.forEach((log) => {
        normalizedActivities.push({
          id: `audit-${log.id}`,
          type: log.action,
          description: log.description || log.action,
          date: new Date(log.created_at),
          metadata: {
            entity_id: log.entity_id,
            entity_type: log.entity_type,
          },
        });
      });

      // 2) Pagamentos registrados
      paidInstallments?.forEach((installment) => {
        normalizedActivities.push({
          id: `payment-${installment.id}`,
          type: 'payment_registered',
          description: `Pagamento de ${formatCurrency(
            installment.amount_paid || installment.amount || 0
          )} recebido`,
          date: new Date(installment.payment_date),
          amount: installment.amount_paid || installment.amount || 0,
          patient: installment.patient_name_snapshot || 'Paciente',
        });
      });

      // 3) Tratamentos criados recentemente
      recentTreatments?.forEach((treatment) => {
        const alreadyLogged = normalizedActivities.find(
          (item) =>
            item.metadata?.entity_id === treatment.id &&
            item.type === 'treatment_created'
        );

        if (!alreadyLogged) {
          normalizedActivities.push({
            id: `treatment-${treatment.id}`,
            type: 'treatment_created',
            description: `Novo tratamento criado`,
            date: new Date(treatment.created_at),
            amount: treatment.total_amount || 0,
            patient: treatment.patient_name_snapshot || 'Paciente',
          });
        }
      });

      // 4) Pacientes criados recentemente
      recentPatients?.forEach((patient) => {
        const alreadyLogged = normalizedActivities.find(
          (item) =>
            item.metadata?.entity_id === patient.id &&
            item.type === 'patient_created'
        );

        if (!alreadyLogged) {
          normalizedActivities.push({
            id: `patient-${patient.id}`,
            type: 'patient_created',
            description: `Paciente cadastrado`,
            date: new Date(patient.created_at),
            patient: patient.full_name,
          });
        }
      });

      normalizedActivities.sort((a, b) => b.date.getTime() - a.date.getTime());

      setActivities(normalizedActivities);
    } catch (error) {
      console.error('Erro ao carregar histórico de atividades:', error);
    } finally {
      setLoading(false);
    }
  }

  /**
   * Filtra os registros por texto e por categoria.
   */
  const filteredActivities = useMemo(() => {
    return activities.filter((activity) => {
      const searchBase = `${activity.description} ${activity.patient || ''}`.toLowerCase();
      const matchesSearch = searchBase.includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      if (filter === 'all') return true;
      if (filter === 'payments') return activity.type.toLowerCase().includes('payment');
      if (filter === 'treatments') return activity.type.toLowerCase().includes('treatment');
      if (filter === 'patients') return activity.type.toLowerCase().includes('patient');

      return true;
    });
  }, [activities, filter, searchTerm]);

  function getActivityVisual(type: string) {
    const safeType = type.toLowerCase();

    if (safeType.includes('payment')) {
      return {
        icon: TrendingUp,
        color: 'bg-green-100 text-green-700',
        label: 'Pagamento',
      };
    }

    if (safeType.includes('treatment')) {
      return {
        icon: ClipboardList,
        color: 'bg-blue-100 text-blue-700',
        label: 'Tratamento',
      };
    }

    if (safeType.includes('patient')) {
      return {
        icon: Users,
        color: 'bg-purple-100 text-purple-700',
        label: 'Paciente',
      };
    }

    if (safeType.includes('procedure')) {
      return {
        icon: Stethoscope,
        color: 'bg-orange-100 text-orange-700',
        label: 'Procedimento',
      };
    }

    if (safeType.includes('reminder')) {
      return {
        icon: Bell,
        color: 'bg-yellow-100 text-yellow-700',
        label: 'Lembrete',
      };
    }

    return {
      icon: Clock,
      color: 'bg-gray-100 text-gray-700',
      label: 'Sistema',
    };
  }

  function renderFilterButton(label: string, value: ActivityFilter, activeClass: string) {
    const isActive = filter === value;

    return (
      <button
        onClick={() => setFilter(value)}
        className={cn(
          'px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors border',
          isActive
            ? activeClass
            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
        )}
      >
        {label}
      </button>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex items-start gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors shrink-0"
          aria-label="Voltar"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>

        <div className="flex-1">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Histórico de Atividades</h1>
              <p className="text-sm text-gray-500 mt-1">
                Aprofunde a visualização das movimentações do sistema além do resumo exibido no dashboard.
              </p>
            </div>

            <div className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-600">
              {loading ? 'Carregando histórico...' : `${filteredActivities.length} registros exibidos`}
            </div>
          </div>
        </div>
      </div>

      {/* Barra de busca e filtros */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-xl">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              size={18}
            />
            <input
              type="text"
              placeholder="Buscar atividades ou pacientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 lg:pb-0">
            {renderFilterButton('Todas', 'all', 'bg-blue-600 text-white border-blue-600')}
            {renderFilterButton('Pagamentos', 'payments', 'bg-green-600 text-white border-green-600')}
            {renderFilterButton('Tratamentos', 'treatments', 'bg-blue-600 text-white border-blue-600')}
            {renderFilterButton('Pacientes', 'patients', 'bg-purple-600 text-white border-purple-600')}
          </div>
        </div>

        {/* Lista de atividades */}
        <div className="divide-y">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
              <p className="text-gray-500 text-sm">Carregando histórico...</p>
            </div>
          ) : filteredActivities.length > 0 ? (
            filteredActivities.map((activity) => {
              const { icon: Icon, color, label } = getActivityVisual(activity.type);

              return (
                <div
                  key={activity.id}
                  className="p-5 md:p-6 flex items-start justify-between gap-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={cn('p-3 rounded-xl shrink-0', color)}>
                      <Icon size={20} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
                          {label}
                        </span>

                        {activity.patient && (
                          <span className="inline-flex items-center rounded-full bg-white border border-gray-200 px-2.5 py-1 text-[11px] font-medium text-gray-600">
                            {activity.patient}
                          </span>
                        )}
                      </div>

                      <p className="text-sm font-bold text-gray-900 leading-tight">
                        {activity.description}
                      </p>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 mt-2">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(activity.date)}
                        </span>

                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {activity.date.toLocaleTimeString('pt-BR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                    </div>
                  </div>

                  {activity.amount && activity.amount > 0 && (
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-black text-gray-900">
                        {formatCurrency(activity.amount)}
                      </p>
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search size={24} className="text-gray-400" />
              </div>

              <p className="text-gray-600 font-medium">
                Nenhuma atividade encontrada para os filtros aplicados.
              </p>

              <button
                onClick={() => {
                  setFilter('all');
                  setSearchTerm('');
                }}
                className="mt-4 text-blue-600 font-bold hover:underline"
              >
                Limpar filtros
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}