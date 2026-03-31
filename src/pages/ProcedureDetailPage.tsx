/**
 * Página de Detalhes do Procedimento.
 * Exibe as informações completas de um procedimento do catálogo.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Stethoscope, 
  Tag, 
  DollarSign, 
  FileText,
  Loader2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';

/**
 * Página de Detalhes do Procedimento.
 * Exibe as informações completas de um procedimento do catálogo.
 */
export default function ProcedureDetailPage() {
  // Obtém o ID do procedimento da URL
  const { id } = useParams();
  // Hook para navegação
  const navigate = useNavigate();
  // Estado de carregamento da página
  const [loading, setLoading] = useState(true);
  // Dados do procedimento
  const [procedure, setProcedure] = useState<any>(null);

  // Efeito para buscar os dados do procedimento ao carregar a página
  useEffect(() => {
    fetchProcedure();
  }, [id]);

  /**
   * Busca os dados do procedimento no banco de dados.
   */
  async function fetchProcedure() {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('procedure_catalog')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      setProcedure(data);
    } catch (error) {
      console.error('Error fetching procedure details:', error);
      navigate('/procedimentos');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lida com a exclusão do procedimento.
   */
  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Tem certeza que deseja excluir este procedimento?')) return;
    
    try {
      const { error } = await supabase
        .from('procedure_catalog')
        .delete()
        .eq('id', id);

      if (error) throw error;
      navigate('/procedimentos');
    } catch (error) {
      console.error('Error deleting procedure:', error);
      alert('Erro ao excluir procedimento.');
    }
  };

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
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/procedimentos')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border shadow-sm">
              <Stethoscope size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{procedure.name}</h1>
              <p className="text-sm text-gray-500">Cadastrado em {formatDate(procedure.created_at)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to={`/procedimentos/${id}/editar`}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            <Edit size={18} />
            <span>Editar</span>
          </Link>
          <button 
            onClick={handleDelete}
            className="inline-flex items-center gap-2 px-4 py-2 border border-red-100 text-red-600 font-semibold hover:bg-red-50 transition-colors"
          >
            <Trash2 size={18} />
            <span>Excluir</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Card: Descrição do Procedimento */}
          <div className="bg-white rounded-xl border shadow-sm p-8">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <FileText size={18} className="text-blue-600" />
              Descrição do Procedimento
            </h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">
              {procedure.description || 'Nenhuma descrição detalhada cadastrada para este procedimento.'}
            </p>
          </div>

          {/* Card: Análise Financeira */}
          <div className="bg-white rounded-xl border shadow-sm p-8">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <DollarSign size={18} className="text-blue-600" />
              Análise Financeira
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {/* Preço de Venda */}
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Preço de Venda</p>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(procedure.default_price)}</p>
              </div>
              {/* Custo Estimado */}
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Custo Estimado</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(procedure.default_cost || 0)}</p>
              </div>
              {/* Margem Bruta */}
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Margem Bruta</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrency(procedure.default_price - (procedure.default_cost || 0))}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <Tag size={18} className="text-blue-600" />
              Atributos
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Categoria</span>
                <span className="text-sm font-bold text-gray-900">{procedure.category}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Status</span>
                {procedure.is_active ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                    <CheckCircle size={12} />
                    Ativo
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700">
                    <XCircle size={12} />
                    Inativo
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500">Última Atualização</span>
                <span className="text-sm font-medium text-gray-900">{formatDate(procedure.updated_at)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
