/**
 * Seção Financeiro & Pix.
 * Nesta fase, a tela já carrega e salva dados reais no Supabase,
 * usando a tabela app_settings como fonte central das preferências.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  CreditCard,
  Loader2,
  Save,
  RefreshCcw,
  CheckCircle2,
  AlertCircle,
  Percent,
} from 'lucide-react';
import {
  EMPTY_FINANCIAL_PIX_SETTINGS,
  FinancialPixSettingsFormData,
  getFinancialPixSettings,
  saveFinancialPixSettings,
} from '@/src/lib/appSettings';
import { buildLateRuleDescription } from '@/src/lib/lateChargeRules';

const PIX_KEY_TYPE_OPTIONS = [
  { value: '', label: 'Selecione o tipo da chave' },
  { value: 'cpf', label: 'CPF' },
  { value: 'cnpj', label: 'CNPJ' },
  { value: 'email', label: 'E-mail' },
  { value: 'telefone', label: 'Telefone' },
  { value: 'aleatoria', label: 'Chave aleatória' },
];

export default function FinancialPixSettingsPage() {
  const [form, setForm] = useState<FinancialPixSettingsFormData>(EMPTY_FINANCIAL_PIX_SETTINGS);
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
      const data = await getFinancialPixSettings();
      setForm(data);
      setSettingsId(data.id);
      setUpdatedAt(data.updated_at);
    } catch (error: any) {
      console.error('Erro ao carregar Financeiro & Pix:', error);
      setLoadError(
        'Não foi possível carregar as configurações de Financeiro & Pix. Verifique se a tabela app_settings existe e se o usuário autenticado tem acesso.'
      );
    } finally {
      setLoading(false);
    }
  }

  function updateField<K extends keyof FinancialPixSettingsFormData>(
    field: K,
    value: FinancialPixSettingsFormData[K]
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
      const result = await saveFinancialPixSettings(form, settingsId);
      setSettingsId(result.id);
      setUpdatedAt(result.updated_at);
      setSaveSuccess('Configurações de Financeiro & Pix salvas com sucesso.');
    } catch (error: any) {
      console.error('Erro ao salvar Financeiro & Pix:', error);
      setSaveError(
        'Não foi possível salvar os dados. Confirme se a tabela app_settings existe e se o usuário autenticado pode gravar nessa tabela.'
      );
    } finally {
      setSaving(false);
    }
  }

  const updatedAtLabel = useMemo(() => {
    if (!updatedAt) return 'Ainda não há salvamento registrado.';
    return `Última atualização: ${new Date(updatedAt).toLocaleString('pt-BR')}`;
  }, [updatedAt]);

  const lateRulePreview = useMemo(() => {
    return buildLateRuleDescription({
      late_fee_enabled: form.default_late_fee_enabled,
      late_fee_percent: Number(form.default_late_fee_percent || 0),
      interest_enabled: form.default_interest_enabled,
      interest_percent: Number(form.default_interest_percent || 0),
      interest_period: form.default_interest_period,
      late_fee_notes: form.default_late_fee_notes,
    });
  }, [form]);

  if (loading) {
    return (
      <div className="min-h-[320px] flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-600">
          <Loader2 className="animate-spin h-5 w-5 text-blue-600" />
          <span className="text-sm font-medium">Carregando configurações financeiras...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Financeiro & Pix</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure os dados financeiros centrais da clínica, incluindo o padrão de multa e juros por atraso.
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
              <CreditCard size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Dados financeiros básicos</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Dados de Pix e textos padrão que apoiam cobranças, recebimentos e documentos financeiros.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Tipo de chave Pix
              </label>
              <select
                value={form.pix_key_type}
                onChange={(e) => updateField('pix_key_type', e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {PIX_KEY_TYPE_OPTIONS.map((option) => (
                  <option key={option.value || 'empty'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Chave Pix da clínica
              </label>
              <input
                type="text"
                value={form.pix_key}
                onChange={(e) => updateField('pix_key', e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex.: 00.000.000/0001-00, telefone, e-mail ou chave aleatória"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Nome do recebedor / beneficiário
              </label>
              <input
                type="text"
                value={form.beneficiary_name}
                onChange={(e) => updateField('beneficiary_name', e.target.value)}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Ex.: Nord Odontologia LTDA"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Instrução padrão de pagamento
              </label>
              <textarea
                value={form.default_payment_instructions}
                onChange={(e) => updateField('default_payment_instructions', e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Ex.: Após o pagamento, envie o comprovante para confirmação."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Observação padrão de cobrança
              </label>
              <textarea
                value={form.default_contract_notes}
                onChange={(e) => updateField('default_contract_notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Ex.: Em caso de dúvida, entre em contato com a clínica para alinharmos a melhor forma de pagamento."
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-100">
              <Percent size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Encargos padrão por atraso</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Estas regras serão sugeridas por padrão nos novos tratamentos, mas cada tratamento poderá personalizar o snapshot.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-xl border p-4 space-y-3">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.default_late_fee_enabled}
                  onChange={(e) => updateField('default_late_fee_enabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-800">
                  Ativar multa por atraso
                </span>
              </label>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Multa padrão (%)
                </label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={form.default_late_fee_percent}
                  onChange={(e) => updateField('default_late_fee_percent', e.target.value)}
                  disabled={!form.default_late_fee_enabled}
                  className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                />
              </div>
            </div>

            <div className="rounded-xl border p-4 space-y-3">
              <label className="inline-flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.default_interest_enabled}
                  onChange={(e) => updateField('default_interest_enabled', e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm font-semibold text-gray-800">
                  Ativar juros por atraso
                </span>
              </label>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Juros padrão (%)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={form.default_interest_percent}
                    onChange={(e) => updateField('default_interest_percent', e.target.value)}
                    disabled={!form.default_interest_enabled}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Período
                  </label>
                  <select
                    value={form.default_interest_period}
                    onChange={(e) =>
                      updateField(
                        'default_interest_period',
                        e.target.value as 'monthly' | 'daily'
                      )
                    }
                    disabled={!form.default_interest_enabled}
                    className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="monthly">Ao mês</option>
                    <option value="daily">Ao dia</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Texto padrão das condições de atraso
              </label>
              <textarea
                value={form.default_late_fee_notes}
                onChange={(e) => updateField('default_late_fee_notes', e.target.value)}
                rows={4}
                className="w-full px-3 py-2.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-y"
                placeholder="Ex.: Em caso de atraso, incidirá multa de 2% e juros de 1% ao mês sobre o valor em aberto."
              />
              <p className="text-xs text-gray-500 mt-1.5">
                Se ficar em branco, o sistema monta automaticamente o texto com base nos percentuais.
              </p>
            </div>

            <div className="md:col-span-2 rounded-xl border border-amber-100 bg-amber-50 px-4 py-3">
              <p className="text-xs font-bold text-amber-700 uppercase tracking-wider mb-1">
                Prévia textual
              </p>
              <p className="text-sm text-amber-900 leading-relaxed">{lateRulePreview}</p>
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
            {saving ? 'Salvando...' : 'Salvar configurações'}
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