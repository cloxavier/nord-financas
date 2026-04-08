/**
 * Página de Listagem de Pacientes.
 * Exibe uma tabela com todos os pacientes cadastrados, permitindo busca e filtragem.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  Filter, 
  User, 
  Loader2, 
  ChevronRight,
  Phone,
  Mail,
  Calendar
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/utils';

export default function PatientsPage() {
  // Estado de carregamento da lista
  const [loading, setLoading] = useState(true);
  // Lista de pacientes vindos do banco
  const [patients, setPatients] = useState<any[]>([]);
  // Termo de busca digitado pelo usuário
  const [searchTerm, setSearchTerm] = useState('');

  // Efeito para buscar os pacientes ao carregar a página
  useEffect(() => {
    fetchPatients();
  }, []);

  /**
   * Busca a lista de pacientes no banco de dados, ordenada por nome.
   */
  async function fetchPatients() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .order('full_name', { ascending: true });
      
      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      console.error('Error fetching patients:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtra a lista de pacientes localmente com base no termo de busca
  const filteredPatients = patients.filter(p => 
    p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf?.includes(searchTerm) ||
    p.phone?.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500">Gerencie o cadastro e histórico dos seus pacientes.</p>
        </div>
        <Link 
          to="/pacientes/novo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          <Plus size={20} />
          <span>Novo Paciente</span>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
        <button className="inline-flex items-center justify-center gap-2 px-4 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 font-medium transition-colors">
          <Filter size={18} />
          <span>Filtros</span>
        </button>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        {/* Desktop Table View - Hidden on Mobile */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Paciente</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Contato</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">CPF</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Cadastro</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {/* Exibe loader enquanto carrega */}
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : filteredPatients.length > 0 ? filteredPatients.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {/* Avatar com a inicial do nome */}
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                        {p.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">{p.full_name}</p>
                        <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">ID: {p.id.slice(0, 8)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {/* Telefone */}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {p.phone}
                      </div>
                      {/* E-mail */}
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Mail size={12} className="text-gray-400" />
                        {p.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 font-medium">
                    {p.cpf || '---'}
                  </td>
                  <td className="px-6 py-4">
                    {/* Data de Cadastro */}
                    <div className="flex items-center gap-2 text-xs text-gray-600">
                      <Calendar size={12} className="text-gray-400" />
                      {formatDate(p.created_at)}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {/* Link para detalhes do paciente */}
                    <Link 
                      to={`/pacientes/${p.id}`}
                      className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                    >
                      <span>Detalhes</span>
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              )) : (
                // Mensagem caso nenhum paciente seja encontrado
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Nenhum paciente encontrado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View - Hidden on Desktop */}
        <div className="md:hidden divide-y">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
            </div>
          ) : filteredPatients.length > 0 ? filteredPatients.map((p) => (
            <div key={p.id} className="p-4 space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                    {p.full_name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 leading-tight">{p.full_name}</h3>
                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">ID: {p.id.slice(0, 8)}</p>
                  </div>
                </div>
                <Link 
                  to={`/pacientes/${p.id}`}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                >
                  <ChevronRight size={20} />
                </Link>
              </div>

              <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contato</p>
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Phone size={12} className="text-gray-400" />
                      {p.phone || 'N/A'}
                    </div>
                    {p.email && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-600 truncate">
                        <Mail size={12} className="text-gray-400" />
                        <span className="truncate">{p.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Documento</p>
                  <p className="text-xs text-gray-700 font-medium">{p.cpf || '---'}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cadastro</p>
                  <div className="flex items-center gap-1.5 text-xs text-gray-600">
                    <Calendar size={12} className="text-gray-400" />
                    {formatDate(p.created_at)}
                  </div>
                </div>
              </div>

              <Link 
                to={`/pacientes/${p.id}`}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors border border-gray-100"
              >
                Ver Detalhes do Paciente
              </Link>
            </div>
          )) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">Nenhum paciente encontrado.</p>
            </div>
          )}
        </div>
        <div className="px-6 py-4 border-t bg-gray-50/50 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            Mostrando {filteredPatients.length} de {patients.length} pacientes
          </p>
        </div>
      </div>
    </div>
  );
}
