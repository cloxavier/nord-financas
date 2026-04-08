/**
 * Página de Listagem de Parcelas.
 * Exibe todas as parcelas de tratamentos, permitindo busca por paciente e filtragem por status.
 * Inclui um resumo financeiro (vencidas, a vencer, recebidas).
 */
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  CreditCard, 
  Filter, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Loader2, 
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isInstallmentOverdue, resolvePatientName } from '../lib/businessRules';

/**
 * Página de Listagem de Parcelas.
 * Exibe todas as parcelas de tratamentos, permitindo busca por paciente e filtragem por status.
 * Inclui um resumo financeiro (vencidas, a vencer, recebidas).
 */
export default function InstallmentsPage() {
  // Estados para controle de carregamento e dados das parcelas
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<any[]>([]);
  // Estados para busca e filtragem
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Busca as parcelas sempre que o filtro de status mudar
  useEffect(() => {
    fetchInstallments();
  }, [statusFilter]);

  /**
   * Busca as parcelas no banco de dados, incluindo informações do tratamento e do paciente.
   */
  async function fetchInstallments() {
    setLoading(true);
    try {
      let query = supabase
        .from('installments')
        .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name))')
        .order('due_date', { ascending: true });

      // Aplica o filtro de status se não for "todos"
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;
      
      if (error) throw error;

      // Processa os dados com regras canônicas
      const processed = (data || []).map(item => ({
        ...item,
        isOverdue: isInstallmentOverdue(item),
        patientName: resolvePatientName(item)
      }));

      setInstallments(processed);
    } catch (error) {
      console.error('Error fetching installments:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtra as parcelas localmente com base no nome do paciente ou ID do tratamento
  const filteredInstallments = installments.filter(inst => {
    const patientName = inst.patientName.toLowerCase();
    const treatmentId = (inst.treatment_id || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    return patientName.includes(search) || treatmentId.includes(search);
  });

  // Calcula estatísticas financeiras para os cards de resumo usando regras canônicas
  const stats = {
    overdue: installments.filter(i => i.isOverdue).reduce((sum, i) => sum + (i.amount - (i.amount_paid || 0)), 0),
    pending: installments.filter(i => i.status === 'pending' && !i.isOverdue).reduce((sum, i) => sum + (i.amount - (i.amount_paid || 0)), 0),
    paid: installments.filter(i => i.status === 'paid').reduce((sum, i) => sum + (i.amount_paid || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcelas</h1>
          <p className="text-sm text-gray-500">Controle o recebimento das parcelas de tratamentos.</p>
        </div>
      </div>

      {/* Cards de Resumo Financeiro */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Card: Parcelas Vencidas */}
        <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">Vencidas</span>
            <AlertCircle size={18} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.overdue)}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {installments.filter(i => i.isOverdue).length} parcelas em atraso
          </p>
        </div>
        {/* Card: Parcelas a Vencer */}
        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">A Vencer</span>
            <Clock size={18} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.pending)}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {installments.filter(i => i.status === 'pending' && !i.isOverdue).length} parcelas previstas
          </p>
        </div>
        {/* Card: Parcelas Recebidas */}
        <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-green-500 uppercase tracking-wider">Recebidas</span>
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.paid)}</p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {installments.filter(i => i.status === 'paid').length} parcelas pagas
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por paciente ou ID do tratamento..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
        >
          <option value="all">Todos os Status</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="overdue">Atrasado</option>
        </select>
      </div>

      {/* Listagem de Parcelas */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Paciente / Tratamento</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Parcela</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredInstallments.length > 0 ? filteredInstallments.map((inst) => (
                <tr key={inst.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className={cn(
                      "text-sm font-bold",
                      inst.isOverdue ? "text-red-600" : "text-gray-700"
                    )}>
                      {formatDate(inst.due_date)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{inst.patientName}</p>
                    <p className="text-xs text-gray-500">Tratamento #{inst.treatment_id?.slice(0, 8)}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                    {inst.installment_number}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold text-gray-900">
                    {formatCurrency(inst.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      inst.status === 'paid' ? "bg-green-100 text-green-700" : 
                      inst.isOverdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                    )}>
                      {inst.status === 'paid' ? <CheckCircle size={12} /> : 
                       inst.isOverdue ? <AlertCircle size={12} /> : <Clock size={12} />}
                      {inst.status === 'paid' ? 'Pago' : inst.isOverdue ? 'Atrasado' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/parcelas/${inst.id}`}
                      className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span>Dar Baixa</span>
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Nenhuma parcela encontrada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden divide-y">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
            </div>
          ) : filteredInstallments.length > 0 ? filteredInstallments.map((inst) => (
            <div key={inst.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-bold text-gray-900">{inst.patientName}</p>
                  <p className="text-[10px] text-gray-500">Tratamento #{inst.treatment_id?.slice(0, 8)}</p>
                </div>
                <span className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider",
                  inst.status === 'paid' ? "bg-green-100 text-green-700" : 
                  inst.isOverdue ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                )}>
                  {inst.status === 'paid' ? 'Pago' : inst.isOverdue ? 'Atrasado' : 'Pendente'}
                </span>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400 uppercase font-bold text-[9px]">Vencimento</p>
                  <p className={cn("font-bold", inst.isOverdue ? "text-red-600" : "text-gray-700")}>
                    {formatDate(inst.due_date)}
                  </p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase font-bold text-[9px]">Parcela</p>
                  <p className="font-bold text-gray-700">{inst.installment_number}ª Parcela</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase font-bold text-[9px]">Valor</p>
                  <p className="font-bold text-gray-900">{formatCurrency(inst.amount)}</p>
                </div>
              </div>

              <Link 
                to={`/parcelas/${inst.id}`}
                className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
              >
                <span>Dar Baixa / Detalhes</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          )) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">Nenhuma parcela encontrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
