/**
 * Página de Detalhes da Parcela.
 * Exibe informações detalhadas de uma parcela específica e permite registrar o pagamento.
 * Nesta fase:
 * - usa a timezone oficial da aplicação
 * - evita deslocamento de data em pagamento
 * - grava o breakdown do pagamento no momento da baixa
 * - exibe a parcela paga com visão precisa
 * - só mostra a baixa para quem tem payments_register
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft,
  CreditCard,
  Calendar,
  User,
  ClipboardList,
  CheckCircle,
  AlertCircle,
  Loader2,
  DollarSign,
  FileText,
  Mail,
  Phone,
  Lock,
  Edit,
  Trash2,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getTodayDateInAppTimezone,
  formatDateOnlyForInput,
  parseDateOnlyAsLocalDate,
  cn,
} from '../lib/utils';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activities';
import { getPermissionSecuritySettings, PermissionSecuritySettingsRecord } from '../lib/appSettings';
import SensitiveActionDialog from '../components/SensitiveActionDialog';
import { useAuth } from '../contexts/AuthContext';
import { canViewOperationalFinancialData } from '@/src/domain/access/policies/financialScopePolicies';
import {
  getInstallmentEffectiveStatus,
  isInstallmentOverdue,
} from '../lib/businessRules';
import {
  calculateInstallmentLateChargeBreakdown,
  resolveLateRuleNotes,
} from '../lib/lateChargeRules';

function roundMoney(value: number) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function buildReferenceDate(dateString?: string | null) {
  const safeDateString = formatDateOnlyForInput(dateString || getTodayDateInAppTimezone());
  return parseDateOnlyAsLocalDate(safeDateString) || new Date();
}

export default function InstallmentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { hasPermission, financialScope } = useAuth();

  const canRegisterPayment = hasPermission('payments_register');
  const canEditReceivedPayment = hasPermission('payments_edit');
  const canViewOperationalFinancials = canViewOperationalFinancialData(financialScope);
  const renderAmount = (value: number) => canViewOperationalFinancials ? formatCurrency(value) : 'Acesso restrito';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [installment, setInstallment] = useState<any>(null);
  const [permissionSettings, setPermissionSettings] = useState<PermissionSecuritySettingsRecord | null>(null);

  const [paymentData, setPaymentData] = useState({
    amount_paid: 0,
    payment_date: getTodayDateInAppTimezone(),
    payment_method_used: 'PIX',
    notes: '',
  });

  const [paymentEditData, setPaymentEditData] = useState({
    amount_paid: 0,
    payment_date: getTodayDateInAppTimezone(),
    payment_method_used: 'PIX',
    notes: '',
  });
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [showDeletePaymentModal, setShowDeletePaymentModal] = useState(false);
  const [sensitiveActionBusy, setSensitiveActionBusy] = useState(false);
  const [sensitiveActionError, setSensitiveActionError] = useState<string | null>(null);
  const [sensitiveActionSuccess, setSensitiveActionSuccess] = useState<string | null>(null);
  const [editPaymentConfirmation, setEditPaymentConfirmation] = useState('');
  const [deletePaymentConfirmation, setDeletePaymentConfirmation] = useState('');

  useEffect(() => {
    fetchInstallment();
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

  function resetSensitiveActionState() {
    setSensitiveActionError(null);
    setSensitiveActionSuccess(null);
  }

  async function fetchInstallment() {
    if (!id) return;

    try {
      const { data, error } = await supabase
        .from('installments')
        .select(
          '*, treatments(patient_id, patient_name_snapshot, late_fee_enabled, late_fee_percent, interest_enabled, interest_percent, interest_period, late_fee_notes, patients(full_name))'
        )
        .eq('id', id)
        .single();

      if (error) throw error;

      setInstallment(data);

      const todayReferenceDate = buildReferenceDate(getTodayDateInAppTimezone());

      const lateChargeBreakdown = calculateInstallmentLateChargeBreakdown({
        installmentAmount: data.amount,
        amountPaid: data.amount_paid,
        dueDate: data.due_date,
        referenceDate: todayReferenceDate,
        rules: {
          late_fee_enabled: data.treatments?.late_fee_enabled,
          late_fee_percent: data.treatments?.late_fee_percent,
          interest_enabled: data.treatments?.interest_enabled,
          interest_percent: data.treatments?.interest_percent,
          interest_period: data.treatments?.interest_period,
          late_fee_notes: data.treatments?.late_fee_notes,
        },
      });

      const normalizedPaymentState = {
        amount_paid: lateChargeBreakdown.totalUpdatedAmount || data.amount,
        payment_date: data.status === 'paid'
          ? formatDateOnlyForInput(data.payment_date)
          : getTodayDateInAppTimezone(),
        payment_method_used: data.payment_method_used || 'PIX',
        notes: data.notes || '',
      };

      setPaymentData(normalizedPaymentState);
      setPaymentEditData(normalizedPaymentState);
    } catch (error) {
      console.error('Error fetching installment:', error);
      navigate('/parcelas');
    } finally {
      setLoading(false);
    }
  }

  const currentLateRules = useMemo(() => {
    return {
      late_fee_enabled: installment?.treatments?.late_fee_enabled,
      late_fee_percent: installment?.treatments?.late_fee_percent,
      interest_enabled: installment?.treatments?.interest_enabled,
      interest_percent: installment?.treatments?.interest_percent,
      interest_period: installment?.treatments?.interest_period,
      late_fee_notes: installment?.treatments?.late_fee_notes,
    };
  }, [installment]);

  const openInstallmentBreakdown = useMemo(() => {
    if (!installment) return null;

    const todayReferenceDate = buildReferenceDate(getTodayDateInAppTimezone());

    return calculateInstallmentLateChargeBreakdown({
      installmentAmount: installment.amount,
      amountPaid: installment.amount_paid,
      dueDate: installment.due_date,
      referenceDate: todayReferenceDate,
      rules: currentLateRules,
    });
  }, [installment, currentLateRules]);

  const paidInstallmentBreakdown = useMemo(() => {
    if (!installment) return null;

    const referenceDate = buildReferenceDate(installment.payment_date);

    const reconstructed = calculateInstallmentLateChargeBreakdown({
      installmentAmount: installment.amount,
      amountPaid: 0,
      dueDate: installment.due_date,
      referenceDate,
      rules: currentLateRules,
    });

    const principalAmount = roundMoney(
      installment.payment_principal_amount ?? installment.amount ?? 0
    );

    const lateFeePercent = Number(
      installment.payment_late_fee_percent ??
        (installment.treatments?.late_fee_enabled
          ? installment.treatments?.late_fee_percent || 0
          : 0)
    );

    const lateFeeAmount = roundMoney(
      installment.payment_late_fee_amount ?? reconstructed.lateFeeAmount ?? 0
    );

    const interestPercent = Number(
      installment.payment_interest_percent ??
        (installment.treatments?.interest_enabled
          ? installment.treatments?.interest_percent || 0
          : 0)
    );

    const interestPeriod =
      installment.payment_interest_period ||
      installment.treatments?.interest_period ||
      'monthly';

    const interestAmount = roundMoney(
      installment.payment_interest_amount ?? reconstructed.interestAmount ?? 0
    );

    const daysOverdue = Number(
      installment.payment_days_overdue ?? reconstructed.daysLate ?? 0
    );

    const actualPaidAmount = roundMoney(
      installment.amount_paid || installment.amount || 0
    );

    const totalChargesPaid = roundMoney(
      Math.max(actualPaidAmount - principalAmount, 0)
    );

    return {
      principalAmount,
      lateFeePercent,
      lateFeeAmount,
      interestPercent,
      interestPeriod,
      interestAmount,
      daysOverdue,
      actualPaidAmount,
      totalChargesPaid,
    };
  }, [installment, currentLateRules]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !installment || !canRegisterPayment) return;

    setSaving(true);

    try {
      const safePaymentDate = formatDateOnlyForInput(paymentData.payment_date);
      const paymentReferenceDate = buildReferenceDate(safePaymentDate);

      const paymentBreakdown = calculateInstallmentLateChargeBreakdown({
        installmentAmount: installment.amount,
        amountPaid: 0,
        dueDate: installment.due_date,
        referenceDate: paymentReferenceDate,
        rules: currentLateRules,
      });

      const { error: updateError } = await supabase
        .from('installments')
        .update({
          status: 'paid',
          amount_paid: paymentData.amount_paid,
          payment_date: safePaymentDate,
          payment_method_used: paymentData.payment_method_used,
          notes: paymentData.notes,
          payment_principal_amount: roundMoney(installment.amount || 0),
          payment_late_fee_percent: Number(
            currentLateRules.late_fee_enabled
              ? currentLateRules.late_fee_percent || 0
              : 0
          ),
          payment_late_fee_amount: roundMoney(paymentBreakdown.lateFeeAmount || 0),
          payment_interest_percent: Number(
            currentLateRules.interest_enabled
              ? currentLateRules.interest_percent || 0
              : 0
          ),
          payment_interest_period: currentLateRules.interest_enabled
            ? currentLateRules.interest_period || 'monthly'
            : null,
          payment_interest_amount: roundMoney(paymentBreakdown.interestAmount || 0),
          payment_days_overdue: Number(paymentBreakdown.daysLate || 0),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      const patientName =
        installment.treatments?.patients?.full_name ||
        installment.treatments?.patient_name_snapshot ||
        installment.patient_name_snapshot ||
        'Paciente';

      await logActivity(
        'payment_registered',
        `Pagamento de ${formatCurrency(paymentData.amount_paid)} recebido para a parcela #${installment.installment_number} do paciente ${patientName}`,
        { entity_id: id }
      );

      const { error: recordError } = await supabase.from('payment_records').insert({
        installment_id: id,
        amount_paid: paymentData.amount_paid,
        payment_date: safePaymentDate,
        payment_method: paymentData.payment_method_used,
        notes: paymentData.notes,
        principal_amount: roundMoney(installment.amount || 0),
        late_fee_percent: Number(
          currentLateRules.late_fee_enabled
            ? currentLateRules.late_fee_percent || 0
            : 0
        ),
        late_fee_amount: roundMoney(paymentBreakdown.lateFeeAmount || 0),
        interest_percent: Number(
          currentLateRules.interest_enabled
            ? currentLateRules.interest_percent || 0
            : 0
        ),
        interest_period: currentLateRules.interest_enabled
          ? currentLateRules.interest_period || 'monthly'
          : null,
        interest_amount: roundMoney(paymentBreakdown.interestAmount || 0),
        days_overdue: Number(paymentBreakdown.daysLate || 0),
      });

      if (recordError) throw recordError;

      await fetchInstallment();
      alert('Pagamento registrado com sucesso!');
    } catch (error: any) {
      console.error('Error recording payment:', error);
      alert(error.message || 'Erro ao registrar pagamento.');
    } finally {
      setSaving(false);
    }
  };

  async function handleUpdateReceivedPayment() {
    if (!id || !installment || !canEditReceivedPayment || effectiveStatus !== 'paid') return;

    if (
      (permissionSettings?.require_edit_received_payment_confirmation ?? true) &&
      editPaymentConfirmation.trim().toUpperCase() !== 'ALTERAR RECEBIMENTO'
    ) {
      setSensitiveActionError('Confirmação incorreta. Digite ALTERAR RECEBIMENTO para continuar.');
      return;
    }

    setSensitiveActionBusy(true);
    setSensitiveActionError(null);
    setSensitiveActionSuccess(null);

    try {
      const safePaymentDate = formatDateOnlyForInput(paymentEditData.payment_date);
      const paymentReferenceDate = buildReferenceDate(safePaymentDate);

      const paymentBreakdown = calculateInstallmentLateChargeBreakdown({
        installmentAmount: installment.amount,
        amountPaid: 0,
        dueDate: installment.due_date,
        referenceDate: paymentReferenceDate,
        rules: currentLateRules,
      });

      const { data, error } = await supabase.rpc('update_installment_payment_record_with_breakdown', {
        p_installment_id: id,
        p_amount_paid: paymentEditData.amount_paid,
        p_payment_date: safePaymentDate,
        p_payment_method: paymentEditData.payment_method_used,
        p_notes: paymentEditData.notes,
        p_principal_amount: roundMoney(installment.amount || 0),
        p_late_fee_percent: Number(
          currentLateRules.late_fee_enabled
            ? currentLateRules.late_fee_percent || 0
            : 0
        ),
        p_late_fee_amount: roundMoney(paymentBreakdown.lateFeeAmount || 0),
        p_interest_percent: Number(
          currentLateRules.interest_enabled
            ? currentLateRules.interest_percent || 0
            : 0
        ),
        p_interest_period: currentLateRules.interest_enabled
          ? currentLateRules.interest_period || 'monthly'
          : null,
        p_interest_amount: roundMoney(paymentBreakdown.interestAmount || 0),
        p_days_overdue: Number(paymentBreakdown.daysLate || 0),
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.message || 'Não foi possível atualizar o recebimento.');

      setSensitiveActionSuccess('Recebimento atualizado com sucesso.');
      await fetchInstallment();
      setTimeout(() => {
        setShowEditPaymentModal(false);
        setEditPaymentConfirmation('');
        resetSensitiveActionState();
      }, 900);
    } catch (error: any) {
      console.error('Error updating payment record:', error);
      setSensitiveActionError(error.message || 'Erro ao atualizar recebimento.');
    } finally {
      setSensitiveActionBusy(false);
    }
  }

  async function handleDeleteReceivedPayment() {
    if (!id || !installment || !canEditReceivedPayment || effectiveStatus !== 'paid') return;

    if (
      (permissionSettings?.require_delete_financial_record_confirmation ?? true) &&
      deletePaymentConfirmation.trim().toUpperCase() !== 'APAGAR RECEBIMENTO'
    ) {
      setSensitiveActionError('Confirmação incorreta. Digite APAGAR RECEBIMENTO para continuar.');
      return;
    }

    setSensitiveActionBusy(true);
    setSensitiveActionError(null);
    setSensitiveActionSuccess(null);

    try {
      const { data, error } = await supabase.rpc('delete_installment_payment_and_reopen', {
        p_installment_id: id,
      });

      if (error) throw error;
      if (data?.success === false) throw new Error(data.message || 'Não foi possível apagar o registro financeiro.');

      setSensitiveActionSuccess('Registro financeiro apagado com sucesso. Reabrindo a parcela...');
      await fetchInstallment();
      setTimeout(() => {
        setShowDeletePaymentModal(false);
        setDeletePaymentConfirmation('');
        resetSensitiveActionState();
      }, 900);
    } catch (error: any) {
      console.error('Error deleting payment record:', error);
      setSensitiveActionError(error.message || 'Erro ao apagar registro financeiro.');
    } finally {
      setSensitiveActionBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  const effectiveStatus = getInstallmentEffectiveStatus(installment);
  const isPaid = effectiveStatus === 'paid';
  const isActuallyOverdue = isInstallmentOverdue(installment);

  const lateRuleNotes = resolveLateRuleNotes(currentLateRules);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Parcela #{installment.installment_number}
          </h1>
          <p className="text-sm text-gray-500">
            Detalhes do pagamento, atraso e controle de baixa.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 pb-8 border-b">
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    'w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm',
                    isPaid ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                  )}
                >
                  {isPaid ? <CheckCircle size={32} /> : <CreditCard size={32} />}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                    {isPaid ? 'Valor Real Recebido' : 'Valor Principal da Parcela'}
                  </p>
                  <p className="text-3xl font-bold text-gray-900">
                    {renderAmount(
                      isPaid
                        ? paidInstallmentBreakdown?.actualPaidAmount || installment.amount_paid || installment.amount
                        : installment.amount
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">
                  Status Atual
                </p>
                <span
                  className={cn(
                    'px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider',
                    isPaid
                      ? 'bg-green-100 text-green-700'
                      : isActuallyOverdue
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  )}
                >
                  {isPaid ? 'Pago' : isActuallyOverdue ? 'Atrasado' : 'Pendente'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <Calendar className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                      Vencimento
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatDate(installment.due_date)}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <User className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                      Paciente
                    </p>
                    <Link
                      to={`/pacientes/${installment.treatments?.patient_id || installment.patient_id}`}
                      className="text-sm font-bold text-blue-600 hover:underline"
                    >
                      {installment.treatments?.patients?.full_name ||
                        installment.treatments?.patient_name_snapshot ||
                        installment.patient_name_snapshot ||
                        'Paciente'}
                    </Link>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <ClipboardList className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                      Tratamento
                    </p>
                    <Link
                      to={`/tratamentos/${installment.treatment_id}`}
                      className="text-sm font-bold text-blue-600 hover:underline"
                    >
                      #{installment.treatment_id?.slice(0, 8)}
                    </Link>
                  </div>
                </div>

                {isPaid && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-500 mt-0.5" size={18} />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                        Data do Pagamento
                      </p>
                      <p className="text-sm font-bold text-green-700">
                        {formatDate(installment.payment_date)}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {!isPaid && openInstallmentBreakdown && (
            <div className="bg-amber-50 rounded-xl border border-amber-100 p-8">
              <h3 className="font-bold text-amber-900 mb-4 flex items-center gap-2">
                <AlertCircle size={18} className="text-amber-600" />
                Cálculo Atualizado do Atraso
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-white/80 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">
                    Principal em Aberto
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(openInstallmentBreakdown.principalOpenAmount)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">
                    Dias de Atraso
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {openInstallmentBreakdown.daysLate}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">
                    Multa
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(openInstallmentBreakdown.lateFeeAmount)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-amber-100 px-4 py-3">
                  <p className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">
                    Juros
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(openInstallmentBreakdown.interestAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-white border border-amber-100 px-4 py-4">
                <p className="text-xs text-amber-700 uppercase font-bold tracking-wider mb-1">
                  Total Atualizado Hoje
                </p>
                <p className="text-2xl font-black text-amber-900">
                  {renderAmount(openInstallmentBreakdown.totalUpdatedAmount)}
                </p>
                <p className="text-xs text-amber-800 mt-2 leading-relaxed whitespace-pre-wrap">
                  {lateRuleNotes}
                </p>
              </div>
            </div>
          )}

          {isPaid && paidInstallmentBreakdown && (
            <div className="bg-green-50 rounded-xl border border-green-100 p-8">
              <h3 className="font-bold text-green-900 mb-4 flex items-center gap-2">
                <CheckCircle size={18} className="text-green-600" />
                Resumo do Recebimento
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-lg bg-white/80 border border-green-100 px-4 py-3">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                    Valor Principal
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(paidInstallmentBreakdown.principalAmount)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-green-100 px-4 py-3">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                    Valor Real Recebido
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(paidInstallmentBreakdown.actualPaidAmount)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-green-100 px-4 py-3">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                    Dias de Atraso
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {paidInstallmentBreakdown.daysOverdue}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-green-100 px-4 py-3">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                    Encargos Recebidos
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(paidInstallmentBreakdown.totalChargesPaid)}
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-green-100 px-4 py-3">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                    Multa Aplicada
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(paidInstallmentBreakdown.lateFeeAmount)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Percentual: {String(paidInstallmentBreakdown.lateFeePercent).replace('.', ',')}%
                  </p>
                </div>

                <div className="rounded-lg bg-white/80 border border-green-100 px-4 py-3">
                  <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                    Juros Aplicados
                  </p>
                  <p className="text-lg font-bold text-gray-900">
                    {renderAmount(paidInstallmentBreakdown.interestAmount)}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Percentual: {String(paidInstallmentBreakdown.interestPercent).replace('.', ',')}%
                    {' · '}
                    {paidInstallmentBreakdown.interestPeriod === 'daily' ? 'ao dia' : 'ao mês'}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-lg bg-white border border-green-100 px-4 py-4">
                <p className="text-xs text-green-700 uppercase font-bold tracking-wider mb-1">
                  Condição Contratual Considerada
                </p>
                <p className="text-xs text-green-800 leading-relaxed whitespace-pre-wrap">
                  {lateRuleNotes}
                </p>
              </div>
            </div>
          )}

          {!isPaid && !canViewOperationalFinancials && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Valores financeiros restritos</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-6">
                    Seu cargo pode acessar a parcela, mas não possui escopo financeiro para visualizar valores e encargos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isPaid && canViewOperationalFinancials && !canRegisterPayment && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Lock size={18} />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">Baixa restrita</h3>
                  <p className="text-sm text-gray-600 mt-1 leading-6">
                    Sua conta pode visualizar esta parcela, mas não possui permissão para registrar pagamentos.
                  </p>
                </div>
              </div>
            </div>
          )}

          {!isPaid && canRegisterPayment && canViewOperationalFinancials && (
            <form
              onSubmit={handlePayment}
              className="bg-white rounded-xl border shadow-sm overflow-hidden"
            >
              <div className="px-8 py-4 border-b bg-gray-50/50">
                <h3 className="font-bold text-gray-900">Registrar Pagamento</h3>
              </div>

              <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Pago (R$)
                  </label>
                  <div className="relative">
                    <DollarSign
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      size={16}
                    />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={paymentData.amount_paid ?? ''}
                      onChange={(e) =>
                        setPaymentData({
                          ...paymentData,
                          amount_paid: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1.5">
                    Valor sugerido para quitação hoje:{' '}
                    <strong>
                      {renderAmount(openInstallmentBreakdown?.totalUpdatedAmount || installment.amount)}
                    </strong>
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data do Recebimento
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentData.payment_date ?? ''}
                    onChange={(e) =>
                      setPaymentData({ ...paymentData, payment_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pagamento
                  </label>
                  <select
                    value={paymentData.payment_method_used ?? 'PIX'}
                    onChange={(e) =>
                      setPaymentData({
                        ...paymentData,
                        payment_method_used: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                    <textarea
                      rows={3}
                      value={paymentData.notes ?? ''}
                      onChange={(e) =>
                        setPaymentData({ ...paymentData, notes: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Ex: Pago via link, comprovante anexo..."
                    />
                  </div>
                </div>
              </div>

              <div className="px-8 py-4 bg-gray-50 border-t flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-8 py-2.5 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-100 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <CheckCircle size={18} />}
                  <span>Confirmar Recebimento</span>
                </button>
              </div>
            </form>
          )}

          {installment.notes && (
            <div className="bg-white rounded-xl border shadow-sm p-8">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2">
                <FileText size={18} className="text-blue-600" />
                Notas do Pagamento
              </h3>
              <p className="text-sm text-gray-600 leading-relaxed">{installment.notes}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-6">
          {isPaid && canEditReceivedPayment && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-4">Ações Sensíveis</h3>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => {
                    resetSensitiveActionState();
                    setEditPaymentConfirmation('');
                    setPaymentEditData({
                      amount_paid: installment.amount_paid || installment.amount || 0,
                      payment_date: formatDateOnlyForInput(installment.payment_date) || getTodayDateInAppTimezone(),
                      payment_method_used: installment.payment_method_used || 'PIX',
                      notes: installment.notes || '',
                    });
                    setShowEditPaymentModal(true);
                  }}
                  className="w-full py-2.5 px-4 bg-white hover:bg-gray-50 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 border"
                >
                  <Edit size={16} />
                  Editar recebimento
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetSensitiveActionState();
                    setDeletePaymentConfirmation('');
                    setShowDeletePaymentModal(true);
                  }}
                  className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 rounded-lg text-sm font-semibold text-red-700 transition-colors flex items-center gap-2 border border-red-100"
                >
                  <Trash2 size={16} />
                  Apagar recebimento
                </button>
              </div>
            </div>
          )}

          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
            <h3 className="font-bold text-lg mb-4">Ações de Cobrança</h3>
            <div className="space-y-3">
              <button className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                <Phone size={16} />
                Enviar Lembrete WhatsApp
              </button>
              <button className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                <Mail size={16} />
                Enviar Lembrete E-mail
              </button>
            </div>
          </div>
        </div>
      </div>

      {showEditPaymentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-xl font-bold">Editar recebimento já lançado</h3>
            </div>

            <div className="space-y-5">
              <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                <p className="text-sm text-amber-900 font-medium leading-6">
                  Esta ação altera um recebimento já lançado e impacta histórico, valores financeiros e rastreabilidade da parcela.
                </p>
              </div>

              {permissionSettings?.show_sensitive_action_warning && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl">
                  <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">
                    Orientação de segurança
                  </p>
                  <p className="text-xs text-blue-700 leading-relaxed whitespace-pre-wrap">
                    {permissionSettings.sensitive_action_guidance_text}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Valor Pago (R$)
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={paymentEditData.amount_paid ?? ''}
                      onChange={(e) =>
                        setPaymentEditData({
                          ...paymentEditData,
                          amount_paid: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Data do Recebimento
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentEditData.payment_date ?? ''}
                    onChange={(e) =>
                      setPaymentEditData({ ...paymentEditData, payment_date: e.target.value })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Método de Pagamento
                  </label>
                  <select
                    value={paymentEditData.payment_method_used ?? 'PIX'}
                    onChange={(e) =>
                      setPaymentEditData({
                        ...paymentEditData,
                        payment_method_used: e.target.value,
                      })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Observações
                  </label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                    <textarea
                      rows={3}
                      value={paymentEditData.notes ?? ''}
                      onChange={(e) =>
                        setPaymentEditData({ ...paymentEditData, notes: e.target.value })
                      }
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Descreva o motivo da alteração..."
                    />
                  </div>
                </div>
              </div>

              {(permissionSettings?.require_edit_received_payment_confirmation ?? true) && (
                <div className="space-y-3">
                  <label className="block text-sm font-bold text-gray-700">
                    Para confirmar, digite <span className="text-amber-700 font-black">ALTERAR RECEBIMENTO</span>:
                  </label>
                  <input
                    type="text"
                    value={editPaymentConfirmation}
                    onChange={(e) => setEditPaymentConfirmation(e.target.value)}
                    placeholder="Digite a confirmação aqui"
                    className="w-full px-4 py-3 border-2 border-amber-100 rounded-xl focus:border-amber-500 outline-none font-bold transition-colors"
                  />
                </div>
              )}

              {sensitiveActionError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium flex items-center gap-2">
                  <AlertCircle size={16} />
                  {sensitiveActionError}
                </div>
              )}

              {sensitiveActionSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg font-medium">
                  {sensitiveActionSuccess}
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditPaymentModal(false);
                  setEditPaymentConfirmation('');
                  resetSensitiveActionState();
                }}
                disabled={sensitiveActionBusy}
                className="flex-1 py-3 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleUpdateReceivedPayment}
                disabled={sensitiveActionBusy || ((permissionSettings?.require_edit_received_payment_confirmation ?? true) && editPaymentConfirmation.trim().toUpperCase() !== 'ALTERAR RECEBIMENTO')}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {sensitiveActionBusy ? <Loader2 className="animate-spin h-5 w-5" /> : 'Salvar alteração'}
              </button>
            </div>
          </div>
        </div>
      )}

      <SensitiveActionDialog
        open={showDeletePaymentModal}
        title="Apagar registro financeiro"
        description="Você está prestes a apagar o recebimento lançado desta parcela. A parcela será reaberta como pendente e o histórico financeiro deste lançamento será removido."
        guidanceText={permissionSettings?.show_sensitive_action_warning ? permissionSettings.sensitive_action_guidance_text : undefined}
        implications={[
          'O registro em payment_records será removido.',
          'A parcela voltará ao status Pendente.',
          'Os dados de pagamento e encargos lançados serão limpos da parcela.',
          'A ação ficará registrada no histórico de auditoria como operação crítica.',
        ]}
        tone="danger"
        typedLabel={(permissionSettings?.require_delete_financial_record_confirmation ?? true) ? 'APAGAR RECEBIMENTO' : undefined}
        typedValue={deletePaymentConfirmation}
        onTypedValueChange={setDeletePaymentConfirmation}
        confirmLabel="Apagar recebimento"
        onClose={() => {
          setShowDeletePaymentModal(false);
          setDeletePaymentConfirmation('');
          resetSensitiveActionState();
        }}
        onConfirm={handleDeleteReceivedPayment}
        busy={sensitiveActionBusy}
        confirmDisabled={(permissionSettings?.require_delete_financial_record_confirmation ?? true) && deletePaymentConfirmation.trim().toUpperCase() !== 'APAGAR RECEBIMENTO'}
        error={sensitiveActionError}
        successMessage={sensitiveActionSuccess}
      />
    </div>
  );
}