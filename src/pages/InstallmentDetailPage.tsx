/**
 * Página de Detalhes da Parcela.
 * Exibe informações detalhadas de uma parcela específica e permite registrar o pagamento.
 */
import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  ArrowLeft, 
  CreditCard, 
  Calendar, 
  User, 
  ClipboardList, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Loader2,
  Save,
  DollarSign,
  FileText,
  Mail
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/activities';

/**
 * Página de Detalhes da Parcela.
 * Exibe informações detalhadas de uma parcela específica e permite registrar o pagamento.
 */
export default function InstallmentDetailPage() {
  // Obtém o ID da parcela da URL
  const { id } = useParams();
  // Hook para navegação
  const navigate = useNavigate();
  // Estado de carregamento da página
  const [loading, setLoading] = useState(true);
  // Estado de salvamento do pagamento
  const [saving, setSaving] = useState(false);
  // Dados da parcela
  const [installment, setInstallment] = useState<any>(null);
  // Dados do formulário de pagamento
  const [paymentData, setPaymentData] = useState({
    amount_paid: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method_used: 'PIX',
    notes: ''
  });

  // Efeito para buscar os dados da parcela ao carregar a página
  useEffect(() => {
    fetchInstallment();
  }, [id]);

  /**
   * Busca os dados da parcela no banco de dados.
   */
  async function fetchInstallment() {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from('installments')
        .select('*, treatments(patient_id, patient_name_snapshot, patients(full_name))')
        .eq('id', id)
        .single();

      if (error) throw error;
      setInstallment(data);
      
      // Inicializa os dados do pagamento com os valores da parcela
      setPaymentData({
        ...paymentData,
        amount_paid: data.amount,
        payment_method_used: data.payment_method_used || 'PIX',
        notes: data.notes || ''
      });
    } catch (error) {
      console.error('Error fetching installment:', error);
      navigate('/parcelas');
    } finally {
      setLoading(false);
    }
  }

  /**
   * Lida com o registro do pagamento da parcela.
   */
  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !installment) return;
    setSaving(true);

    try {
      // Atualiza o status da parcela para "pago" e registra os dados do pagamento
      const { error: updateError } = await supabase
        .from('installments')
        .update({
          status: 'paid',
          amount_paid: paymentData.amount_paid,
          payment_date: paymentData.payment_date,
          payment_method_used: paymentData.payment_method_used,
          notes: paymentData.notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (updateError) throw updateError;
      
      // Registra a atividade no log
      await logActivity('payment_registered', `Pagamento de ${formatCurrency(paymentData.amount_paid)} recebido para a parcela #${installment.installment_number} do paciente ${installment.patient_name_snapshot || 'Paciente'}`, { entity_id: id });

      // Cria um registro de pagamento na tabela payment_records
      const { error: recordError } = await supabase
        .from('payment_records')
        .insert({
          installment_id: id,
          amount_paid: paymentData.amount_paid,
          payment_date: paymentData.payment_date,
          payment_method: paymentData.payment_method_used,
          notes: paymentData.notes
        });

      if (recordError) throw recordError;

      // Recarrega os dados da parcela
      await fetchInstallment();
      alert('Pagamento registrado com sucesso!');
    } catch (error: any) {
      console.error('Error recording payment:', error);
      alert(error.message || 'Erro ao registrar pagamento.');
    } finally {
      setSaving(false);
    }
  };

  // Exibe loader durante o carregamento inicial
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  // Verifica se a parcela já está paga
  const isPaid = installment.status === 'paid';

  return (
    <div className="space-y-8">
      {/* Cabeçalho de navegação */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={20} className="text-gray-600" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcela #{installment.installment_number}</h1>
          <p className="text-sm text-gray-500">Detalhes do pagamento e controle de baixa.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          {/* Informações Principais da Parcela */}
          <div className="bg-white rounded-xl border shadow-sm p-8">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-8 pb-8 border-b">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm",
                  isPaid ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"
                )}>
                  {isPaid ? <CheckCircle size={32} /> : <CreditCard size={32} />}
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Valor da Parcela</p>
                  <p className="text-3xl font-bold text-gray-900">{formatCurrency(installment.amount)}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-1">Status Atual</p>
                <span className={cn(
                  "px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider",
                  installment.status === 'paid' ? "bg-green-100 text-green-700" : 
                  installment.status === 'overdue' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                )}>
                  {installment.status === 'paid' ? 'Pago' : installment.status === 'overdue' ? 'Atrasado' : 'Pendente'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
              <div className="space-y-4">
                {/* Data de Vencimento */}
                <div className="flex items-start gap-3">
                  <Calendar className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Vencimento</p>
                    <p className="text-sm font-bold text-gray-900">{formatDate(installment.due_date)}</p>
                  </div>
                </div>
                {/* Dados do Paciente */}
                <div className="flex items-start gap-3">
                  <User className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Paciente</p>
                    <Link to={`/pacientes/${installment.treatments?.patient_id || installment.patient_id}`} className="text-sm font-bold text-blue-600 hover:underline">
                      {installment.treatments?.patients?.full_name || 
                       installment.treatments?.patient_name_snapshot || 
                       installment.patient_name_snapshot || 
                       'Paciente'}
                    </Link>
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                {/* Dados do Tratamento */}
                <div className="flex items-start gap-3">
                  <ClipboardList className="text-gray-400 mt-0.5" size={18} />
                  <div>
                    <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Tratamento</p>
                    <Link to={`/tratamentos/${installment.treatment_id}`} className="text-sm font-bold text-blue-600 hover:underline">
                      #{installment.treatment_id?.slice(0, 8)}
                    </Link>
                  </div>
                </div>
                {/* Data do Pagamento (se pago) */}
                {isPaid && (
                  <div className="flex items-start gap-3">
                    <CheckCircle className="text-green-500 mt-0.5" size={18} />
                    <div>
                      <p className="text-xs text-gray-400 uppercase font-bold tracking-wider">Data do Pagamento</p>
                      <p className="text-sm font-bold text-green-700">{formatDate(installment.payment_date)}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Formulário de Pagamento (exibido apenas se não estiver pago) */}
          {!isPaid && (
            <form onSubmit={handlePayment} className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-8 py-4 border-b bg-gray-50/50">
                <h3 className="font-bold text-gray-900">Registrar Pagamento</h3>
              </div>
              <div className="p-8 grid grid-cols-1 sm:grid-cols-2 gap-6">
                {/* Campo: Valor Pago */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valor Pago (R$)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input 
                      type="number" 
                      step="0.01"
                      required
                      value={paymentData.amount_paid ?? ''}
                      onChange={e => setPaymentData({...paymentData, amount_paid: parseFloat(e.target.value)})}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-bold"
                    />
                  </div>
                </div>
                {/* Campo: Data do Recebimento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data do Recebimento</label>
                  <input 
                    type="date" 
                    required
                    value={paymentData.payment_date ?? ''}
                    onChange={e => setPaymentData({...paymentData, payment_date: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
                {/* Campo: Método de Pagamento */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Método de Pagamento</label>
                  <select 
                    value={paymentData.payment_method_used ?? 'PIX'}
                    onChange={e => setPaymentData({...paymentData, payment_method_used: e.target.value})}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  >
                    <option value="PIX">PIX</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                    <option value="Transferência">Transferência</option>
                  </select>
                </div>
                {/* Campo: Observações */}
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Observações</label>
                  <div className="relative">
                    <FileText className="absolute left-3 top-3 text-gray-400" size={16} />
                    <textarea 
                      rows={3}
                      value={paymentData.notes ?? ''}
                      onChange={e => setPaymentData({...paymentData, notes: e.target.value})}
                      className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                      placeholder="Ex: Pago via link, comprovante anexo..."
                    />
                  </div>
                </div>
              </div>
              {/* Botão de Confirmação */}
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

          {/* Notas do Pagamento (exibidas apenas se estiver pago e houver notas) */}
          {isPaid && installment.notes && (
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
          {/* Ações de Cobrança (Lembretes) */}
          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
            <h3 className="font-bold text-lg mb-4">Ações de Cobrança</h3>
            <div className="space-y-3">
              <button className="w-full py-2 px-4 bg-white/10 hover:bg-white/20 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2">
                <AlertCircle size={16} />
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
    </div>
  );
}
