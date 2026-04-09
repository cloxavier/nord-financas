/**
 * Seção de Notificações.
 * Nesta fase, a tela passa a carregar e salvar preferências reais no Supabase.
 * Ainda não executa alertas nem WhatsApp automaticamente:
 * ela apenas prepara o comportamento da próxima etapa.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Bell,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Save,
} from 'lucide-react';
import {
  EMPTY_NOTIFICATION_SETTINGS,
  NotificationSettingsFormData,
  getNotificationSettings,
  saveNotificationSettings,
} from '@/src/lib/appSettings';

const SUPPORTED_PLACEHOLDERS = [
  '{nome_paciente}',
  '{vencimento}',
  '{valor}',
];

export default function NotificationsSettingsPage() {
  const [form, setForm] = useState<NotificationSettingsFormData>(EMPTY_NOTIFICATION_SETTINGS);
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
      const data = await getNotificationSettings();

      setForm({
        due_alert_days: data.due_alert_days,
        highlight_overdue_installments: data.highlight_overdue_installments,
        show_dashboard_alert_summary: data.show_dashboard_alert_summary,
        enable_whatsapp_quick_charge: data.enable_whatsapp_quick_charge,
        reminder_message_template: data.reminder_message_template,
        overdue_message_template: data.overdue_message_template,
      });

      setSettingsId(data.id);
      setUpdatedAt(data.updated_at);
    } catch (error: any) {
      console.error('Erro ao carregar Notificações:', error);
      setLoadError(
        'Não foi possível carregar as configurações de notificações. Verifique se as colunas da fase 1.3 foram criadas em app_settings.'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof NotificationSettingsFormData>(
    field: K,
    value: NotificationSettingsFormData[K]
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
      const result = await saveNotificationSettings(form, settingsId);
      setSettingsId(result.id);
      setUpdatedAt(result.updated_at);
      setSaveSuccess('Configurações de notificações salvas com sucesso.');
    } catch (error: any) {
      console.error('Erro ao salvar Notificações:', error);
      setSaveError(
        'Não foi possível salvar as preferências. Confirme se o SQL da fase 1.3 foi executado e se o usuário autenticado tem acesso à tabela app_settings.'
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
          <span className="text-sm font-medium">Carregando configurações de notificações...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Notificações</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure preferências de alertas internos e a base da cobrança assistida por WhatsApp.
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
              <Bell size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Alertas internos</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Estas preferências serão usadas nas próximas etapas para destacar pendências e resumir alertas no dashboard.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Dias de antecedência para alertar vencimentos
              </label>
              <input
                type="number"
                min="0"
                value={form.due_alert_days}
                onChange={(e) => updateField('due_alert_days', e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="3"
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Ex.: 3 significa que o sistema poderá avisar 3 dias antes do vencimento.
              </p>
            </div>

            <div className="space-y-3">
              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.highlight_overdue_installments}
                  onChange={(e) =>
                    updateField('highlight_overdue_installments', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Destacar parcelas vencidas</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Mantém habilitada a lógica visual futura para dar mais evidência aos atrasos.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
                <input
                  type="checkbox"
                  checked={form.show_dashboard_alert_summary}
                  onChange={(e) =>
                    updateField('show_dashboard_alert_summary', e.target.checked)
                  }
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <div>
                  <p className="text-sm font-medium text-gray-900">Mostrar resumo no dashboard</p>
                  <p className="text-xs text-gray-500 mt-1">
                    Prepara a exibição futura de vencimentos próximos e atrasos na tela inicial.
                  </p>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
              <MessageCircle size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Cobrança assistida por WhatsApp</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Aqui você define os textos base que serão usados quando a ação rápida de cobrança for implementada.
              </p>
            </div>
          </div>

          <div className="space-y-5">
            <label className="flex items-start gap-3 rounded-lg border p-3 cursor-pointer hover:bg-gray-50 transition-colors">
              <input
                type="checkbox"
                checked={form.enable_whatsapp_quick_charge}
                onChange={(e) =>
                  updateField('enable_whatsapp_quick_charge', e.target.checked)
                }
                className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Habilitar ação rápida de cobrança por WhatsApp
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Mantém ativa a futura possibilidade de abrir o WhatsApp com mensagem pronta.
                </p>
              </div>
            </label>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mensagem padrão de lembrete
              </label>
              <textarea
                value={form.reminder_message_template}
                onChange={(e) => updateField('reminder_message_template', e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Digite a mensagem usada para lembrar o vencimento."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Mensagem padrão de atraso
              </label>
              <textarea
                value={form.overdue_message_template}
                onChange={(e) => updateField('overdue_message_template', e.target.value)}
                rows={5}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Digite a mensagem usada para cobranças em atraso."
              />
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm font-semibold text-amber-900 mb-2">
                Marcadores já preparados para uso futuro
              </p>
              <div className="flex flex-wrap gap-2">
                {SUPPORTED_PLACEHOLDERS.map((token) => (
                  <span
                    key={token}
                    className="inline-flex items-center rounded-full bg-white border border-amber-200 px-3 py-1 text-xs font-medium text-amber-900"
                  >
                    {token}
                  </span>
                ))}
              </div>
              <p className="text-xs text-amber-800 mt-3 leading-5">
                Esses marcadores ainda não são processados nesta fase, mas já estão definidos para manter consistência quando a cobrança assistida entrar em uso real.
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