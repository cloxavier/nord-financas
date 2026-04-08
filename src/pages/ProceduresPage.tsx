/**
 * Página de Catálogo de Procedimentos.
 * Exibe uma lista de todos os procedimentos (serviços) cadastrados na clínica.
 */
import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  Plus, 
  Search, 
  Stethoscope, 
  Loader2, 
  ChevronRight,
  DollarSign,
  Tag,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatCurrency } from '../lib/utils';

export default function ProceduresPage() {
  // Estado de carregamento da lista
  const [loading, setLoading] = useState(true);
  // Lista de procedimentos vindos do banco
  const [procedures, setProcedures] = useState<any[]>([]);
  // Termo de busca digitado pelo usuário
  const [searchTerm, setSearchTerm] = useState('');

  // Efeito para buscar os procedimentos ao carregar a página
  useEffect(() => {
    fetchProcedures();
  }, []);

  /**
   * Busca a lista de procedimentos no banco de dados, ordenada por nome.
   */
  async function fetchProcedures() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('procedure_catalog')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setProcedures(data || []);
    } catch (error) {
      console.error('Error fetching procedures:', error);
    } finally {
      setLoading(false);
    }
  }

  // Filtra a lista de procedimentos localmente com base no termo de busca
  const filteredProcedures = procedures.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Catálogo de Procedimentos</h1>
          <p className="text-sm text-gray-500">Defina os serviços e preços da sua clínica.</p>
        </div>
        <Link 
          to="/procedimentos/novo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          <Plus size={20} />
          <span>Novo Procedimento</span>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou categoria..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Mapeia e exibe cada procedimento filtrado */}
          {filteredProcedures.length > 0 ? filteredProcedures.map((p) => (
            <div key={p.id} className="bg-white p-6 rounded-xl border shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
              {/* Badge de Status (Ativo/Inativo) */}
              <div className="absolute top-0 right-0 p-4">
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-bold uppercase rounded-full",
                  p.is_active ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                )}>
                  {p.is_active ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              {/* Ícone do Procedimento */}
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-4 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                <Stethoscope size={24} />
              </div>
              {/* Nome do Procedimento */}
              <h3 className="font-bold text-gray-900 text-lg line-clamp-1">{p.name}</h3>
              {/* Categoria */}
              <div className="flex items-center gap-2 mt-1">
                <Tag size={12} className="text-gray-400" />
                <span className="text-xs text-gray-500 font-medium">{p.category || 'Geral'}</span>
              </div>
              {/* Descrição Curta */}
              <p className="text-sm text-gray-500 mt-3 line-clamp-2 h-10">
                {p.description || 'Sem descrição disponível.'}
              </p>
              {/* Rodapé do Card com Valor e Link */}
              <div className="mt-6 flex items-center justify-between pt-4 border-t">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Valor Sugerido</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(p.default_price)}</p>
                </div>
                <Link 
                  to={`/procedimentos/${p.id}`} 
                  className="inline-flex items-center gap-1 text-sm font-bold text-gray-600 hover:text-blue-600 transition-colors"
                >
                  <span>Detalhes</span>
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          )) : (
            // Mensagem caso nenhum procedimento seja encontrado
            <div className="col-span-full py-12 text-center bg-white rounded-xl border border-dashed">
              <p className="text-gray-500">Nenhum procedimento encontrado.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
