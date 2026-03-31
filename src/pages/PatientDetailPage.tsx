/**
 * Página de Detalhes do Paciente.
 * Exibe as informações cadastrais do paciente e seu histórico de tratamentos.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  MapPin, 
  ClipboardList,
  Plus,
  Loader2,
  User
} from 'lucide-react';
import { formatDate } from '../lib/utils';

export default function PatientDetailPage() {
  // Obtém o ID do paciente da URL
  const { id } = useParams();
  // Hook para navegação
  const navigate = useNavigate();
  // Estado de carregamento da página
  const [loading, setLoading] = useState(true);
  // Dados do paciente
  const [patient, setPatient] = useState<any>(null);
  // Lista de tratamentos do paciente
  const [treatments, setTreatments] = useState<any[]>([]);

  // Efeito para buscar os dados do paciente e seus tratamentos ao carregar a página
  useEffect(() => {
    fetchData();
  }, [id]);

  /**
   * Busca os dados do paciente e seus tratamentos no banco de dados.
   */
  async function fetchData() {
    if (!id) return;
    try {
      // Busca dados do paciente
      const { data: pData, error: pError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (pError) throw pError;
      setPatient(pData);

      // Busca tratamentos do paciente
      const { data: tData, error: tError } = await supabase
        .from('treatments')
        .select('*')
        .eq('patient_id', id)
        .order('created_at', { ascending: false });

      if (tError) throw tError;
      setTreatments(tData || []);
    } catch (error) {
      console.error('Error fetching patient details:', error);
      navigate('/pacientes');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lida com a exclusão do paciente.
   */
  const handleDelete = async () => {
    if (!id) return;
    if (!window.confirm('Tem certeza que deseja excluir este paciente? Esta ação não pode ser desfeita.')) return;
    
    try {
      const { error } = await supabase
        .from('patients')
        .delete()
        .eq('id', id);

      if (error) throw error;
      navigate('/pacientes');
    } catch (error) {
      console.error('Error deleting patient:', error);
      alert('Erro ao excluir paciente.');
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
          <button onClick={() => navigate('/pacientes')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold border-4 border-white shadow-sm">
              {patient.full_name.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{patient.full_name}</h1>
              <p className="text-sm text-gray-500">Paciente desde {formatDate(patient.created_at)}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link 
            to={`/pacientes/${id}/editar`}
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
        {/* Card de Informações do Paciente */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <User size={18} className="text-blue-600" />
              Dados Cadastrais
            </h3>
            <div className="space-y-4">
              {/* CPF */}
              <div className="flex items-start gap-3">
                <CreditCard className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">CPF</p>
                  <p className="text-sm text-gray-900">{patient.cpf || 'Não informado'}</p>
                </div>
              </div>
              {/* Data de Nascimento */}
              <div className="flex items-start gap-3">
                <Calendar className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Nascimento</p>
                  <p className="text-sm text-gray-900">{patient.birth_date ? formatDate(patient.birth_date) : 'Não informado'}</p>
                </div>
              </div>
              {/* Telefone */}
              <div className="flex items-start gap-3">
                <Phone className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Telefone</p>
                  <p className="text-sm text-gray-900">{patient.phone || 'Não informado'}</p>
                </div>
              </div>
              {/* E-mail */}
              <div className="flex items-start gap-3">
                <Mail className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">E-mail</p>
                  <p className="text-sm text-gray-900">{patient.email || 'Não informado'}</p>
                </div>
              </div>
              {/* Endereço */}
              <div className="flex items-start gap-3">
                <MapPin className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Endereço</p>
                  <p className="text-sm text-gray-900 leading-relaxed">{patient.address || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card de Observações */}
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
              <ClipboardList size={18} className="text-blue-600" />
              Observações
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {patient.notes || 'Nenhuma observação cadastrada.'}
            </p>
          </div>
        </div>

        {/* Lista de Tratamentos */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Histórico de Tratamentos</h3>
              <Link 
                to={`/tratamentos/novo?patient_id=${id}`}
                className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline"
              >
                <Plus size={16} />
                Novo Tratamento
              </Link>
            </div>
            <div className="divide-y">
              {treatments.length > 0 ? treatments.map((treatment) => (
                <div key={treatment.id} className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                      <ClipboardList size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">Tratamento #{treatment.id.slice(0, 8)}</p>
                      <p className="text-xs text-gray-500">{formatDate(treatment.created_at)} • {treatment.status}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div className="text-right">
                      <p className="text-sm font-bold text-gray-900">R$ {treatment.total_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                      <p className="text-xs text-gray-400">Total</p>
                    </div>
                    <Link 
                      to={`/tratamentos/${treatment.id}`}
                      className="p-2 text-gray-400 hover:text-blue-600 transition-colors"
                    >
                      <ArrowLeft className="rotate-180" size={20} />
                    </Link>
                  </div>
                </div>
              )) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-gray-500">Nenhum tratamento encontrado para este paciente.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
