/**
 * Página de Gestão de Cobranças.
 * Permite visualizar e gerenciar parcelas em atraso ou próximas do vencimento, facilitando a cobrança.
 */
import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  MessageSquare, 
  Phone, 
  Calendar, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  MoreVertical,
  Loader2,
  DollarSign,
  User,
  ExternalLink,
  Copy,
  Bell
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isInstallmentOverdue, resolvePatientName } from '../lib/businessRules';

/**
 * Página de Gestão de Cobranças.
 * Permite visualizar e gerenciar parcelas em atraso ou próximas do vencimento, facilitando a cobrança.
 */
export default function BillingPage() {
  // Estado de carregamento dos dados
  const [loading, setLoading] = useState(true);
  // Lista de parcelas para cobrança
  const [installments, setInstallments] = useState<any[]>([]);
  // Termo de busca por nome do paciente
  const [searchTerm, setSearchTerm] = useState('');
  // Filtro de status (overdue = em atraso, pending = pendente)
  const [statusFilter, setStatusFilter] = useState('overdue');

  // Efeito para buscar os dados sempre que o filtro de status mudar
  useEffect(() => {
    fetchBillingData();
  }, [statusFilter]);

  /**
   * Busca os dados de faturamento (parcelas) no banco de dados.
   */
  async function fetchBillingData() {
    setLoading(true);
    try {
      // Buscamos todas as parcelas não pagas/canceladas para aplicar a regra canônica
      const { data, error } = await supabase
        .from('installments')
        .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name, phone))')
        .not('status', 'in', '("paid","cancelled")')
        .order('due_date', { ascending: true });
      
      if (error) throw error;

      // Processa os dados com regras canônicas
      const processed = (data || []).map(item => ({
        ...item,
        isOverdue: isInstallmentOverdue(item),
        patientName: resolvePatientName(item),
        patientPhone: item.treatments?.patients?.phone || item.patient_phone_snapshot || '-'
      }));

      // Filtra de acordo com o status selecionado na UI
      const filteredByStatus = processed.filter(item => {
        if (statusFilter === 'overdue') return item.isOverdue;
        if (statusFilter === 'pending') return !item.isOverdue; // Próximos vencimentos
        return true;
      });

      setInstallments(filteredByStatus);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtra as parcelas localmente pelo termo de busca (nome do paciente)
  const filteredInstallments = installments.filter(inst => 
    inst.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Gera um link do WhatsApp com uma mensagem de cobrança pré-preenchida.
   */
  const getWhatsAppLink = (phone: string, name: string, amount: number, dueDate: string) => {
    const message = `Olá ${name}, tudo bem? Aqui é da Nord Finanças. Notamos que sua parcela de ${formatCurrency(amount)} com vencimento em ${formatDate(dueDate)} ainda não consta como paga. Poderia nos enviar o comprovante ou gostaria de uma nova chave PIX?`;
    return `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  };

  /**
   * Copia a mensagem de cobrança para a área de transferência.
   */
  const copyBillingMessage = (name: string, amount: number, dueDate: string) => {
    const message = `Olá ${name}, tudo bem? Aqui é da Nord Finanças. Notamos que sua parcela de ${formatCurrency(amount)} com vencimento em ${formatDate(dueDate)} ainda não consta como paga. Poderia nos enviar o comprovante ou gostaria de uma nova chave PIX?`;
    navigator.clipboard.writeText(message);
    alert('Mensagem copiada para a área de transferência!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Cobranças</h1>
          <p className="text-sm text-gray-500">Acompanhe parcelas em atraso e realize cobranças manuais.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg border shadow-sm flex">
            <button 
              onClick={() => setStatusFilter('overdue')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                statusFilter === 'overdue' ? "bg-red-600 text-white shadow-md shadow-red-100" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Em Atraso
            </button>
            <button 
              onClick={() => setStatusFilter('pending')}
              className={cn(
                "px-4 py-1.5 rounded-md text-sm font-bold transition-all",
                statusFilter === 'pending' ? "bg-blue-600 text-white shadow-md shadow-blue-100" : "text-gray-500 hover:text-gray-700"
              )}
            >
              Próximos Vencimentos
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
              <input 
                type="text" 
                placeholder="Buscar por paciente..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Paciente</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Ações de Cobrança</th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                      </td>
                    </tr>
                  ) : filteredInstallments.length > 0 ? filteredInstallments.map((inst) => (
                    <tr key={inst.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                            {inst.patientName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{inst.patientName}</p>
                            <p className="text-xs text-gray-500">{inst.patientPhone}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className={inst.isOverdue ? "text-red-500" : "text-gray-400"} />
                          <span className={cn(
                            "text-sm font-bold",
                            inst.isOverdue ? "text-red-600" : "text-gray-700"
                          )}>
                            {formatDate(inst.due_date)}
                          </span>
                        </div>
                        {inst.isOverdue && (
                          <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mt-0.5">Atrasado</p>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-gray-900">{formatCurrency(inst.amount)}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Parcela {inst.installment_number}</p>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a 
                            href={getWhatsAppLink(inst.patientPhone, inst.patientName, inst.amount, inst.due_date)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                            title="Abrir WhatsApp"
                          >
                            <Phone size={18} />
                          </a>
                          <button 
                            onClick={() => copyBillingMessage(inst.patientName, inst.amount, inst.due_date)}
                            className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                            title="Copiar Mensagem"
                          >
                            <Copy size={18} />
                          </button>
                          <button 
                            className="p-2 bg-yellow-50 text-yellow-600 rounded-lg hover:bg-yellow-100 transition-colors"
                            title="Marcar Lembrete"
                          >
                            <Bell size={18} />
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link 
                          to={`/parcelas/${inst.id}`}
                          className="text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          <ExternalLink size={18} />
                        </Link>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className="text-gray-500">Nenhuma cobrança encontrada para este filtro.</p>
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
                <div key={inst.id} className="p-4 space-y-4">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                        {inst.patientName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{inst.patientName}</p>
                        <p className="text-xs text-gray-500">{inst.patientPhone}</p>
                      </div>
                    </div>
                    <Link 
                      to={`/parcelas/${inst.id}`}
                      className="p-2 text-gray-400 hover:text-blue-600"
                    >
                      <ExternalLink size={18} />
                    </Link>
                  </div>

                  <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-50">
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Vencimento</p>
                      <div className="flex items-center gap-2">
                        <Calendar size={14} className={inst.isOverdue ? "text-red-500" : "text-gray-400"} />
                        <span className={cn(
                          "text-sm font-bold",
                          inst.isOverdue ? "text-red-600" : "text-gray-700"
                        )}>
                          {formatDate(inst.due_date)}
                        </span>
                      </div>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">Valor</p>
                      <p className="text-sm font-bold text-gray-900">{formatCurrency(inst.amount)}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2">
                    <div className="flex gap-2">
                      <a 
                        href={getWhatsAppLink(inst.patientPhone, inst.patientName, inst.amount, inst.due_date)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold"
                      >
                        <Phone size={14} />
                        WhatsApp
                      </a>
                      <button 
                        onClick={() => copyBillingMessage(inst.patientName, inst.amount, inst.due_date)}
                        className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                      >
                        <Copy size={16} />
                      </button>
                    </div>
                    {inst.isOverdue && (
                      <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">Atrasado</span>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-12 text-center">
                  <p className="text-gray-500">Nenhuma cobrança encontrada.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600" />
              Resumo do Atraso
            </h3>
            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">Total Inadimplente</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatCurrency(installments.filter(i => i.isOverdue).reduce((sum, i) => sum + (i.amount - (i.amount_paid || 0)), 0))}
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Parcelas em atraso</span>
                  <span className="font-bold text-gray-900">{installments.filter(i => i.isOverdue).length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pacientes devedores</span>
                  <span className="font-bold text-gray-900">
                    {new Set(installments.filter(i => i.isOverdue).map(i => i.treatments?.patient_id || i.patient_id)).size}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
            <h3 className="font-bold text-lg mb-2">Dica de Cobrança</h3>
            <p className="text-sm text-blue-100 leading-relaxed">
              Cobranças realizadas nos primeiros 5 dias de atraso têm 80% mais chance de sucesso. Use o WhatsApp para um contato mais pessoal.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
