/**
 * Página de Detalhes do Tratamento.
 * Exibe informações completas de um tratamento, incluindo itens, parcelas e dados do paciente.
 * Permite gerenciar o plano de pagamento e realizar a exclusão segura do tratamento.
 *
 * Nesta fase, a tela também exibe as condições de multa e juros por atraso
 * salvas como snapshot no tratamento.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  ArrowLeft,
  Edit,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Plus,
  Loader2,
  Printer,
  CreditCard,
  FileText,
  X,
  Info,
  ShieldAlert,
  ChevronRight,
  DollarSign,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  getTodayDateInAppTimezone,
  formatDateOnlyForInput,
} from '../lib/utils';
import { useAuth } from '../contexts/AuthContext';
import { canViewOperationalFinancialData } from '@/src/domain/access/policies/financialScopePolicies';
import { resolvePatientName } from '../lib/businessRules';
import {
  getPaymentPlanValidationError,
  generatePaymentPlanPreview,
  replaceTreatmentPaymentPlan,
} from '../domain/paymentPlans/services/paymentPlanGenerationService';
import { PaymentPlanFormValues } from '../domain/paymentPlans/contracts/paymentPlanContracts';
import {
  buildLateRuleDescription,
  resolveLateRuleNotes,
} from '../lib/lateChargeRules';

export default function TreatmentDetailPage() {
  // Obtém o ID do tratamento da URL
  const { id } = useParams();
  // Hook para navegação
  const navigate = useNavigate();
  // Estado de carregamento da página
  const [loading, setLoading] = useState(true);
  // Dados do tratamento
  const [treatment, setTreatment] = useState<any>(null);
  // Itens (procedimentos) do tratamento
  const [items, setItems] = useState<any[]>([]);
  // Parcelas do plano de pagamento
  const [installments, setInstallments] = useState<any[]>([]);
  const [paymentPlan, setPaymentPlan] = useState<any>(null);
  // Estado de carregamento ao gerar parcelas
  const [isGenerating, setIsGenerating] = useState(false);
  // Erro ao gerar parcelas
  const [generateError, setGenerateError] = useState<string | null>(null);
  // Hook de autenticação para verificar permissões
  const { profile, financialScope } = useAuth();
  const canViewOperationalFinancials = canViewOperationalFinancialData(financialScope);
  const renderAmount = (value: number) => canViewOperationalFinancials ? formatCurrency(value) : 'Acesso restrito';
  // Controle do modal de geração de parcelas
  const [showInstallmentModal, setShowInstallmentModal] = useState(false);
  // Controle do modal de cancelamento
  const [showCancelModal, setShowCancelModal] = useState(false);
  // Controle do modal de exclusão permanente
  const [showPermanentDeleteModal, setShowPermanentDeleteModal] = useState(false);
  // Confirmação para exclusão permanente
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  // Estatísticas para o modal de exclusão
  const [stats, setStats] = useState({
    plans: 0,
    installments: 0,
    payments: 0,
    items: 0,
  });
  // Estado de carregamento ao excluir
  const [deleting, setDeleting] = useState(false);
  // Erro ao excluir
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Sucesso ao excluir
  const [deleteSuccess, setDeleteSuccess] = useState(false);

  // Estado do formulário de geração de parcelas
  const [installmentForm, setInstallmentForm] = useState<PaymentPlanFormValues>({
  count: 1,
  firstDueDate: getTodayDateInAppTimezone(),
  interval: 'monthly',
  adjustLast: true,
  });

  // Busca os dados ao carregar a página ou mudar o ID
  useEffect(() => {
    fetchData();
  }, [id]);

  /**
   * Preview central do parcelamento.
   * A página passa a consumir o cálculo vindo do domínio,
   * e não mais recalcular localmente.
   */
  const contractedTotal = treatment?.total_amount || 0;
  const entryAmount = treatment?.entry_amount || 0;
  const amountToFinance =
    treatment?.amount_to_finance ?? Math.max(contractedTotal - entryAmount, 0);

  /**
   * Texto técnico e texto final das condições de atraso.
   * - lateRuleDescription: resumo objetivo
   * - lateRuleNotes: texto final mostrado ao usuário
   */
  const lateRuleDescription = buildLateRuleDescription({
    late_fee_enabled: treatment?.late_fee_enabled,
    late_fee_percent: treatment?.late_fee_percent,
    interest_enabled: treatment?.interest_enabled,
    interest_percent: treatment?.interest_percent,
    interest_period: treatment?.interest_period,
    late_fee_notes: treatment?.late_fee_notes,
  });

  const lateRuleNotes = resolveLateRuleNotes({
    late_fee_enabled: treatment?.late_fee_enabled,
    late_fee_percent: treatment?.late_fee_percent,
    interest_enabled: treatment?.interest_enabled,
    interest_percent: treatment?.interest_percent,
    interest_period: treatment?.interest_period,
    late_fee_notes: treatment?.late_fee_notes,
  });

  const installmentPreview = useMemo(() => {
    if (amountToFinance <= 0) {
      return null;
    }

    try {
      return generatePaymentPlanPreview({
        amountToFinance,
        installmentCount: installmentForm.count,
        firstDueDate: installmentForm.firstDueDate,
        intervalType: installmentForm.interval,
        adjustLastInstallment: installmentForm.adjustLast,
      });
    } catch {
      return null;
    }
  }, [
    amountToFinance,
    installmentForm.count,
    installmentForm.firstDueDate,
    installmentForm.interval,
    installmentForm.adjustLast,
  ]);

  /**
   * Busca todos os dados relacionados ao tratamento (tratamento, itens e parcelas).
   */
  async function fetchData() {
    if (!id) return;
    setLoading(true);

    try {
      // Busca dados básicos do tratamento com join de paciente
      const { data: tData, error: tError } = await supabase
        .from('treatments')
        .select('*, patients(full_name)')
        .eq('id', id)
        .single();

      if (tError) throw tError;
      setTreatment(tData);

      // Busca itens e parcelas em paralelo
      const [itemsRes, installmentsRes, planRes] = await Promise.all([
        supabase.from('treatment_items').select('*').eq('treatment_id', id),
        supabase
          .from('installments')
          .select('*')
          .eq('treatment_id', id)
          .order('installment_number', { ascending: true }),
        supabase.from('payment_plans').select('*').eq('treatment_id', id).maybeSingle(),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (installmentsRes.error) throw installmentsRes.error;
      if (planRes.error) throw planRes.error;

      setItems(itemsRes.data || []);
      setInstallments(installmentsRes.data || []);
      setPaymentPlan(planRes.data || null);

      if (planRes.data) {
        setInstallmentForm({
          count: planRes.data.installment_count || 1,
          firstDueDate:
            formatDateOnlyForInput(planRes.data.first_due_date) ||
            getTodayDateInAppTimezone(),
          interval: planRes.data.interval_type || 'monthly',
          adjustLast: planRes.data.adjust_last_installment ?? true,
        });
      }
    } catch (error) {
      console.error('Error fetching treatment details:', error);
      navigate('/tratamentos');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Busca estatísticas de registros relacionados para o modal de exclusão.
   */
  const fetchDeletionStats = async () => {
    if (!id) return;
    try {
      const [plansRes, paymentsRes] = await Promise.all([
        supabase
          .from('payment_plans')
          .select('id', { count: 'exact', head: true })
          .eq('treatment_id', id),
        supabase
          .from('payment_records')
          .select('id, installments!inner(id)', { count: 'exact', head: true })
          .eq('installments.treatment_id', id),
      ]);

      setStats({
        plans: plansRes.count || 0,
        installments: installments.length,
        payments: paymentsRes.count || 0,
        items: items.length,
      });
    } catch (error) {
      console.error('Error fetching deletion stats:', error);
    }
  };

  /**
   * Lida com o cancelamento do tratamento (Lógico).
   * Apenas altera o status para 'cancelled' e preserva o histórico.
   */
  const handleCancelTreatment = async () => {
    if (!id) return;
    setDeleting(true);
    setDeleteError(null);

    try {
      const { error: updateError } = await supabase
        .from('treatments')
        .update({
          status: 'cancelled',
          updated_at: new Date().toISOString(),
        })
        .eq('id', id);

      if (updateError) throw updateError;

      const { logActivity } = await import('../lib/activities');
      await logActivity(
        'treatment_cancelled',
        `Tratamento #${id.slice(0, 8)} cancelado`,
        { entity_id: id }
      );

      setDeleteSuccess(true);
      setTimeout(() => {
        setShowCancelModal(false);
        setDeleteSuccess(false);
        fetchData();
      }, 2000);
    } catch (error: any) {
      console.error('Error cancelling treatment:', error);
      setDeleteError(error.message || 'Erro ao cancelar tratamento.');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Lida com a exclusão permanente do tratamento (Físico).
   * Chama a RPC no banco de dados para garantir atomicidade e integridade.
   */
  const handlePermanentDelete = async () => {
    if (!id) return;

    const expectedConfirmation = id.slice(0, 8).toUpperCase();
    if (
      deleteConfirmation.toUpperCase() !== 'EXCLUIR' &&
      deleteConfirmation.toUpperCase() !== expectedConfirmation
    ) {
      setDeleteError(
        `Confirmação incorreta. Digite EXCLUIR ou ${expectedConfirmation}.`
      );
      return;
    }

    setDeleting(true);
    setDeleteError(null);

    try {
      const { data, error } = await supabase.rpc('permanently_delete_treatment', {
        p_treatment_id: id,
      });

      if (error) throw error;

      if (data && !data.success) {
        throw new Error(data.message);
      }

      setDeleteSuccess(true);
      setTimeout(() => {
        navigate('/tratamentos');
      }, 1500);
    } catch (error: any) {
      console.error('Error permanently deleting treatment:', error);
      setDeleteError(error.message || 'Erro ao processar exclusão permanente.');
    } finally {
      setDeleting(false);
    }
  };

  /**
   * Gera o plano de parcelamento para o tratamento.
   * Agora a página delega a regra de cálculo ao serviço central do domínio.
   */
  const generateInstallments = async () => {
    if (!id) return;

    const validationError = getPaymentPlanValidationError({
      amountToFinance,
      installmentCount: installmentForm.count,
      firstDueDate: installmentForm.firstDueDate,
      intervalType: installmentForm.interval,
      adjustLastInstallment: installmentForm.adjustLast,
    });

    if (validationError) {
      setGenerateError(validationError);
      return;
    }

    setIsGenerating(true);
    setGenerateError(null);

    try {
      await replaceTreatmentPaymentPlan({
        treatmentId: id,
        amountToFinance,
        installmentCount: installmentForm.count,
        firstDueDate: installmentForm.firstDueDate,
        intervalType: installmentForm.interval,
        adjustLastInstallment: installmentForm.adjustLast,
      });

      const { logActivity } = await import('../lib/activities');
      await logActivity(
        paymentPlan ? 'installment_recalculated' : 'installment_generated',
        `${
          paymentPlan ? 'Plano de pagamento recalculado' : 'Plano de pagamento gerado'
        } (${installmentForm.count}x) para o tratamento #${id.slice(0, 8)}`,
        { entity_id: id }
      );

      setShowInstallmentModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error generating installments:', error);
      setGenerateError(error.message || 'Erro ao gerar/recalcular parcelas.');
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Retorna o badge de status estilizado.
   */
  const getStatusBadge = (status: string) => {
    const styles: any = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: any = {
      draft: 'Rascunho',
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    };
    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${styles[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  /**
   * Abre a página de impressão em uma nova aba.
   */
  const handlePrint = () => {
    window.open(`/tratamentos/${id}/imprimir`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (!treatment) {
    return null;
  }

  return (
    <div className="space-y-8 print:space-y-6 print:p-0">
      {/* Cabeçalho de Impressão */}
      <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              Nord Odonto
            </h1>
            <p className="text-sm text-gray-500">Relatório de Tratamento e Orçamento</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold">
              Data de Emissão: {formatDate(new Date())}
            </p>  
            <p className="text-xs text-gray-500">ID: {treatment.id}</p>
          </div>
        </div>
      </div>

      {/* Cabeçalho principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/tratamentos')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">
                Tratamento #{treatment.id.slice(0, 8)}
              </h1>
              {getStatusBadge(treatment.status)}
            </div>
            <p className="text-sm text-gray-500">
              Criado em {formatDate(treatment.created_at)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3 print:hidden">
          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors cursor-pointer text-sm"
          >
            <Printer size={18} />
            <span>Imprimir</span>
          </button>

          <Link
            to={`/tratamentos/${id}/editar`}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors text-sm"
          >
            <Edit size={18} />
            <span>Editar</span>
          </Link>

          <button
            onClick={() => setShowCancelModal(true)}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-amber-200 text-amber-700 font-semibold hover:bg-amber-50 transition-colors text-sm"
          >
            <X size={18} />
            <span>Cancelar</span>
          </button>

          {(profile?.role === 'admin' || profile?.role === 'financeiro') && (
            <button
              onClick={() => {
                fetchDeletionStats();
                setShowPermanentDeleteModal(true);
              }}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-3 sm:px-4 py-2 border border-red-200 text-red-600 font-semibold hover:bg-red-50 transition-colors text-sm"
            >
              <Trash2 size={18} />
              <span>Excluir</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Resumo do paciente */}
          <div className="bg-white rounded-xl border shadow-sm p-6 flex items-center justify-between print:border-none print:shadow-none print:p-0">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold print:hidden">
                {resolvePatientName(treatment).charAt(0)}
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">
                  Paciente
                </p>
                <div className="text-lg font-bold text-gray-900">
                  {resolvePatientName(treatment)}
                </div>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">{treatment.patient_phone_snapshot}</p>
              <p className="text-sm text-gray-600">{treatment.patient_email_snapshot}</p>
            </div>
          </div>

          {!canViewOperationalFinancials && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
              Seu cargo pode acessar este tratamento, mas os valores financeiros e o plano de pagamento estão ocultos para este perfil.
            </div>
          )}

          {/* Tabela de itens */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:border-none print:shadow-none">
            <div className="px-6 py-4 border-b bg-gray-50/50 print:bg-transparent print:px-0">
              <h3 className="font-bold text-gray-900">Procedimentos Inclusos</h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b print:bg-gray-50">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2">
                      Procedimento
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2">
                      Qtd
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2">
                      Unitário
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right print:px-2">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.length > 0 ? (
                    items.map((item) => (
                      <tr key={item.id}>
                        <td className="px-6 py-4 text-sm font-medium text-gray-900 print:px-2 print:py-2">
                          {item.procedure_name_snapshot ||
                            item.procedure_name ||
                            'Procedimento'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 print:px-2 print:py-2">
                          {item.quantity}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 print:px-2 print:py-2">
                          {renderAmount(item.unit_price_snapshot)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right print:px-2 print:py-2">
                          {renderAmount(item.line_total)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-6 py-8 text-center text-gray-500 text-sm"
                      >
                        Nenhum procedimento incluído neste tratamento.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {items.length > 0 ? (
                items.map((item) => (
                  <div key={item.id} className="p-4 space-y-2">
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-gray-900">
                        {item.procedure_name_snapshot ||
                          item.procedure_name ||
                          'Procedimento'}
                      </p>
                      <p className="text-sm font-bold text-blue-600">
                        {renderAmount(item.line_total)}
                      </p>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Qtd: {item.quantity}</span>
                      <span>Unit: {renderAmount(item.unit_price_snapshot)}</span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Nenhum procedimento incluído neste tratamento.
                </div>
              )}
            </div>

            <div className="bg-gray-50/50 p-4 space-y-2 print:bg-transparent print:px-0">
              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-500">Subtotal</span>
                <span className="font-bold text-gray-900">
                  {renderAmount(treatment.subtotal)}
                </span>
              </div>

              {treatment.discount_amount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-red-500">Desconto</span>
                  <span className="font-bold text-red-500">
                    -{renderAmount(treatment.discount_amount)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-sm">
                <span className="font-medium text-gray-500">Total Contratado</span>
                <span className="font-bold text-gray-900">
                  {renderAmount(contractedTotal)}
                </span>
              </div>

              {entryAmount > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-gray-500">Entrada</span>
                  <span className="font-bold text-gray-900">
                    {renderAmount(entryAmount)}
                  </span>
                </div>
              )}

              <div className="pt-2 border-t-2 border-gray-200 flex justify-between items-center">
                <div>
                  <span className="text-base font-bold text-gray-900 block">
                    Saldo a Parcelar
                  </span>
                  <span className="text-[11px] text-gray-400">
                    Base atual do plano de pagamento
                  </span>
                </div>
                <span className="text-xl font-bold text-blue-600">
                  {renderAmount(amountToFinance)}
                </span>
              </div>
            </div>
          </div>

          {/* Seção de parcelas */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:border-none print:shadow-none">
            <div className="px-6 py-4 border-b bg-gray-50/50 flex items-center justify-between print:bg-transparent print:px-0">
              <h3 className="font-bold text-gray-900">Plano de Pagamento</h3>

              {amountToFinance > 0 && canViewOperationalFinancials && (
                <button
                  onClick={() => {
                    setGenerateError(null);
                    setShowInstallmentModal(true);
                  }}
                  className="inline-flex items-center gap-2 text-sm font-bold text-blue-600 hover:underline print:hidden"
                >
                  <Plus size={16} />
                  {installments.length === 0 ? 'Gerar Parcelas' : 'Recalcular Parcelas'}
                </button>
              )}
            </div>

            <div className="divide-y">
              {installments.length > 0 ? (
                installments.map((inst) => (
                  <div
                    key={inst.id}
                    className="px-4 md:px-6 py-4 flex flex-col md:flex-row md:items-center justify-between hover:bg-gray-50 transition-colors print:px-2 print:py-2 gap-3"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={cn(
                          'w-10 h-10 rounded-lg flex items-center justify-center print:hidden shrink-0',
                          inst.status === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : inst.status === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {inst.status === 'paid' ? (
                          <CheckCircle size={20} />
                        ) : inst.status === 'overdue' ? (
                          <AlertCircle size={20} />
                        ) : (
                          <Clock size={20} />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">
                          Parcela {inst.installment_number}
                        </p>
                        <p className="text-xs text-gray-500">
                          Vencimento: {formatDate(inst.due_date)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between md:justify-end gap-6">
                      <div className="text-left md:text-right">
                        <p className="text-sm font-bold text-gray-900">
                          {renderAmount(inst.amount)}
                        </p>
                        <p
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-wider',
                            inst.status === 'paid'
                              ? 'text-green-600'
                              : inst.status === 'overdue'
                              ? 'text-red-600'
                              : 'text-gray-400'
                          )}
                        >
                          {inst.status === 'paid'
                            ? 'Pago'
                            : inst.status === 'overdue'
                            ? 'Atrasado'
                            : 'Pendente'}
                        </p>
                      </div>

                      <Link
                        to={`/parcelas/${inst.id}`}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-full transition-colors print:hidden"
                      >
                        <ChevronRight size={20} />
                      </Link>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-12 text-center print:hidden">
                  <p className="text-gray-500">
                    {amountToFinance > 0
                      ? 'Nenhum plano de pagamento gerado para este tratamento.'
                      : 'Este tratamento não possui saldo a parcelar. A entrada cobre todo o valor contratado.'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Coluna lateral */}
        <div className="lg:col-span-1 space-y-6">
          {/* Preferência de pagamento */}
          <div className="bg-white rounded-xl border shadow-sm p-6 print:border-none print:shadow-none print:p-0">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2 border-b pb-2 print:mb-2">
              <DollarSign size={18} className="text-blue-600 print:hidden" />
              Preferência de Pagamento
            </h3>
            <p className="text-sm text-gray-700 font-medium">
              {treatment.payment_method_preference || 'Não especificada'}
            </p>
          </div>

          {/* NOVO CARD: Condições em Caso de Atraso */}
          <div className="bg-white rounded-xl border shadow-sm p-6 print:border-none print:shadow-none print:p-0">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2 print:mb-2">
              <AlertCircle size={18} className="text-amber-600 print:hidden" />
              Condições em Caso de Atraso
            </h3>

            <div className="space-y-3">
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                {lateRuleNotes}
              </p>

              <div className="text-[11px] text-gray-400">
                {treatment.use_clinic_default_late_rules
                  ? 'Snapshot baseado no padrão da clínica no momento do orçamento.'
                  : 'Regra personalizada diretamente neste tratamento.'}
              </div>

              <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider mb-1">
                  Resumo técnico
                </p>
                <p className="text-xs text-amber-900 leading-relaxed">
                  {lateRuleDescription}
                </p>
              </div>
            </div>
          </div>

          {/* Notas adicionais */}
          <div className="bg-white rounded-xl border shadow-sm p-6 print:border-none print:shadow-none print:p-0">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2 border-b pb-2 print:mb-2">
              <FileText size={18} className="text-blue-600 print:hidden" />
              Notas
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {treatment.notes || 'Sem observações.'}
            </p>
          </div>
        </div>
      </div>

      {/* Modal de geração de parcelas */}
      {showInstallmentModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <CreditCard size={24} />
                </div>
                <h3 className="text-xl font-bold text-gray-900">
                  {installments.length === 0 ? 'Gerar Parcelas' : 'Recalcular Parcelas'}
                </h3>
              </div>
              <button
                onClick={() => setShowInstallmentModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {generateError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium flex items-center gap-2">
                  <AlertCircle size={16} />
                  {generateError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Saldo a Parcelar
                </label>
                <div className="w-full px-4 py-2 bg-gray-50 border rounded-lg font-bold text-gray-900">
                  {renderAmount(amountToFinance)}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  O plano é gerado sobre o saldo restante após desconto e entrada.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Qtd. Parcelas
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={installmentForm.count}
                    onChange={(e) =>
                      setInstallmentForm({
                        ...installmentForm,
                        count: parseInt(e.target.value) || 1,
                      })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Intervalo
                  </label>
                  <select
                    value={installmentForm.interval}
                    onChange={(e) =>
                      setInstallmentForm({
                        ...installmentForm,
                        interval: e.target.value as 'monthly' | 'biweekly' | 'weekly',
                      })
                    }
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="monthly">Mensal</option>
                    <option value="biweekly">Quinzenal</option>
                    <option value="weekly">Semanal</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Primeiro Vencimento
                </label>
                <input
                  type="date"
                  value={installmentForm.firstDueDate}
                  onChange={(e) =>
                    setInstallmentForm({
                      ...installmentForm,
                      firstDueDate: e.target.value,
                    })
                  }
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex items-center gap-2 py-2">
                <input
                  type="checkbox"
                  id="adjustLast"
                  checked={installmentForm.adjustLast}
                  onChange={(e) =>
                    setInstallmentForm({
                      ...installmentForm,
                      adjustLast: e.target.checked,
                    })
                  }
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="adjustLast" className="text-sm text-gray-600">
                  Ajustar última parcela para fechar valor exato
                </label>
              </div>

              <div className="bg-blue-50 p-4 rounded-xl flex gap-3">
                <Info size={20} className="text-blue-600 shrink-0" />
                <div className="text-xs text-blue-700 leading-relaxed space-y-1">
                  <p>
                    Valor base das parcelas:{' '}
                    <strong>
                      {renderAmount(installmentPreview?.baseInstallmentAmount || 0)}
                    </strong>
                  </p>

                  {installmentPreview?.installments.length ? (
                    <p>
                      Última parcela prevista:{' '}
                      <strong>
                        {renderAmount(
                          installmentPreview.installments[
                            installmentPreview.installments.length - 1
                          ].amount
                        )}
                      </strong>
                    </p>
                  ) : null}

                  <p>O status inicial será "Pendente".</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => setShowInstallmentModal(false)}
                className="flex-1 py-3 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={generateInstallments}
                disabled={isGenerating}
                className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  'Confirmar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center gap-3 text-amber-600 mb-4">
              <AlertCircle size={24} />
              <h3 className="text-xl font-bold">Cancelar Tratamento</h3>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">
                Deseja alterar o status do tratamento para <strong>Cancelado</strong>?
              </p>

              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl flex gap-3">
                <Info size={20} className="text-blue-600 shrink-0" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  Esta ação preserva todo o histórico financeiro e registros do tratamento
                  para referência futura. O tratamento continuará visível no sistema com o
                  status "Cancelado".
                </p>
              </div>

              {deleteError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium">
                  {deleteError}
                </div>
              )}

              {deleteSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg font-medium flex items-center gap-2">
                  <CheckCircle size={16} />
                  Tratamento cancelado com sucesso!
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  setShowCancelModal(false);
                  setDeleteError(null);
                }}
                className="flex-1 py-3 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCancelTreatment}
                disabled={deleting}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-colors shadow-lg shadow-amber-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <Loader2 className="animate-spin h-5 w-5" />
                ) : (
                  'Confirmar Cancelamento'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão Permanente */}
      {showPermanentDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl overflow-y-auto max-h-[90vh]">
            <div className="flex items-center gap-3 text-red-600 mb-4">
              <ShieldAlert size={28} />
              <h3 className="text-2xl font-black uppercase tracking-tight">
                Exclusão Permanente
              </h3>
            </div>

            <div className="space-y-6">
              <div className="p-4 bg-red-50 border border-red-100 rounded-xl">
                <p className="text-sm text-red-800 font-bold mb-2">
                  ATENÇÃO: ESTA AÇÃO É IRREVERSÍVEL
                </p>
                <p className="text-xs text-red-700 leading-relaxed">
                  Você está prestes a apagar completamente este tratamento e todos os seus
                  registros financeiros. Será como se o tratamento nunca tivesse existido no
                  banco de dados.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">
                    ID do Tratamento
                  </p>
                  <p className="text-sm font-mono font-bold text-gray-700">
                    {treatment.id.slice(0, 8)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Paciente</p>
                  <p className="text-sm font-bold text-gray-700 truncate">
                    {treatment.patient_name_snapshot}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Valor Total</p>
                  <p className="text-sm font-bold text-gray-700">
                    {renderAmount(treatment.total_amount)}
                  </p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border">
                  <p className="text-[10px] text-gray-400 uppercase font-bold">Itens</p>
                  <p className="text-sm font-bold text-gray-700">
                    {stats.items} procedimentos
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Registros que serão removidos:
                </p>
                <ul className="text-xs text-gray-600 space-y-1 list-disc pl-4">
                  <li>{stats.plans} Plano de pagamento</li>
                  <li>{stats.installments} Parcelas financeiras</li>
                  <li>{stats.payments} Registros de recebimento/pagamento</li>
                  <li>Histórico de comunicações e logs de atividade relacionados</li>
                  <li>O próprio registro do tratamento</li>
                </ul>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-bold text-gray-700">
                  Para confirmar, digite{' '}
                  <span className="text-red-600 font-black">EXCLUIR</span> ou o ID{' '}
                  <span className="text-red-600 font-black">
                    {treatment.id.slice(0, 8).toUpperCase()}
                  </span>
                  :
                </label>
                <input
                  type="text"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  placeholder="Digite aqui para confirmar"
                  className="w-full px-4 py-3 border-2 border-red-100 rounded-xl focus:border-red-500 outline-none font-bold transition-colors"
                />
              </div>

              {deleteError && (
                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg font-medium flex items-center gap-2">
                  <AlertCircle size={16} />
                  {deleteError}
                </div>
              )}

              {deleteSuccess && (
                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg font-medium flex items-center gap-2">
                  <CheckCircle size={16} />
                  Exclusão realizada com sucesso! Redirecionando...
                </div>
              )}
            </div>

            <div className="mt-8 flex gap-3">
              <button
                onClick={() => {
                  setShowPermanentDeleteModal(false);
                  setDeleteError(null);
                  setDeleteConfirmation('');
                }}
                className="flex-1 py-3 border rounded-xl font-bold text-gray-600 hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handlePermanentDelete}
                disabled={deleting || !deleteConfirmation}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-colors shadow-lg shadow-red-100 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? <Loader2 className="animate-spin h-5 w-5" /> : 'Apagar Tudo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Utilitário para combinar classes CSS.
 */
function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}