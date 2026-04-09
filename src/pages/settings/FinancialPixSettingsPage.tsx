/**
 * Seção Financeiro & Pix.
 * Nesta fase, a tela já carrega e salva dados reais no Supabase,
 * usando a tabela app_settings como fonte central das preferências.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { CreditCard, Loader2, Save, RefreshCcw, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  EMPTY_FINANCIAL_PIX_SETTINGS,
  FinancialPixSettingsFormData,
  getFinancialPixSettings,
  saveFinancialPixSettings,
} from '@/src/lib/appSettings';

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

  /**
   * Carrega os dados atuais assim que a página é aberta.
   */
  useEffect(() => {
    fetchSettings();
  }, []);

  /**
   * Busca os dados atuais da tabela app_settings.
   */
  async function fetchSettings() {
    setLoading(true);
    setLoadError('');
    setSaveError('');
    setSaveSuccess('');

    try {
      const data = await getFinancialPixSettings();
      setForm({
        pix_key_type: data.pix_key_type,
        pix_key: data.pix_key,
        beneficiary_name: data.beneficiary_name,
        default_payment_instructions: data.default_payment_instructions,
        default_contract_notes: data.default_contract_notes,
      });
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

  /**
   * Atualiza qualquer campo do formulário de forma genérica.
   */
  function updateField<K extends keyof FinancialPixSettingsFormData>(
    field: K,
    value: FinancialPixSettingsFormData[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  /**
   * Salva os dados atuais no Supabase.
   */
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

  /**
   * Texto amigável da última atualização, se existir.
   */
  const updatedAtLabel = useMemo(() => {
    if (!updatedAt) return 'Ainda não há salvamento registrado.';
    return `Última atualização: ${new Date(updatedAt).toLocaleString('pt-BR')}`;
  }, [updatedAt]);

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
      {/* Cabeçalho da seção */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Financeiro & Pix</h2>
          <p className="text-sm text-gray-500 mt-1">
            Configure os dados básicos que serão usados em cobranças, recebimentos e rotinas financeiras.
          </p>
        </div>

        <div className="text-xs text-gray-500 bg-gray-50 border rounded-lg px-3 py-2">
          {updatedAtLabel}
        </div>
      </div>

      {/* Mensagem de erro de carregamento */}
      {loadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Formulário principal */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
              <CreditCard size={22} />
            </div>

            <div>
              <h3 className="text-base font-semibold text-gray-900">Dados financeiros básicos</h3>
              <p className="text-sm text-gray-500 mt-1 leading-6 max-w-2xl">
                Nesta etapa, vamos salvar as informações centrais de Pix e os textos padrão que apoiarão
                futuras cobranças e recibos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Tipo da chave Pix */}
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

            {/* Chave Pix */}
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

            {/* Nome do recebedor */}
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

            {/* Instrução padrão de pagamento */}
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
              <p className="text-xs text-gray-500 mt-1.5">
                Este texto poderá ser usado futuramente em cobranças, recibos e mensagens financeiras.
              </p>
            </div>

            {/* Observação padrão de cobrança */}
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
              <p className="text-xs text-gray-500 mt-1.5">
                Use este campo para uma observação recorrente e profissional nas rotinas de cobrança.
              </p>
            </div>
          </div>
        </div>

        {/* Feedback visual de salvamento */}
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

        {/* Ações */}
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