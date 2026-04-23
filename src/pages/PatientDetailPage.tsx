/**
 * Página de Detalhes do Paciente.
 * Exibe as informações cadastrais do paciente e seu histórico de tratamentos.
 *
 * Nesta etapa:
 * - exclusão de paciente passa a ser uma ação administrativa sensível
 * - usa as preferências salvas em Permissões e Segurança
 * - bloqueia exclusão quando existem tratamentos vinculados
 */
import React, { useEffect, useMemo, useState } from 'react';
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
  User,
  Lock,
} from 'lucide-react';
import { formatDate, formatDateOnly } from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { getPermissionSecuritySettings, PermissionSecuritySettingsRecord } from '../lib/appSettings';
import SensitiveActionDialog from '../components/SensitiveActionDialog';

export default function PatientDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();

  const [loading, setLoading] = useState(true);
  const [patient, setPatient] = useState<any>(null);
  const [treatments, setTreatments] = useState<any[]>([]);
  const [permissionSettings, setPermissionSettings] =
    useState<PermissionSecuritySettingsRecord | null>(null);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSuccess, setDeleteSuccess] = useState<string | null>(null);

  const canManageSensitivePatientDeletion = hasPermission('settings_manage');

  useEffect(() => {
    fetchData();
    fetchPermissionSettings();
  }, [id]);

  async function fetchPermissionSettings() {
    try {
      const settings = await getPermissionSecuritySettings();
      setPermissionSettings(settings);
    } catch (error) {
      console.error('Error fetching permission security settings:', error);
    }
  }

  async function fetchData() {
    if (!id) return;
    try {
      const { data: pData, error: pError } = await supabase
        .from('patients')
        .select('*')
        .eq('id', id)
        .single();

      if (pError) throw pError;
      setPatient(pData);

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

  const hasLinkedTreatments = treatments.length > 0;

  const patientDeleteTypedLabel = useMemo(() => {
    if (!permissionSettings?.require_delete_patient_confirmation) return undefined;
    return 'EXCLUIR PACIENTE';
  }, [permissionSettings]);

  const patientDeleteImplications = useMemo(() => {
    const items = [
      'O cadastro do paciente será removido permanentemente do sistema.',
      'Comunicações vinculadas diretamente ao paciente serão apagadas.',
      'A operação ficará registrada no histórico de auditoria como ação crítica.',
    ];

    if (hasLinkedTreatments) {
      items.unshift(
        `Este paciente possui ${treatments.length} tratamento(s) vinculado(s). A exclusão ficará bloqueada para preservar o histórico.`
      );
    }

    return items;
  }, [hasLinkedTreatments, treatments.length]);

  async function handleDeletePatient() {
    if (!id || !canManageSensitivePatientDeletion) return;

    if (
      permissionSettings?.require_delete_patient_confirmation &&
      deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR PACIENTE'
    ) {
      setDeleteError('Confirmação incorreta. Digite EXCLUIR PACIENTE para continuar.');
      return;
    }

    if (hasLinkedTreatments) {
      setDeleteError(
        'Este paciente possui tratamentos vinculados e não pode ser excluído. Preserve o histórico e avalie desativar o cadastro em vez de apagar.'
      );
      return;
    }

    setDeleteBusy(true);
    setDeleteError(null);
    setDeleteSuccess(null);

    try {
      const { data, error } = await supabase.rpc('delete_patient_with_safety', {
        p_patient_id: id,
      });

      if (error) throw error;
      if (data && data.success === false) {
        throw new Error(data.message || 'Não foi possível excluir o paciente.');
      }

      setDeleteSuccess('Paciente excluído com sucesso. Redirecionando...');

      setTimeout(() => {
        navigate('/pacientes');
      }, 1200);
    } catch (error: any) {
      console.error('Error deleting patient:', error);
      setDeleteError(error.message || 'Erro ao excluir paciente.');
    } finally {
      setDeleteBusy(false);
    }
  }

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
          <button
            onClick={() => navigate('/pacientes')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
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

          {canManageSensitivePatientDeletion ? (
            <button
              onClick={() => {
                setDeleteError(null);
                setDeleteSuccess(null);
                setDeleteConfirmation('');
                setShowDeleteModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 border border-red-100 text-red-600 font-semibold hover:bg-red-50 transition-colors"
            >
              <Trash2 size={18} />
              <span>Excluir</span>
            </button>
          ) : (
            <div className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-400 font-semibold rounded-lg cursor-not-allowed">
              <Lock size={16} />
              <span>Excluir restrito</span>
            </div>
          )}
        </div>
      </div>

      {!canManageSensitivePatientDeletion && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          Seu cargo pode visualizar este paciente, mas não possui permissão para exclusão de cadastro.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <User size={18} className="text-blue-600" />
              Dados Cadastrais
            </h3>
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <CreditCard className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">CPF</p>
                  <p className="text-sm text-gray-900">{patient.cpf || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Calendar className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Nascimento</p>
                  <p className="text-sm text-gray-900">
                    {patient.birth_date ? formatDateOnly(patient.birth_date) : 'Não informado'}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Telefone</p>
                  <p className="text-sm text-gray-900">{patient.phone || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">E-mail</p>
                  <p className="text-sm text-gray-900">{patient.email || 'Não informado'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="text-gray-400 mt-0.5" size={18} />
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Endereço</p>
                  <p className="text-sm text-gray-900 leading-relaxed">{patient.address || 'Não informado'}</p>
                </div>
              </div>
            </div>
          </div>

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
              {treatments.length > 0 ? (
                treatments.map((treatment) => (
                  <div
                    key={treatment.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold">
                        <ClipboardList size={18} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">Tratamento #{treatment.id.slice(0, 8)}</p>
                        <p className="text-xs text-gray-500 mt-1">Criado em {formatDate(treatment.created_at)}</p>
                      </div>
                    </div>
                    <Link
                      to={`/tratamentos/${treatment.id}`}
                      className="text-sm font-bold text-blue-600 hover:underline"
                    >
                      Ver detalhes
                    </Link>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center text-gray-500">
                  Nenhum tratamento encontrado para este paciente.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <SensitiveActionDialog
        open={showDeleteModal}
        title="Excluir paciente"
        description="Você está prestes a excluir permanentemente este cadastro de paciente do sistema. Esta operação deve ser usada apenas em situações administrativas realmente necessárias."
        guidanceText={permissionSettings?.show_sensitive_action_warning ? permissionSettings.sensitive_action_guidance_text : undefined}
        implications={patientDeleteImplications}
        tone="danger"
        typedLabel={patientDeleteTypedLabel}
        typedValue={deleteConfirmation}
        onTypedValueChange={setDeleteConfirmation}
        confirmLabel={hasLinkedTreatments ? 'Exclusão bloqueada' : 'Excluir paciente'}
        onClose={() => {
          setShowDeleteModal(false);
          setDeleteConfirmation('');
          setDeleteError(null);
          setDeleteSuccess(null);
        }}
        onConfirm={handleDeletePatient}
        busy={deleteBusy}
        confirmDisabled={hasLinkedTreatments || (Boolean(patientDeleteTypedLabel) && deleteConfirmation.trim().toUpperCase() !== 'EXCLUIR PACIENTE')}
        error={deleteError}
        successMessage={deleteSuccess}
      />
    </div>
  );
}
