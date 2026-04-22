import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canViewOperationalFinancialData } from '@/src/domain/access/policies/financialScopePolicies';
import { Printer, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { resolveLateRuleNotes } from '../lib/lateChargeRules';

export default function TreatmentPrintPage() {
  const { id } = useParams();
  const { financialScope } = useAuth();
  const canViewOperationalFinancials = canViewOperationalFinancialData(financialScope);
  const renderAmount = (value: number) => canViewOperationalFinancials ? formatCurrency(value) : 'Acesso restrito';
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [treatment, setTreatment] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [installments, setInstallments] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, [id]);

  async function fetchData() {
    if (!id) return;

    try {
      const { data: tData, error: tError } = await supabase
        .from('treatments')
        .select('*')
        .eq('id', id)
        .single();

      if (tError) throw tError;
      setTreatment(tData);

      const [itemsRes, installmentsRes] = await Promise.all([
        supabase.from('treatment_items').select('*').eq('treatment_id', id),
        supabase
          .from('installments')
          .select('*')
          .eq('treatment_id', id)
          .order('installment_number', { ascending: true }),
      ]);

      if (itemsRes.error) throw itemsRes.error;
      if (installmentsRes.error) throw installmentsRes.error;

      setItems(itemsRes.data || []);
      setInstallments(installmentsRes.data || []);
      setLoading(false);
    } catch (err: any) {
      console.error('PRINT_PAGE: Error loading data:', err);
      setError(err.message || 'Erro ao carregar dados do tratamento.');
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && treatment && !error) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [loading, treatment, error]);

  const handleManualPrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        <p className="text-gray-500 font-medium">Preparando documento para impressão...</p>
      </div>
    );
  }

  if (error || !treatment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white p-6 text-center">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <h1 className="text-xl font-bold text-gray-900">Erro ao carregar documento</h1>
        <p className="text-gray-600 max-w-md">{error || 'Tratamento não encontrado.'}</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-4 px-6 py-2 bg-gray-100 text-gray-700 rounded-lg font-bold hover:bg-gray-200 transition-colors"
        >
          Voltar
        </button>
      </div>
    );
  }

  const contractedTotal = treatment.total_amount || 0;
  const entryAmount = treatment.entry_amount || 0;
  const amountToFinance =
    treatment.amount_to_finance ?? Math.max(contractedTotal - entryAmount, 0);

  const lateRuleNotes = resolveLateRuleNotes({
    late_fee_enabled: treatment.late_fee_enabled,
    late_fee_percent: treatment.late_fee_percent,
    interest_enabled: treatment.interest_enabled,
    interest_percent: treatment.interest_percent,
    interest_period: treatment.interest_period,
    late_fee_notes: treatment.late_fee_notes,
  });

  return (
    <div className="min-h-screen bg-white p-0 md:p-8">
      <div className="max-w-4xl mx-auto mb-8 flex items-center justify-between print:hidden bg-gray-50 p-4 rounded-xl border border-gray-200">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 font-bold transition-colors"
        >
          <ArrowLeft size={20} />
          Voltar
        </button>

        <div className="flex items-center gap-3">
          <p className="text-sm text-gray-500 mr-4">O diálogo de impressão deve abrir automaticamente.</p>
          <button
            onClick={handleManualPrint}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            <Printer size={20} />
            Imprimir agora
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white print:p-0">
        <div className="border-b-2 border-gray-900 pb-6 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Nord Odonto</h1>
            <p className="text-sm text-gray-500 font-medium">Relatório de Tratamento e Orçamento</p>
          </div>

          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              Tratamento #{treatment.id?.slice(0, 8)}
            </p>
            <p className="text-xs text-gray-500">
              Emissão: {formatDate(new Date())}
            </p>
            <div className="mt-2">
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-[10px] font-bold uppercase tracking-wider">
                Status: {treatment.status}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-8 mb-8">
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Dados do Paciente
            </h3>
            <p className="text-lg font-bold text-gray-900">{treatment.patient_name_snapshot}</p>
            <p className="text-sm text-gray-600">{treatment.patient_phone_snapshot || 'Sem telefone'}</p>
            <p className="text-sm text-gray-600">{treatment.patient_email_snapshot || 'Sem e-mail'}</p>
          </div>

          <div className="text-right">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
              Data do Orçamento
            </h3>
            <p className="text-sm font-bold text-gray-900">{formatDate(treatment.created_at)}</p>
          </div>
        </div>

        <div className="mb-8">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
            Procedimentos e Serviços
          </h3>

          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-100 text-left">
                <th className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Descrição</th>
                <th className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qtd</th>
                <th className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Unitário</th>
                <th className="py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-50">
              {items.map((item) => (
                <tr key={item.id}>
                  <td className="py-4 text-sm font-bold text-gray-900">
                    {item.procedure_name_snapshot}
                  </td>
                  <td className="py-4 text-sm text-gray-600 text-center">{item.quantity}</td>
                  <td className="py-4 text-sm text-gray-600 text-right">
                    {renderAmount(item.unit_price_snapshot)}
                  </td>
                  <td className="py-4 text-sm font-bold text-gray-900 text-right">
                    {renderAmount(item.line_total)}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot className="border-t-2 border-gray-100">
              <tr>
                <td colSpan={3} className="py-3 text-sm font-bold text-gray-500 text-right">
                  Subtotal
                </td>
                <td className="py-3 text-sm font-bold text-gray-900 text-right">
                  {renderAmount(treatment.subtotal)}
                </td>
              </tr>

              {treatment.discount_amount > 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-sm font-bold text-red-500 text-right">
                    Desconto
                  </td>
                  <td className="py-3 text-sm font-bold text-red-500 text-right">
                    -{renderAmount(treatment.discount_amount)}
                  </td>
                </tr>
              )}

              <tr>
                <td colSpan={3} className="py-3 text-sm font-bold text-gray-500 text-right">
                  Total Contratado
                </td>
                <td className="py-3 text-sm font-bold text-gray-900 text-right">
                  {renderAmount(contractedTotal)}
                </td>
              </tr>

              {entryAmount > 0 && (
                <tr>
                  <td colSpan={3} className="py-3 text-sm font-bold text-gray-500 text-right">
                    Entrada
                  </td>
                  <td className="py-3 text-sm font-bold text-gray-900 text-right">
                    {renderAmount(entryAmount)}
                  </td>
                </tr>
              )}

              <tr>
                <td colSpan={3} className="py-4 text-lg font-black text-gray-900 text-right uppercase tracking-tight">
                  Saldo a Parcelar
                </td>
                <td className="py-4 text-2xl font-black text-blue-600 text-right">
                  {renderAmount(amountToFinance)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="grid grid-cols-2 gap-12 mb-8">
          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              Forma de Pagamento
            </h3>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-100">
              <p className="text-sm font-bold text-gray-900">
                {treatment.payment_method_preference || 'A combinar'}
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
              Observações
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
              {treatment.notes || 'Nenhuma observação adicional.'}
            </p>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
            Condições em Caso de Atraso
          </h3>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-100">
            <p className="text-sm text-amber-950 leading-relaxed whitespace-pre-wrap">
              {lateRuleNotes}
            </p>
          </div>
        </div>

        {installments.length > 0 && (
          <div className="mb-12 page-break-before">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
              Plano de Parcelamento
            </h3>

            <div className="grid grid-cols-2 gap-4">
              {installments.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between p-3 border rounded-lg border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-gray-50 flex items-center justify-center text-xs font-bold text-gray-500">
                      {inst.installment_number}
                    </div>
                    <div>
                      <p className="text-xs font-bold text-gray-900">Vencimento</p>
                      <p className="text-[10px] text-gray-500">{formatDate(inst.due_date)}</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-black text-gray-900">{renderAmount(inst.amount)}</p>
                    <p className="text-[10px] font-bold text-gray-400 uppercase">{inst.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-24 grid grid-cols-2 gap-24">
          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-sm font-bold text-gray-900">Assinatura do Paciente</p>
              <p className="text-xs text-gray-500">{treatment.patient_name_snapshot}</p>
            </div>
          </div>

          <div className="text-center">
            <div className="border-t border-gray-400 pt-2">
              <p className="text-sm font-bold text-gray-900">Assinatura do Profissional</p>
              <p className="text-xs text-gray-500">Nord Odonto</p>
            </div>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            Este documento é um orçamento válido por 15 dias a partir da data de emissão.
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .page-break-before { page-break-before: always; }
        }
      `,
        }}
      />
    </div>
  );
}