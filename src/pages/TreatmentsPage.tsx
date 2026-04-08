/**
 * Página de Listagem de Tratamentos.
 * Exibe todos os tratamentos cadastrados, permitindo busca e filtragem por status.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  ClipboardList, 
  Filter, 
  Loader2, 
  ChevronRight,
  User,
  Calendar,
  DollarSign
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency, formatDate } from '../lib/utils';
import { resolvePatientName } from '../lib/businessRules';

export default function TreatmentsPage() {
  // Estado para controlar o carregamento dos dados
  const [loading, setLoading] = useState(true);
  // Estado que armazena a lista de tratamentos
  const [treatments, setTreatments] = useState<any[]>([]);
  // Estado para o termo de busca
  const [searchTerm, setSearchTerm] = useState('');
  // Estado para o filtro de status
  const [statusFilter, setStatusFilter] = useState('all');

  // Efeito para buscar tratamentos sempre que o filtro de status mudar
  useEffect(() => {
    fetchTreatments();
  }, [statusFilter]);

  /**
   * Busca os tratamentos no banco de dados, incluindo o nome do paciente.
   */
  async function fetchTreatments() {
    setLoading(true);
    try {
      let query = supabase
        .from('treatments')
        .select('*, patients(id, full_name)')
        .order('created_at', { ascending: false });

      // Aplica filtro de status se não for "todos"
      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Processa os dados com regras canônicas
      const processed = (data || []).map(item => ({
        ...item,
        patientName: resolvePatientName(item)
      }));

      setTreatments(processed);
    } catch (error) {
      console.error('Error fetching treatments:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtra os tratamentos localmente com base no termo de busca (nome do paciente ou ID)
  const filteredTreatments = treatments.filter(t => 
    t.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  /**
   * Retorna um componente de badge estilizado com base no status do tratamento.
   * @param status Status do tratamento
   */
  const getStatusBadge = (status: string) => {
    const styles: any = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    const labels: any = {
      draft: 'Rascunho',
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado'
    };
    return (
      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}>
        {labels[status]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho da página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tratamentos</h1>
          <p className="text-sm text-gray-500">Acompanhe os orçamentos e tratamentos em andamento.</p>
        </div>
        <Link 
          to="/tratamentos/novo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          <Plus size={20} />
          <span>Novo Tratamento</span>
        </Link>
      </div>

      {/* Barra de ferramentas: Busca e Filtro */}
      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por paciente ou ID..."
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
          <option value="draft">Orçamento</option>
          <option value="pending">Pendente</option>
          <option value="in_progress">Em Andamento</option>
          <option value="completed">Concluído</option>
          <option value="cancelled">Cancelado</option>
        </select>
      </div>

      {/* Listagem de Tratamentos */}
      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Paciente / ID</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Valor Total</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                // Exibe loader durante o carregamento
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredTreatments.length > 0 ? filteredTreatments.map((t) => (
                // Mapeia os tratamentos filtrados para linhas da tabela
                <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                        <User size={20} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{t.patientName}</p>
                        <p className="text-[10px] font-mono text-gray-400">#{t.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {getStatusBadge(t.status)}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm font-bold text-gray-900">{formatCurrency(t.total_amount)}</p>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Sub: {formatCurrency(t.subtotal)}</p>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Calendar size={14} className="text-gray-400" />
                      {formatDate(t.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link 
                      to={`/tratamentos/${t.id}`}
                      className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span>Detalhes</span>
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              )) : (
                // Exibe mensagem caso nenhum tratamento seja encontrado
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Nenhum tratamento encontrado.</p>
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
          ) : filteredTreatments.length > 0 ? filteredTreatments.map((t) => (
            <div key={t.id} className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                    <User size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-gray-900">{t.patientName}</p>
                    <p className="text-[10px] font-mono text-gray-400">#{t.id.slice(0, 8)}</p>
                  </div>
                </div>
                {getStatusBadge(t.status)}
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-gray-400 uppercase font-bold text-[9px]">Valor Total</p>
                  <p className="font-bold text-gray-900">{formatCurrency(t.total_amount)}</p>
                </div>
                <div>
                  <p className="text-gray-400 uppercase font-bold text-[9px]">Data</p>
                  <p className="font-bold text-gray-700">{formatDate(t.created_at)}</p>
                </div>
              </div>

              <Link 
                to={`/tratamentos/${t.id}`}
                className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
              >
                <span>Ver Detalhes</span>
                <ChevronRight size={14} />
              </Link>
            </div>
          )) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">Nenhum tratamento encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
