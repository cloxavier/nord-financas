/**
 * Seção de Permissões e Segurança.
 * Nesta fase, a tela passa a salvar preferências reais sobre confirmações reforçadas
 * e orientação interna para ações sensíveis.
 * A aplicação efetiva dessas regras nas telas operacionais entrará na próxima etapa.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RefreshCcw,
  Save,
  Shield,
  TriangleAlert,
} from 'lucide-react';
import {
  EMPTY_PERMISSION_SECURITY_SETTINGS,
  PermissionSecuritySettingsFormData,
  getPermissionSecuritySettings,
  savePermissionSecuritySettings,
} from '@/src/lib/appSettings';

export default function PermissionsSecuritySettingsPage() {
  const [form, setForm] = useState<PermissionSecuritySettingsFormData>(
    EMPTY_PERMISSION_SECURITY_SETTINGS
  );
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [loadError, setLoadError] = useState('');
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    setLoadError('');
    setSaveError('');
    setSaveSuccess('');

    try {
      const data = await getPermissionSecuritySettings();

      setForm({
        require_delete_patient_confirmation: data.require_delete_patient_confirmation,
        require_delete_treatment_confirmation: data.require_delete_treatment_confirmation,
        require_edit_received_payment_confirmation: data.require_edit_received_payment_confirmation,
        require_delete_financial_record_confirmation:
          data.require_delete_financial_record_confirmation,
        show_sensitive_action_warning: data.show_sensitive_action_warning,
        sensitive_action_guidance_text: data.sensitive_action_guidance_text,
      });

      setSettingsId(data.id);
      setUpdatedAt(data.updated_at);
    } catch (error: any) {
      console.error('Erro ao carregar Permissões e Segurança:', error);
      setLoadError(
        'Não foi possível carregar as configurações de Permissões e Segurança. Verifique se o SQL da fase 1.4 foi executado na tabela app_settings.'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof PermissionSecuritySettingsFormData>(
    field: K,
    value: PermissionSecuritySettingsFormData[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setSaveError('');
    setSaveSuccess('');

    try {
      const result = await savePermissionSecuritySettings(form, settingsId);
      setSettingsId(result.id);
      setUpdatedAt(result.updated_at);
      setSaveSuccess('Configurações de Permissões e Segurança salvas com sucesso.');
    } catch (error: any) {
      console.error('Erro ao salvar Permissões e Segurança:', error);
      setSaveError(
        'Não foi possível salvar as preferências. Confirme se o SQL da fase 1.4 foi executado e se o usuário autenticado tem acesso à tabela app_settings.'
      );
    } finally {
      setSaving(false);
    }
  }

  const updatedAtLabel = useMemo(() => {
    if (!updatedAt) return 'Ainda não há salvamento registrado.';
    return `Última atualização: ${new Date(updatedAt).toLocaleString('pt-BR')}`;
  }, [updatedAt]);

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium">Carregando permissões e segurança...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Permissões e Segurança</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure a base das confirmações reforçadas e da orientação para ações sensíveis do sistema.
          </p>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
          {updatedAtLabel}
        </div>
      </div>

      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <Shield size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Confirmações reforçadas</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Estas preferências serão usadas na próxima etapa para reforçar segurança e reduzir ações críticas feitas por engano.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_delete_patient_confirmation}
                onChange={(e) =>
                  updateField('require_delete_patient_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao excluir paciente</p>
                <p className="text-xs text-gray-500 mt-1">
                  Prepara a exibição futura de confirmação mais cuidadosa em exclusões de paciente.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_delete_treatment_confirmation}
                onChange={(e) =>
                  updateField('require_delete_treatment_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao excluir tratamento</p>
                <p className="text-xs text-gray-500 mt-1">
                  Recomendado para reduzir exclusões acidentais em itens com impacto clínico e financeiro.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_edit_received_payment_confirmation}
                onChange={(e) =>
                  updateField('require_edit_received_payment_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao alterar pagamento já lançado</p>
                <p className="text-xs text-gray-500 mt-1">
                  Ajuda a proteger alterações em registros financeiros que já fazem parte do histórico.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.require_delete_financial_record_confirmation}
                onChange={(e) =>
                  updateField('require_delete_financial_record_confirmation', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exigir confirmação reforçada ao apagar registro financeiro</p>
                <p className="text-xs text-gray-500 mt-1">
                  Recomendado para ações com impacto direto em cobranças, parcelas e rastreabilidade.
                </p>
              </div>
            </label>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <TriangleAlert size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Orientação para ações sensíveis</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Defina se o sistema deve exibir alerta de atenção e qual mensagem base será usada nas confirmações futuras.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.show_sensitive_action_warning}
                onChange={(e) =>
                  updateField('show_sensitive_action_warning', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">Exibir alerta de ação sensível antes da confirmação</p>
                <p className="text-xs text-gray-500 mt-1">
                  Mantém preparada a camada extra de aviso para operações críticas.
                </p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Texto interno de orientação para ações críticas
              </label>
              <textarea
                value={form.sensitive_action_guidance_text}
                onChange={(e) => updateField('sensitive_action_guidance_text', e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Digite a orientação que será mostrada antes de confirmações críticas."
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Este texto será reaproveitado quando formos aplicar essas preferências nas telas de exclusão e edição sensível.
              </p>
            </div>
          </div>
        </div>

        {saveSuccess && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 flex gap-3">
            <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
            <span>{saveSuccess}</span>
          </div>
        )}

        {saveError && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save size={18} />}
            {saving ? 'Salvando...' : 'Salvar preferências'}
          </button>

          <button
            type="button"
            onClick={fetchSettings}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-white text-gray-700 font-semibold rounded-lg border hover:bg-gray-50 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
          >
            <RefreshCcw size={18} />
            Recarregar dados
          </button>
        </div>
      </form>
    </div>
  );
}