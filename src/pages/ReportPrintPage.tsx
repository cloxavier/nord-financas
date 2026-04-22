import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Printer, ArrowLeft, AlertCircle } from 'lucide-react';
import { formatCurrency, formatDate, getMonthStartDateInAppTimezone, getTodayDateInAppTimezone } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { isInstallmentOverdue, resolvePatientName } from '../lib/businessRules';
import { useAuth } from '../contexts/AuthContext';
import { canViewFinancialReports } from '@/src/domain/access/policies/financialScopePolicies';

type ReportType = 'fluxo-caixa' | 'inadimplencia' | 'procedimentos' | 'pacientes';

export default function ReportPrintPage() {
  const { type } = useParams<{ type: ReportType }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { financialScope } = useAuth();

  const canSeeFinancialReports = canViewFinancialReports(financialScope);
  const isFinancialReport = type === 'fluxo-caixa' || type === 'inadimplencia' || type === 'procedimentos';
  const reportRestrictedByFinancialScope = Boolean(isFinancialReport && !canSeeFinancialReports);

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filters] = useState({
    startDate: searchParams.get('start') || getMonthStartDateInAppTimezone(),
    endDate: searchParams.get('end') || getTodayDateInAppTimezone(),
  });

  useEffect(() => {
    if (reportRestrictedByFinancialScope) {
      setLoading(false);
      return;
    }
    fetchReportData();
  }, [type, reportRestrictedByFinancialScope]);

  async function fetchReportData() {
    setLoading(true);
    try {
      if (type === 'fluxo-caixa') {
        const { data: payments, error } = await supabase
          .from('payment_records')
          .select('*')
          .gte('payment_date', filters.startDate)
          .lte('payment_date', filters.endDate)
          .order('payment_date', { ascending: true });

        if (error) throw error;

        setData({
          total: (payments || []).reduce((sum, p: any) => sum + p.amount_paid, 0),
          count: payments?.length || 0,
          details: payments || [],
        });
      } else if (type === 'inadimplencia') {
        const { data: installments, error } = await supabase
          .from('installments')
          .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name))')
          .not('status', 'in', '("paid","cancelled")')
          .order('due_date', { ascending: true });

        if (error) throw error;

        const overdue = (installments || [])
          .filter(isInstallmentOverdue)
          .map((item) => ({
            ...item,
            patientName: resolvePatientName(item),
          }));

        setData({
          total: overdue.reduce((sum, p: any) => sum + (p.amount - (p.amount_paid || 0)), 0),
          count: overdue.length,
          details: overdue,
        });
      } else if (type === 'procedimentos') {
        const { data: items, error } = await supabase
          .from('treatment_items')
          .select('*');

        if (error) throw error;

        const grouped = (items || []).reduce((acc: any, curr: any) => {
          const name = curr.procedure_name_snapshot;
          if (!acc[name]) acc[name] = { name, count: 0, total: 0 };
          acc[name].count += curr.quantity;
          acc[name].total += curr.line_total;
          return acc;
        }, {});

        const chartData = Object.values(grouped).sort((a: any, b: any) => b.total - a.total);
        setData({ details: chartData });
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }

  const getReportTitle = () => {
    switch (type) {
      case 'fluxo-caixa': return 'Fluxo de Caixa';
      case 'inadimplencia': return 'Relatório de Inadimplência';
      case 'procedimentos': return 'Produção por Procedimento';
      case 'pacientes': return 'Crescimento de Pacientes';
      default: return 'Relatório';
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin h-10 w-10 text-blue-600" /></div>;
  }

  if (reportRestrictedByFinancialScope) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto bg-white rounded-xl border shadow-sm p-8">
          <button onClick={() => navigate('/relatorios')} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline mb-6">
            <ArrowLeft size={16} /> Voltar
          </button>
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-amber-600 mt-0.5 shrink-0" />
            <div>
              <h1 className="text-xl font-bold text-gray-900">{getReportTitle()}</h1>
              <p className="text-sm text-gray-600 mt-2 leading-6">
                Este relatório depende de escopo financeiro do tipo <strong>Financeiro</strong> ou <strong>Executivo</strong>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8 print:p-0 print:bg-white">
      <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-sm border print:shadow-none print:border-none print:max-w-none">
        <div className="p-4 md:p-6 print:hidden border-b flex justify-between items-center">
          <div>
            <button onClick={() => navigate(-1)} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 hover:underline">
              <ArrowLeft size={16} /> Voltar
            </button>
            <h1 className="text-xl font-bold text-gray-900 mt-2">{getReportTitle()}</h1>
          </div>
          <button onClick={() => window.print()} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700">
            <Printer size={16} /> Imprimir / PDF
          </button>
        </div>

        <div className="p-6 md:p-8 print:p-0">
          <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Nord Finanças</h1>
            <div className="flex justify-between items-end mt-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{getReportTitle()}</h2>
                <p className="text-sm text-gray-600">Período: {formatDate(filters.startDate)} até {formatDate(filters.endDate)}</p>
              </div>
              <p className="text-xs text-gray-500">Emissão: {formatDate(new Date().toISOString())}</p>
            </div>
          </div>

          {data && (
            <>
              {(type === 'fluxo-caixa' || type === 'inadimplencia') && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  {type === 'fluxo-caixa' && (
                    <>
                      <div className="rounded-xl border p-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Recebido</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(data.total)}</p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Qtd Pagamentos</p>
                        <p className="text-xl font-bold text-gray-900">{data.count}</p>
                      </div>
                      <div className="rounded-xl border p-4">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ticket Médio</p>
                        <p className="text-xl font-bold text-gray-900">{formatCurrency(data.total / (data.count || 1))}</p>
                      </div>
                    </>
                  )}

                  {type === 'inadimplencia' && (
                    <div className="rounded-xl border p-4 sm:col-span-2">
                      <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total em Atraso</p>
                      <p className="text-xl font-bold text-gray-900">{formatCurrency(data.total)}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b bg-gray-50/50">
                      {type === 'fluxo-caixa' && (
                        <>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Data</th>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Método</th>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor</th>
                        </>
                      )}
                      {type === 'inadimplencia' && (
                        <>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Paciente</th>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Vencimento</th>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Valor em Aberto</th>
                        </>
                      )}
                      {type === 'procedimentos' && (
                        <>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Procedimento</th>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Quantidade</th>
                          <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Produzido</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.details.map((item: any, idx: number) => (
                      <tr key={idx}>
                        {type === 'fluxo-caixa' && (
                          <>
                            <td className="py-3 px-2 text-sm text-gray-900">{formatDate(item.payment_date)}</td>
                            <td className="py-3 px-2 text-sm text-gray-600">{item.payment_method}</td>
                            <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.amount_paid)}</td>
                          </>
                        )}
                        {type === 'inadimplencia' && (
                          <>
                            <td className="py-3 px-2 text-sm text-gray-900">{item.patientName}</td>
                            <td className="py-3 px-2 text-sm text-red-600 font-bold">{formatDate(item.due_date)}</td>
                            <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.amount - (item.amount_paid || 0))}</td>
                          </>
                        )}
                        {type === 'procedimentos' && (
                          <>
                            <td className="py-3 px-2 text-sm text-gray-900">{item.name}</td>
                            <td className="py-3 px-2 text-sm text-gray-600">{item.count}</td>
                            <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
