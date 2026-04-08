/**
 * Página de Atividades Recentes.
 * Consolida logs de auditoria, registros de pagamentos, novos tratamentos e pacientes em um feed unificado.
 */
import React, { useState, useEffect } from 'react';
import { 
  Users, 
  ClipboardList, 
  TrendingUp, 
  AlertCircle,
  Calendar,
  Loader2,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle,
  Clock,
  Stethoscope,
  Bell
} from 'lucide-react';
import { formatCurrency, cn, formatDate } from '../lib/utils';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

/**
 * Página de Atividades Recentes.
 * Consolida logs de auditoria, registros de pagamentos, novos tratamentos e pacientes em um feed unificado.
 */
export default function ActivitiesPage() {
  const navigate = useNavigate();
  // Estado de carregamento
  const [loading, setLoading] = useState(true);
  // Lista de atividades normalizadas
  const [activities, setActivities] = useState<any[]>([]);
  // Filtro de tipo de atividade (all, payments, treatments, patients)
  const [filter, setFilter] = useState('all');
  // Termo de busca na descrição da atividade
  const [searchTerm, setSearchTerm] = useState('');

  // Efeito para carregar as atividades na montagem do componente
  useEffect(() => {
    fetchActivities();
  }, []);

  /**
   * Busca e normaliza atividades de diversas fontes (audit_logs, installments, treatments, patients).
   */
  async function fetchActivities() {
    setLoading(true);
    try {
      // Busca dados de múltiplas tabelas em paralelo para compor o feed
      const [
        { data: auditLogs },
        { data: recentTreatments },
        { data: recentPatients },
        { data: paidInstallments }
      ] = await Promise.all([
        // Logs de auditoria (ações genéricas do sistema)
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
        // Novos tratamentos
        supabase.from('treatments').select('*').order('created_at', { ascending: false }).limit(20),
        // Novos pacientes
        supabase.from('patients').select('*').order('created_at', { ascending: false }).limit(20),
        // Parcelas pagas recentemente (para simular registros de pagamento)
        supabase.from('installments').select('*').eq('status', 'paid').order('payment_date', { ascending: false }).limit(20)
      ]);

      const normalizedActivities: any[] = [];

      // 1. Normaliza Audit Logs
      auditLogs?.forEach(log => {
        normalizedActivities.push({
          id: `audit-${log.id}`,
          type: log.action,
          description: log.description || log.action,
          date: new Date(log.created_at),
          metadata: { description: log.description, entity_id: log.entity_id }
        });
      });

      // 2. Normaliza Pagamentos (Baseado em installments pagos)
      paidInstallments?.forEach(p => {
        const id = `payment-${p.id}`;
        // Evita duplicidade se já estiver no audit log (opcional, dependendo de como os logs são gerados)
        normalizedActivities.push({
          id,
          type: 'payment_registered',
          description: `Pagamento de ${formatCurrency(p.amount_paid || p.amount)} recebido - ${p.patient_name_snapshot || 'Paciente'}`,
          date: new Date(p.payment_date),
          amount: p.amount_paid || p.amount,
          patient: p.patient_name_snapshot
        });
      });

      // 3. Normaliza Tratamentos
      recentTreatments?.forEach(t => {
        const id = `treatment-${t.id}`;
        // Verifica se já não existe um log de criação para este tratamento
        if (!normalizedActivities.find(a => a.metadata?.entity_id === t.id && a.type === 'treatment_created')) {
          normalizedActivities.push({
            id,
            type: 'treatment_created',
            description: `Novo tratamento criado para ${t.patient_name_snapshot}`,
            date: new Date(t.created_at),
            amount: t.total_amount,
            patient: t.patient_name_snapshot
          });
        }
      });

      // 4. Normaliza Pacientes
      recentPatients?.forEach(p => {
        const id = `patient-${p.id}`;
        if (!normalizedActivities.find(a => a.metadata?.entity_id === p.id && a.type === 'patient_created')) {
          normalizedActivities.push({
            id,
            type: 'patient_created',
            description: `Novo paciente cadastrado: ${p.full_name}`,
            date: new Date(p.created_at),
            patient: p.full_name
          });
        }
      });

      // Sort by date descending
      normalizedActivities.sort((a, b) => b.date.getTime() - a.date.getTime());
      
      setActivities(normalizedActivities);
    } catch (error) {
      console.error('Error fetching activities:', error);
    } finally {
      setLoading(false);
    }
  }

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = activity.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (activity.patient && activity.patient.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (filter === 'all') return matchesSearch;
    if (filter === 'payments') return matchesSearch && (activity.type === 'payment_registered' || activity.type.includes('payment'));
    if (filter === 'treatments') return matchesSearch && (activity.type === 'treatment_created' || activity.type === 'treatment_cancelled' || activity.type.includes('treatment'));
    if (filter === 'patients') return matchesSearch && (activity.type === 'patient_created' || activity.type.includes('patient'));
    
    return matchesSearch;
  });

  const getActivityIcon = (type: string) => {
    const t = type.toLowerCase();
    if (t.includes('payment')) return { icon: TrendingUp, color: 'bg-green-100 text-green-700' };
    if (t.includes('treatment')) return { icon: ClipboardList, color: 'bg-blue-100 text-blue-700' };
    if (t.includes('patient')) return { icon: Users, color: 'bg-purple-100 text-purple-700' };
    if (t.includes('procedure')) return { icon: Stethoscope, color: 'bg-orange-100 text-orange-700' };
    if (t.includes('reminder')) return { icon: Bell, color: 'bg-yellow-100 text-yellow-700' };
    return { icon: Clock, color: 'bg-gray-100 text-gray-700' };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Atividades Recentes</h1>
          <p className="text-sm text-gray-500">Histórico completo de ações e eventos do sistema.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar atividades ou pacientes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"
            />
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
            <button
              onClick={() => setFilter('all')}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                filter === 'all' ? "bg-blue-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
              )}
            >
              Todas
            </button>
            <button
              onClick={() => setFilter('payments')}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                filter === 'payments' ? "bg-green-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
              )}
            >
              Pagamentos
            </button>
            <button
              onClick={() => setFilter('treatments')}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                filter === 'treatments' ? "bg-blue-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
              )}
            >
              Tratamentos
            </button>
            <button
              onClick={() => setFilter('patients')}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors",
                filter === 'patients' ? "bg-purple-600 text-white" : "bg-white text-gray-600 border hover:bg-gray-50"
              )}
            >
              Pacientes
            </button>
          </div>
        </div>

        <div className="divide-y">
          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-4">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
              <p className="text-gray-500 text-sm">Carregando histórico...</p>
            </div>
          ) : filteredActivities.length > 0 ? (
            filteredActivities.map((activity) => {
              const { icon: Icon, color } = getActivityIcon(activity.type);
              return (
                <div key={activity.id} className="p-6 flex items-start justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-start gap-4">
                    <div className={cn("p-3 rounded-xl shrink-0", color)}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 leading-tight mb-1">{activity.description}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Calendar size={12} />
                          {formatDate(activity.date)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} />
                          {activity.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                  {activity.amount && (
                    <div className="text-right shrink-0 ml-4">
                      <p className="text-sm font-black text-gray-900">{formatCurrency(activity.amount)}</p>
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
              <p className="text-gray-500 font-medium">Nenhuma atividade encontrada para os filtros aplicados.</p>
              <button 
                onClick={() => {setFilter('all'); setSearchTerm('');}}
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
