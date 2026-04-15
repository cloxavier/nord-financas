/**
 * Página de Formulário de Tratamento.
 * Permite a criação de novos tratamentos ou a edição de tratamentos existentes.
 * Gerencia a seleção de pacientes, procedimentos, cálculos financeiros e persistência no banco de dados.
 *
 * Nesta fase, o formulário também salva o snapshot de multa e juros por atraso:
 * - podendo usar o padrão global da clínica
 * - ou uma regra personalizada no próprio tratamento
 *
 * Ajuste importante desta versão:
 * - centraliza arredondamento monetário em 2 casas
 * - evita vazamento de 1 centavo em entrada, saldo a parcelar e totais
 */
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Save,
  Loader2,
  Trash2,
  Search,
  User,
  Stethoscope,
  FileText,
  Calculator,
  UserPlus,
  PlusCircle,
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';
import { logActivity } from '../lib/activities';
import { syncExistingPaymentPlanAfterTreatmentChange } from '../domain/paymentPlans/services/paymentPlanGenerationService';
import { getFinancialPixSettings } from '../lib/appSettings';
import { buildLateRuleDescription } from '../lib/lateChargeRules';

/**
 * Interface para representar um item de tratamento (procedimento).
 */
interface TreatmentItem {
  id?: string;
  procedure_id: string | null;
  procedure_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  notes: string;
  isManual?: boolean;
}

/**
 * Arredonda valores monetários em 2 casas.
 * Essa função passa a ser a fonte única para subtotal, entrada,
 * saldo a parcelar e total das linhas.
 */
function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

/**
 * Normaliza qualquer entrada monetária para número >= 0 com 2 casas.
 */
function normalizeMoneyInput(value: unknown) {
  return roundMoney(Math.max(0, Number(value || 0)));
}

export default function TreatmentFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const initialPatientId = searchParams.get('patient_id');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [patients, setPatients] = useState<any[]>([]);
  const [procedures, setProcedures] = useState<any[]>([]);

  const [isManualPatient, setIsManualPatient] = useState(false);
  const [manualPatientData, setManualPatientData] = useState({
    full_name: '',
    phone: '',
    email: '',
  });

  /**
   * Snapshot dos padrões globais da clínica para multa e juros.
   * Usado para preencher tratamentos novos e reaplicar o padrão quando necessário.
   */
  const [clinicLateDefaults, setClinicLateDefaults] = useState({
    late_fee_enabled: false,
    late_fee_percent: 2,
    interest_enabled: false,
    interest_percent: 1,
    interest_period: 'monthly' as 'monthly' | 'daily',
    late_fee_notes: '',
  });

  const [formData, setFormData] = useState({
    patient_id: initialPatientId || '',
    status: 'draft',
    discount_amount: 0,
    entry_amount: 0,
    use_clinic_default_late_rules: true,
    late_fee_enabled: false,
    late_fee_percent: 2,
    interest_enabled: false,
    interest_percent: 1,
    interest_period: 'monthly' as 'monthly' | 'daily',
    late_fee_notes: '',
    payment_method_preference: '',
    notes: '',
  });

  /**
   * Guardamos a base financeira original do plano,
   * ou seja, o saldo realmente parcelável antes da edição.
   */
  const [originalTreatmentFinanceBase, setOriginalTreatmentFinanceBase] = useState<number | null>(null);

  const [items, setItems] = useState<TreatmentItem[]>([]);

  const [showPatientModal, setShowPatientModal] = useState(false);
  const [showProcedureModal, setShowProcedureModal] = useState(false);
  const [savedTreatmentId, setSavedTreatmentId] = useState<string | null>(null);
  const [manualProceduresToSave, setManualProceduresToSave] = useState<TreatmentItem[]>([]);

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  /**
   * Reaplica no formulário os padrões globais de multa e juros da clínica.
   */
  function applyClinicLateDefaults() {
    setFormData((prev) => ({
      ...prev,
      use_clinic_default_late_rules: true,
      late_fee_enabled: clinicLateDefaults.late_fee_enabled,
      late_fee_percent: clinicLateDefaults.late_fee_percent,
      interest_enabled: clinicLateDefaults.interest_enabled,
      interest_percent: clinicLateDefaults.interest_percent,
      interest_period: clinicLateDefaults.interest_period,
      late_fee_notes: clinicLateDefaults.late_fee_notes,
    }));
  }

  async function fetchInitialData() {
    try {
      const [patientsRes, proceduresRes, financialSettings] = await Promise.all([
        supabase.from('patients').select('id, full_name, phone, email').order('full_name'),
        supabase.from('procedure_catalog').select('*').eq('is_active', true).order('name'),
        getFinancialPixSettings().catch(() => null),
      ]);

      if (patientsRes.error) throw patientsRes.error;
      if (proceduresRes.error) throw proceduresRes.error;

      setPatients(patientsRes.data || []);
      setProcedures(proceduresRes.data || []);

      const resolvedClinicLateDefaults = {
        late_fee_enabled: financialSettings?.default_late_fee_enabled ?? false,
        late_fee_percent: Number(financialSettings?.default_late_fee_percent || 2),
        interest_enabled: financialSettings?.default_interest_enabled ?? false,
        interest_percent: Number(financialSettings?.default_interest_percent || 1),
        interest_period:
          financialSettings?.default_interest_period === 'daily' ? 'daily' : 'monthly',
        late_fee_notes: financialSettings?.default_late_fee_notes || '',
      };

      setClinicLateDefaults(resolvedClinicLateDefaults);

      if (!isEdit) {
        setFormData((prev) => ({
          ...prev,
          use_clinic_default_late_rules: true,
          late_fee_enabled: resolvedClinicLateDefaults.late_fee_enabled,
          late_fee_percent: resolvedClinicLateDefaults.late_fee_percent,
          interest_enabled: resolvedClinicLateDefaults.interest_enabled,
          interest_percent: resolvedClinicLateDefaults.interest_percent,
          interest_period: resolvedClinicLateDefaults.interest_period,
          late_fee_notes: resolvedClinicLateDefaults.late_fee_notes,
        }));
      }

      if (isEdit && id) {
        const { data: treatment, error: tError } = await supabase
          .from('treatments')
          .select('*')
          .eq('id', id)
          .single();

        if (tError) throw tError;

        if (treatment) {
          setOriginalTreatmentFinanceBase(
            roundMoney(treatment.amount_to_finance ?? treatment.total_amount ?? 0)
          );

          const { data: treatmentItems, error: iError } = await supabase
            .from('treatment_items')
            .select('*')
            .eq('treatment_id', id);

          if (iError) throw iError;

          if (!treatment.patient_id) {
            setIsManualPatient(true);
            setManualPatientData({
              full_name: treatment.patient_name_snapshot || '',
              phone: treatment.patient_phone_snapshot || '',
              email: treatment.patient_email_snapshot || '',
            });
          }

          setFormData({
            patient_id: treatment.patient_id || '',
            status: treatment.status,
            discount_amount: roundMoney(treatment.discount_amount || 0),
            entry_amount: roundMoney(treatment.entry_amount || 0),
            use_clinic_default_late_rules: treatment.use_clinic_default_late_rules ?? true,
            late_fee_enabled:
              treatment.late_fee_enabled ?? resolvedClinicLateDefaults.late_fee_enabled,
            late_fee_percent:
              treatment.late_fee_percent ?? resolvedClinicLateDefaults.late_fee_percent,
            interest_enabled:
              treatment.interest_enabled ?? resolvedClinicLateDefaults.interest_enabled,
            interest_percent:
              treatment.interest_percent ?? resolvedClinicLateDefaults.interest_percent,
            interest_period:
              treatment.interest_period || resolvedClinicLateDefaults.interest_period,
            late_fee_notes:
              treatment.late_fee_notes || resolvedClinicLateDefaults.late_fee_notes,
            payment_method_preference: treatment.payment_method_preference || '',
            notes: treatment.notes || '',
          });

          const mappedItems: TreatmentItem[] = (treatmentItems || []).map((item) => {
            const unitPrice = roundMoney(item.unit_price_snapshot || item.unit_price || 0);
            const quantity = item.quantity || 1;
            const safeLineTotal = roundMoney(
              item.line_total ?? unitPrice * quantity
            );

            return {
              id: item.id,
              procedure_id: item.procedure_id,
              procedure_name_snapshot:
                item.procedure_name_snapshot || item.procedure_name || 'Procedimento',
              unit_price_snapshot: unitPrice,
              quantity,
              line_total: safeLineTotal,
              notes: item.notes || '',
              isManual: !item.procedure_id,
            };
          });

          setItems(mappedItems);
        }
      }
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  }

  const addItem = (procedureId?: string) => {
    if (procedureId) {
      const procedure = procedures.find((p) => p.id === procedureId);
      if (!procedure) return;

      const defaultPrice = roundMoney(procedure.default_price || 0);

      const newItem: TreatmentItem = {
        procedure_id: procedure.id,
        procedure_name_snapshot: procedure.name,
        unit_price_snapshot: defaultPrice,
        quantity: 1,
        line_total: defaultPrice,
        notes: '',
      };

      setItems([...items, newItem]);
    } else {
      const newItem: TreatmentItem = {
        procedure_id: null,
        procedure_name_snapshot: '',
        unit_price_snapshot: 0,
        quantity: 1,
        line_total: 0,
        notes: '',
        isManual: true,
      };

      setItems([...items, newItem]);
    }
  };

  const removeItem = (index: number) => {
    setItems(items.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, updates: Partial<TreatmentItem>) => {
    const newItems = [...items];
    const mergedItem = { ...newItems[index], ...updates };

    const safeUnitPrice = roundMoney(mergedItem.unit_price_snapshot || 0);
    const safeQuantity = Math.max(1, Math.floor(Number(mergedItem.quantity || 1)));
    const safeLineTotal = roundMoney(safeUnitPrice * safeQuantity);

    newItems[index] = {
      ...mergedItem,
      unit_price_snapshot: safeUnitPrice,
      quantity: safeQuantity,
      line_total: safeLineTotal,
    };

    setItems(newItems);
  };

  /**
   * Base financeira normalizada.
   * Tudo passa por roundMoney para impedir diferença de 1 centavo.
   */
  const subtotal = roundMoney(
    items.reduce((sum, item) => sum + roundMoney(item.line_total || 0), 0)
  );
  const discountAmount = normalizeMoneyInput(formData.discount_amount);
  const contractedTotal = roundMoney(Math.max(0, subtotal - discountAmount));
  const entryAmount = normalizeMoneyInput(formData.entry_amount);
  const amountToFinance = roundMoney(Math.max(0, contractedTotal - entryAmount));

  const lateRulePreviewText =
    formData.late_fee_notes?.trim() ||
    buildLateRuleDescription({
      late_fee_enabled: formData.late_fee_enabled,
      late_fee_percent: Number(formData.late_fee_percent || 0),
      interest_enabled: formData.interest_enabled,
      interest_percent: Number(formData.interest_percent || 0),
      interest_period: formData.interest_period,
      late_fee_notes: formData.late_fee_notes,
    });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isManualPatient && !formData.patient_id) return alert('Selecione um paciente.');
    if (isManualPatient && !manualPatientData.full_name) {
      return alert('Informe o nome do paciente.');
    }
    if (items.length === 0) return alert('Adicione pelo menos um procedimento.');

    const invalidItem = items.find(
      (item) => !item.procedure_name_snapshot || item.unit_price_snapshot <= 0
    );
    if (invalidItem) {
      return alert('Todos os procedimentos devem ter nome e valor maior que zero.');
    }

    if (discountAmount > subtotal) {
      return alert('O desconto não pode ser maior que o subtotal.');
    }

    if (entryAmount > contractedTotal) {
      return alert('A entrada não pode ser maior que o valor total do tratamento.');
    }

    const resolvedLateRuleSnapshot = formData.use_clinic_default_late_rules
      ? {
          late_fee_enabled: clinicLateDefaults.late_fee_enabled,
          late_fee_percent: clinicLateDefaults.late_fee_percent,
          interest_enabled: clinicLateDefaults.interest_enabled,
          interest_percent: clinicLateDefaults.interest_percent,
          interest_period: clinicLateDefaults.interest_period,
          late_fee_notes: clinicLateDefaults.late_fee_notes,
        }
      : {
          late_fee_enabled: formData.late_fee_enabled,
          late_fee_percent: Number(formData.late_fee_percent || 0),
          interest_enabled: formData.interest_enabled,
          interest_percent: Number(formData.interest_percent || 0),
          interest_period: formData.interest_period,
          late_fee_notes: formData.late_fee_notes,
        };

    if (
      resolvedLateRuleSnapshot.late_fee_enabled &&
      Number(resolvedLateRuleSnapshot.late_fee_percent || 0) <= 0
    ) {
      return alert('Informe um percentual de multa maior que zero.');
    }

    if (
      resolvedLateRuleSnapshot.interest_enabled &&
      Number(resolvedLateRuleSnapshot.interest_percent || 0) <= 0
    ) {
      return alert('Informe um percentual de juros maior que zero.');
    }

    setSaving(true);

    let patientName = '';
    let patientPhone = '';
    let patientEmail = '';

    if (isManualPatient) {
      patientName = manualPatientData.full_name;
      patientPhone = manualPatientData.phone;
      patientEmail = manualPatientData.email;
    } else {
      const selectedPatient = patients.find((p) => p.id === formData.patient_id);
      patientName = selectedPatient?.full_name || '';
      patientPhone = selectedPatient?.phone || '';
      patientEmail = selectedPatient?.email || '';
    }

    try {
      const treatmentData: any = {
        ...formData,
        patient_id: isManualPatient ? null : formData.patient_id,
        patient_name_snapshot: patientName,
        patient_phone_snapshot: patientPhone,
        patient_email_snapshot: patientEmail,
        discount_amount: roundMoney(discountAmount),
        entry_amount: roundMoney(entryAmount),
        subtotal: roundMoney(subtotal),
        total_amount: roundMoney(contractedTotal),
        amount_to_finance: roundMoney(amountToFinance),
        use_clinic_default_late_rules: formData.use_clinic_default_late_rules,
        late_fee_enabled: resolvedLateRuleSnapshot.late_fee_enabled,
        late_fee_percent: Number(resolvedLateRuleSnapshot.late_fee_percent || 0),
        interest_enabled: resolvedLateRuleSnapshot.interest_enabled,
        interest_percent: Number(resolvedLateRuleSnapshot.interest_percent || 0),
        interest_period: resolvedLateRuleSnapshot.interest_period,
        late_fee_notes: resolvedLateRuleSnapshot.late_fee_notes,
        updated_at: new Date().toISOString(),
      };

      let treatmentId = id;

      if (isEdit && id) {
        const { error: updateError } = await supabase
          .from('treatments')
          .update(treatmentData)
          .eq('id', id);

        if (updateError) throw updateError;

        const { error: deleteError } = await supabase
          .from('treatment_items')
          .delete()
          .eq('treatment_id', id);

        if (deleteError) throw deleteError;
      } else {
        const { data: newTreatment, error: insertError } = await supabase
          .from('treatments')
          .insert([
            {
              ...treatmentData,
              created_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        treatmentId = newTreatment.id;

        await logActivity(
          'treatment_created',
          `Tratamento para ${patientName} criado no valor de ${formatCurrency(contractedTotal)}`,
          { entity_id: treatmentId }
        );
      }

      const itemsToInsert = items.map((item) => {
        const safeUnitPrice = roundMoney(item.unit_price_snapshot || 0);
        const safeQuantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
        const safeLineTotal = roundMoney(safeUnitPrice * safeQuantity);

        return {
          treatment_id: treatmentId,
          procedure_id: item.procedure_id || null,
          procedure_name_snapshot: item.procedure_name_snapshot || 'Procedimento',
          unit_price_snapshot: safeUnitPrice,
          quantity: safeQuantity,
          line_total: safeLineTotal,
          notes: item.notes || '',
        };
      });

      const { error: itemsError } = await supabase
        .from('treatment_items')
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      let paymentPlanSyncMessage: string | null = null;

      if (isEdit && treatmentId && originalTreatmentFinanceBase !== null) {
        const financeBaseChanged =
          Math.abs(roundMoney(amountToFinance) - roundMoney(originalTreatmentFinanceBase)) >
          0.009;

        if (financeBaseChanged) {
          const syncResult = await syncExistingPaymentPlanAfterTreatmentChange({
            treatmentId,
            amountToFinance: roundMoney(amountToFinance),
          });

          if (syncResult.status === 'blocked') {
            paymentPlanSyncMessage =
              syncResult.message ||
              'Tratamento salvo, mas o plano não foi recalculado automaticamente.';
          }

          if (syncResult.status === 'synced') {
            await logActivity(
              'payment_plan_synced',
              `Plano de pagamento do tratamento #${treatmentId.slice(0, 8)} recalculado após alteração do saldo parcelável.`,
              { entity_id: treatmentId }
            );
          }
        }
      }

      const manualProcs = items.filter((item) => !item.procedure_id);

      if (paymentPlanSyncMessage) {
        alert(paymentPlanSyncMessage);
      }

      if (isManualPatient || manualProcs.length > 0) {
        setSavedTreatmentId(treatmentId);
        setManualProceduresToSave(manualProcs);

        if (isManualPatient) {
          setShowPatientModal(true);
        } else if (manualProcs.length > 0) {
          setShowProcedureModal(true);
        } else {
          navigate(`/tratamentos/${treatmentId}`);
        }
      } else {
        navigate(`/tratamentos/${treatmentId}`);
      }
    } catch (error: any) {
      console.error('Error saving treatment:', error);
      alert(error.message || 'Erro ao salvar tratamento.');
    } finally {
      setSaving(false);
    }
  };

  const handleSavePatientToCatalog = async () => {
    try {
      const { error } = await supabase.from('patients').insert([
        {
          full_name: manualPatientData.full_name,
          phone: manualPatientData.phone,
          email: manualPatientData.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ]);

      if (error) throw error;

      setShowPatientModal(false);

      if (manualProceduresToSave.length > 0) {
        setShowProcedureModal(true);
      } else {
        navigate(`/tratamentos/${savedTreatmentId}`);
      }
    } catch (error) {
      console.error('Error saving patient to catalog:', error);
      alert('Erro ao salvar paciente no catálogo.');
    }
  };

  const handleSaveProceduresToCatalog = async () => {
    try {
      const proceduresToInsert = manualProceduresToSave.map((p) => ({
        name: p.procedure_name_snapshot,
        default_price: roundMoney(p.unit_price_snapshot),
        category: 'Geral',
        is_active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase.from('procedure_catalog').insert(proceduresToInsert);
      if (error) throw error;

      setShowProcedureModal(false);
      navigate(`/tratamentos/${savedTreatmentId}`);
    } catch (error) {
      console.error('Error saving procedures to catalog:', error);
      alert('Erro ao salvar procedimentos no catálogo.');
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
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isEdit ? 'Editar Tratamento' : 'Novo Tratamento'}
          </h1>
          <p className="text-sm text-gray-500">
            Crie orçamentos e planeje os procedimentos do paciente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center justify-between mb-4 pb-2 border-b">
              <div className="flex items-center gap-2">
                <User size={18} className="text-blue-600" />
                <h3 className="font-bold text-gray-900">Paciente</h3>
              </div>

              <div className="flex bg-gray-100 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setIsManualPatient(false)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    !isManualPatient
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Registrado
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualPatient(true)}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${
                    isManualPatient
                      ? 'bg-white text-blue-600 shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  Manual
                </button>
              </div>
            </div>

            {!isManualPatient ? (
              <select
                required={!isManualPatient}
                value={formData.patient_id ?? ''}
                onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Selecione o paciente</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    Nome Completo *
                  </label>
                  <input
                    type="text"
                    required={isManualPatient}
                    value={manualPatientData.full_name ?? ''}
                    onChange={(e) =>
                      setManualPatientData({ ...manualPatientData, full_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="Nome do paciente"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={manualPatientData.phone ?? ''}
                    onChange={(e) =>
                      setManualPatientData({ ...manualPatientData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="(00) 00000-0000"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase mb-1">
                    E-mail
                  </label>
                  <input
                    type="email"
                    value={manualPatientData.email ?? ''}
                    onChange={(e) =>
                      setManualPatientData({ ...manualPatientData, email: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <Stethoscope size={18} className="text-blue-600" />
                <h3 className="font-bold text-gray-900">Procedimentos</h3>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative w-48 sm:w-64">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    size={14}
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        addItem(e.target.value);
                        e.target.value = '';
                      }
                    }}
                    className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white appearance-none"
                  >
                    <option value="">Buscar no catálogo...</option>
                    {procedures.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} - {formatCurrency(p.default_price)}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => addItem()}
                  className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors"
                >
                  <PlusCircle size={14} />
                  <span>Manual</span>
                </button>
              </div>
            </div>

            <div className="divide-y">
              {items.length > 0 ? (
                items.map((item, idx) => (
                  <div key={idx} className="p-4 sm:p-6 hover:bg-gray-50/50 transition-colors">
                    <div className="flex flex-col sm:flex-row gap-4">
                      <div className="flex-1 space-y-3">
                        {item.procedure_id ? (
                          <div>
                            <p className="font-bold text-gray-900">{item.procedure_name_snapshot}</p>
                            <p className="text-xs text-gray-500">
                              Catálogo:{' '}
                              {procedures.find((p) => p.id === item.procedure_id)?.category ||
                                'Geral'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                              Nome do Procedimento *
                            </label>
                            <input
                              type="text"
                              required
                              value={item.procedure_name_snapshot ?? ''}
                              onChange={(e) =>
                                updateItem(idx, { procedure_name_snapshot: e.target.value })
                              }
                              className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-bold"
                              placeholder="Nome do procedimento manual"
                            />
                          </div>
                        )}

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                              Valor Unitário *
                            </label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-xs">
                                R$
                              </span>
                              <input
                                type="number"
                                step="0.01"
                                required
                                value={item.unit_price_snapshot ?? ''}
                                onChange={(e) =>
                                  updateItem(idx, {
                                    unit_price_snapshot: parseFloat(e.target.value) || 0,
                                  })
                                }
                                className="w-full pl-7 pr-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm font-medium"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                              Quantidade
                            </label>
                            <div className="flex items-center border rounded-lg overflow-hidden">
                              <button
                                type="button"
                                onClick={() =>
                                  updateItem(idx, { quantity: Math.max(1, item.quantity - 1) })
                                }
                                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                              >
                                -
                              </button>
                              <input
                                type="number"
                                value={item.quantity ?? ''}
                                onChange={(e) =>
                                  updateItem(idx, { quantity: parseInt(e.target.value) || 1 })
                                }
                                className="w-10 text-center text-xs font-bold border-x outline-none py-1"
                              />
                              <button
                                type="button"
                                onClick={() => updateItem(idx, { quantity: item.quantity + 1 })}
                                className="px-2 py-1 bg-gray-50 hover:bg-gray-100 text-gray-600"
                              >
                                +
                              </button>
                            </div>
                          </div>

                          <div className="hidden sm:block">
                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                              Total
                            </label>
                            <p className="py-1.5 text-sm font-bold text-gray-900">
                              {formatCurrency(item.line_total)}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2">
                        <div className="sm:hidden">
                          <p className="text-sm font-bold text-blue-600">
                            {formatCurrency(item.line_total)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(idx)}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors bg-gray-50 sm:bg-transparent rounded-lg"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-3">
                      <input
                        type="text"
                        value={item.notes ?? ''}
                        onChange={(e) => updateItem(idx, { notes: e.target.value })}
                        className="w-full px-3 py-1.5 border border-dashed rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-xs"
                        placeholder="Observações deste item..."
                      />
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-500">Nenhum procedimento adicionado.</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b">
              <FileText size={18} className="text-blue-600" />
              <h3 className="font-bold text-gray-900">Observações do Tratamento</h3>
            </div>
            <textarea
              rows={4}
              value={formData.notes ?? ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
              placeholder="Detalhes sobre o plano de tratamento, prazos ou condições especiais..."
            />
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6 sticky top-24">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2">
              <Calculator size={18} className="text-blue-600" />
              Resumo Financeiro
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span className="font-medium text-gray-900">{formatCurrency(subtotal)}</span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Desconto (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  value={formData.discount_amount ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      discount_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold"
                />
              </div>

              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-500">Total Contratado</span>
                <span className="font-bold text-gray-900">
                  {formatCurrency(contractedTotal)}
                </span>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-sm text-gray-500">Entrada (R$)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.entry_amount ?? ''}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      entry_amount: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-1.5 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-right font-bold"
                />
                <p className="text-[11px] text-gray-400">
                  Nesta fase, a entrada é contratual e reduz o saldo do parcelamento.
                </p>
              </div>

              <div className="pt-4 border-t flex justify-between items-center">
                <div>
                  <span className="font-bold text-gray-900 block">Saldo a Parcelar</span>
                  <span className="text-[11px] text-gray-400">
                    Base usada para gerar as parcelas
                  </span>
                </div>
                <span className="text-2xl font-bold text-blue-600">
                  {formatCurrency(amountToFinance)}
                </span>
              </div>
            </div>

            <div className="mt-8 space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Status
                </label>
                <select
                  value={formData.status ?? 'draft'}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-semibold"
                >
                  <option value="draft">Orçamento (Rascunho)</option>
                  <option value="pending">Aguardando Aprovação</option>
                  <option value="in_progress">Em Andamento</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">
                  Preferência de Pagamento
                </label>
                <input
                  type="text"
                  value={formData.payment_method_preference ?? ''}
                  onChange={(e) =>
                    setFormData({ ...formData, payment_method_preference: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                  placeholder="Ex: Cartão 10x, PIX..."
                />
              </div>
            </div>

            <div className="mt-8 pt-6 border-t space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                    Encargos por atraso
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Defina se este tratamento usa o padrão da clínica ou uma regra própria.
                  </p>
                </div>

                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.use_clinic_default_late_rules}
                    onChange={(e) => {
                      if (e.target.checked) {
                        applyClinicLateDefaults();
                      } else {
                        setFormData((prev) => ({
                          ...prev,
                          use_clinic_default_late_rules: false,
                        }));
                      }
                    }}
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  Usar padrão
                </label>
              </div>

              <button
                type="button"
                onClick={applyClinicLateDefaults}
                className="w-full py-2 border rounded-lg text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Reaplicar padrão da clínica
              </button>

              <div className="space-y-3 rounded-xl border p-4">
                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.late_fee_enabled}
                    disabled={formData.use_clinic_default_late_rules}
                    onChange={(e) =>
                      setFormData({ ...formData, late_fee_enabled: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  Ativar multa
                </label>

                <input
                  type="number"
                  step="0.001"
                  min="0"
                  value={formData.late_fee_percent ?? ''}
                  disabled={formData.use_clinic_default_late_rules || !formData.late_fee_enabled}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      late_fee_percent: parseFloat(e.target.value) || 0,
                    })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="Multa (%)"
                />

                <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={formData.interest_enabled}
                    disabled={formData.use_clinic_default_late_rules}
                    onChange={(e) =>
                      setFormData({ ...formData, interest_enabled: e.target.checked })
                    }
                    className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                  />
                  Ativar juros
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={formData.interest_percent ?? ''}
                    disabled={
                      formData.use_clinic_default_late_rules || !formData.interest_enabled
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interest_percent: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50 disabled:text-gray-400"
                    placeholder="Juros (%)"
                  />

                  <select
                    value={formData.interest_period}
                    disabled={
                      formData.use_clinic_default_late_rules || !formData.interest_enabled
                    }
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        interest_period: e.target.value as 'monthly' | 'daily',
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white disabled:bg-gray-50 disabled:text-gray-400"
                  >
                    <option value="monthly">Ao mês</option>
                    <option value="daily">Ao dia</option>
                  </select>
                </div>

                <textarea
                  rows={3}
                  value={formData.late_fee_notes ?? ''}
                  disabled={formData.use_clinic_default_late_rules}
                  onChange={(e) =>
                    setFormData({ ...formData, late_fee_notes: e.target.value })
                  }
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none disabled:bg-gray-50 disabled:text-gray-400"
                  placeholder="Texto contratual específico para este tratamento."
                />

                <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                  <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">
                    Prévia
                  </p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    {lateRulePreviewText}
                  </p>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full mt-8 flex items-center justify-center gap-2 py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50"
            >
              {saving ? <Loader2 className="animate-spin h-5 w-5" /> : <Save size={20} />}
              <span>{isEdit ? 'Salvar Alterações' : 'Gerar Orçamento'}</span>
            </button>
          </div>
        </div>
      </form>

      {showPatientModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <UserPlus size={24} />
              <h3 className="text-xl font-bold">Salvar Paciente?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Você usou um paciente manual (<strong>{manualPatientData.full_name}</strong>). Deseja
              salvá-lo na sua base de pacientes para usos futuros?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSavePatientToCatalog}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Sim, salvar paciente
              </button>
              <button
                onClick={() => {
                  setShowPatientModal(false);
                  if (manualProceduresToSave.length > 0) {
                    setShowProcedureModal(true);
                  } else {
                    navigate(`/tratamentos/${savedTreatmentId}`);
                  }
                }}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Não, apenas salvar tratamento
              </button>
            </div>
          </div>
        </div>
      )}

      {showProcedureModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-blue-600 mb-4">
              <PlusCircle size={24} />
              <h3 className="text-xl font-bold">Salvar Procedimentos?</h3>
            </div>
            <p className="text-gray-600 mb-6">
              Você adicionou {manualProceduresToSave.length} procedimento(s) manual(is). Deseja
              salvá-los no seu catálogo para facilitar orçamentos futuros?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleSaveProceduresToCatalog}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors"
              >
                Sim, salvar no catálogo
              </button>
              <button
                onClick={() => {
                  setShowProcedureModal(false);
                  navigate(`/tratamentos/${savedTreatmentId}`);
                }}
                className="w-full py-3 bg-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-200 transition-colors"
              >
                Não, apenas salvar tratamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}