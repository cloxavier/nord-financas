/**
 * Página de Formulário de Procedimento.
 * Permite criar um novo procedimento ou editar um existente no catálogo.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Loader2, Stethoscope, Tag, DollarSign, FileText } from 'lucide-react';
import { logActivity } from '../lib/activities';

/**
 * Interface para os dados do procedimento no catálogo.
 */
interface ProcedureData {
  id?: string;
  name: string;
  category: string;
  default_price: number;
  default_cost: number;
  description: string;
  is_active: boolean;
  created_at?: any;
  updated_at?: any;
}

export default function ProcedureFormPage() {
  // Obtém o ID do procedimento da URL (se estiver editando)
  const { id } = useParams();
  // Hook para navegação
  const navigate = useNavigate();
  // Verifica se o modo é de edição
  const isEdit = Boolean(id);
  
  // Estado de carregamento inicial (apenas se estiver editando)
  const [loading, setLoading] = useState(isEdit);
  // Estado para indicar se o formulário está sendo salvo
  const [saving, setSaving] = useState(false);
  // Estado dos dados do formulário
  const [formData, setFormData] = useState<ProcedureData>({
    name: '',
    category: '',
    default_price: 0,
    default_cost: 0,
    description: '',
    is_active: true
  });

  // Efeito para buscar os dados do procedimento se estiver no modo de edição
  useEffect(() => {
    if (isEdit && id) {
      fetchProcedure(id);
    }
  }, [id]);

  /**
   * Busca os dados do procedimento no banco de dados.
   * @param procedureId ID do procedimento a ser buscado.
   */
  async function fetchProcedure(procedureId: string) {
    try {
      const { data, error } = await supabase
        .from('procedure_catalog')
        .select('*')
        .eq('id', procedureId)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data as ProcedureData);
      }
    } catch (error) {
      console.error('Error fetching procedure:', error);
      navigate('/procedimentos');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lida com a submissão do formulário.
   * @param e Evento de submissão do formulário.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Prepara os dados para salvar, definindo uma categoria padrão se estiver vazia
      const dataToSave = {
        name: formData.name,
        category: formData.category || 'Geral',
        default_price: formData.default_price,
        default_cost: formData.default_cost,
        description: formData.description,
        is_active: formData.is_active,
        updated_at: new Date().toISOString()
      };

      if (isEdit && id) {
        // Atualiza o procedimento existente
        const { error } = await supabase
          .from('procedure_catalog')
          .update(dataToSave)
          .eq('id', id);

        if (error) throw error;
      } else {
        // Insere um novo procedimento
        const { data, error } = await supabase
          .from('procedure_catalog')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;
        
        // Registra a atividade de criação
        if (data) {
          await logActivity('procedure_created', `Procedimento ${formData.name} cadastrado no catálogo`, { entity_id: data.id });
        }
      }
      // Navega de volta para a lista de procedimentos
      navigate('/procedimentos');
    } catch (error: any) {
      console.error('Error saving procedure:', error);
      alert(error.message || 'Erro ao salvar procedimento.');
    } finally {
      setSaving(false);
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
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar Procedimento' : 'Novo Procedimento'}</h1>
          <p className="text-sm text-gray-500">Defina os detalhes e valores do serviço.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Stethoscope size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Identificação</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Procedimento *</label>
                <input
                  type="text"
                  required
                  value={formData.name ?? ''}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Ex: Limpeza, Canal, Implante..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <select
                    value={formData.category ?? ''}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none appearance-none bg-white"
                  >
                    <option value="">Selecione uma categoria (opcional)</option>
                    <option value="Geral">Geral</option>
                    <option value="Preventivo">Preventivo</option>
                    <option value="Estético">Estético</option>
                    <option value="Cirúrgico">Cirúrgico</option>
                    <option value="Ortodôntico">Ortodôntico</option>
                    <option value="Prótese">Prótese</option>
                    <option value="Outros">Outros</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="sr-only peer" 
                    checked={formData.is_active}
                    onChange={e => setFormData({...formData, is_active: e.target.checked})}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                  <span className="ml-3 text-sm font-medium text-gray-700">Procedimento Ativo</span>
                </label>
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <DollarSign size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Valores Financeiros</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Preço de Venda (R$) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={formData.default_price ?? ''}
                  onChange={e => setFormData({...formData, default_price: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0,00"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Custo Estimado (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.default_cost ?? ''}
                  onChange={e => setFormData({...formData, default_cost: parseFloat(e.target.value)})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="0,00"
                />
              </div>
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <FileText size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Descrição</h3>
            </div>
            <div>
              <textarea
                rows={4}
                value={formData.description ?? ''}
                onChange={e => setFormData({...formData, description: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Descreva os detalhes técnicos ou orientações do procedimento..."
              />
            </div>
          </section>
        </div>

        <div className="px-8 py-4 bg-gray-50 border-t flex items-center justify-end gap-4">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="px-6 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-8 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={18} />}
            <span>{isEdit ? 'Salvar Alterações' : 'Cadastrar Procedimento'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
