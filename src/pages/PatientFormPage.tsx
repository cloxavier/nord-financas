/**
 * Página de Formulário de Paciente.
 * Permite o cadastro de novos pacientes ou a edição de pacientes existentes.
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Loader2, User, Phone, Mail, CreditCard, Calendar, MapPin, FileText } from 'lucide-react';

export default function PatientFormPage() {
  // Obtém o ID do paciente da URL (se estiver editando)
  const { id } = useParams();
  // Hook para navegação entre páginas
  const navigate = useNavigate();
  // Verifica se a operação atual é de edição
  const isEdit = Boolean(id);
  
  // Estado para controlar o carregamento inicial dos dados
  const [loading, setLoading] = useState(isEdit);
  // Estado para controlar o processo de salvamento
  const [saving, setSaving] = useState(false);
  // Estado que armazena os dados do formulário
  const [formData, setFormData] = useState({
    full_name: '',
    cpf: '',
    phone: '',
    email: '',
    birth_date: '',
    address: '',
    notes: ''
  });

  // Efeito para carregar os dados do paciente caso seja uma edição
  useEffect(() => {
    if (isEdit) {
      fetchPatient();
    }
  }, [id]);

  /**
   * Busca os dados do paciente no banco de dados.
   */
  async function fetchPatient() {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (data) {
        setFormData(data);
      }
    } catch (error) {
      console.error('Error fetching patient:', error);
      alert('Erro ao carregar paciente.');
      navigate('/pacientes');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lida com a submissão do formulário (Criação ou Atualização).
   * @param e Evento de formulário
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Prepara os dados para salvar, tratando campos vazios como null
      const dataToSave = { 
        ...formData,
        updated_at: new Date().toISOString()
      };
      if (!dataToSave.cpf) (dataToSave as any).cpf = null;
      if (!dataToSave.birth_date) (dataToSave as any).birth_date = null;

      if (isEdit && id) {
        // Atualiza o paciente existente
        const { error } = await supabase
          .from('patients')
          .update(dataToSave)
          .eq('id', id);

        if (error) throw error;
        
        // Registra a atividade de atualização
        const { logActivity } = await import('../lib/activities');
        await logActivity('patient_updated', `Dados do paciente ${formData.full_name} atualizados`, { entity_id: id });
        
        navigate(`/pacientes/${id}`);
      } else {
        // Insere um novo paciente
        const { data, error } = await supabase
          .from('patients')
          .insert([{ ...dataToSave, created_at: new Date().toISOString() }])
          .select()
          .single();

        if (error) throw error;
        
        // Registra a atividade de criação
        if (data) {
          const { logActivity } = await import('../lib/activities');
          await logActivity('patient_created', `Paciente ${formData.full_name} cadastrado`, { entity_id: data.id });
          
          // Redireciona para a página de detalhes do novo paciente
          navigate(`/pacientes/${data.id}`);
        }
      }
    } catch (error: any) {
      console.error('Error saving patient:', error);
      alert(error.message || 'Erro ao salvar paciente.');
    } finally {
      setSaving(false);
    }
  };

  // Exibe o loader enquanto os dados estão sendo carregados
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de voltar */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{isEdit ? 'Editar Paciente' : 'Novo Paciente'}</h1>
          <p className="text-sm text-gray-500">Preencha os dados cadastrais do paciente.</p>
        </div>
      </div>

      {/* Formulário de Cadastro/Edição */}
      <form onSubmit={handleSubmit} className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="p-6 md:p-8 space-y-8">
          {/* Seção de Informações Pessoais */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <User size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Informações Pessoais</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome Completo *</label>
                <input
                  type="text"
                  required
                  value={formData.full_name ?? ''}
                  onChange={e => setFormData({...formData, full_name: e.target.value})}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  placeholder="Nome completo do paciente"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">CPF</label>
                <div className="relative">
                  <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={formData.cpf ?? ''}
                    onChange={e => setFormData({...formData, cpf: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="000.000.000-00"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Data de Nascimento</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="date"
                    value={formData.birth_date ?? ''}
                    onChange={e => setFormData({...formData, birth_date: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Seção de Contato e Endereço */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <Phone size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Contato e Endereço</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Telefone / WhatsApp</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="tel"
                    value={formData.phone ?? ''}
                    onChange={e => setFormData({...formData, phone: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-mail</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="email"
                    value={formData.email ?? ''}
                    onChange={e => setFormData({...formData, email: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Endereço</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                  <input
                    type="text"
                    value={formData.address ?? ''}
                    onChange={e => setFormData({...formData, address: e.target.value})}
                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                    placeholder="Rua, número, bairro, cidade - UF"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Seção de Observações */}
          <section>
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <FileText size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Observações Adicionais</h3>
            </div>
            <div>
              <textarea
                rows={4}
                value={formData.notes ?? ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="Alergias, histórico médico, observações financeiras..."
              />
            </div>
          </section>
        </div>

        {/* Rodapé do formulário com botões de ação */}
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
            <span>{isEdit ? 'Salvar Alterações' : 'Cadastrar Paciente'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
