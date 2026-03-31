import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { Loader2, Printer, ArrowLeft } from 'lucide-react';
import { formatCurrency, formatDate } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { isInstallmentOverdue, resolvePatientName } from '../lib/businessRules';

type ReportType = 'fluxo-caixa' | 'inadimplencia' | 'procedimentos' | 'pacientes';

export default function ReportPrintPage() {
  const { type } = useParams<{ type: ReportType }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [filters] = useState({
    startDate: searchParams.get('start') || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: searchParams.get('end') || new Date().toISOString().split('T')[0]
  });

  useEffect(() => {
    fetchReportData();
  }, [type]);

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
          details: payments || []
        });
      } else if (type === 'inadimplencia') {
        const { data: installments, error } = await supabase
          .from('installments')
          .select('*, treatments(id, patient_id, patient_name_snapshot, patients(id, full_name))')
          .not('status', 'in', '("paid","cancelled")')
          .order('due_date', { ascending: true });
        
        if (error) throw error;

        const overdue = (installments || []).filter(isInstallmentOverdue).map(item => ({
          ...item,
          patientName: resolvePatientName(item)
        }));

        setData({
          total: overdue.reduce((sum, p: any) => sum + (p.amount - (p.amount_paid || 0)), 0),
          count: overdue.length,
          details: overdue
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

        setData({
          details: chartData
        });
      } else if (type === 'pacientes') {
        // Basic implementation for patients report
        const { data: patients, error } = await supabase
          .from('patients')
          .select('*')
          .gte('created_at', filters.startDate)
          .lte('created_at', filters.endDate)
          .order('created_at', { ascending: true });
        
        if (error) throw error;

        setData({
          count: patients?.length || 0,
          details: patients || []
        });
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loading && data) {
      const timer = setTimeout(() => {
        window.print();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [loading, data]);

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
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        <p className="text-gray-500 font-medium">Preparando relatório para impressão...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      {/* Controls - Hidden on print */}
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
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            <Printer size={20} />
            Imprimir agora
          </button>
        </div>
      </div>

      {/* Printable Content */}
      <div className="max-w-4xl mx-auto bg-white print:p-0">
        {/* Header */}
        <div className="border-b-2 border-gray-900 pb-6 mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">Nord Finanças</h1>
            <p className="text-sm text-gray-500 font-medium">Relatório Administrativo</p>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-900">{getReportTitle()}</h2>
            <p className="text-xs text-gray-500">Emissão: {new Date().toLocaleString('pt-BR')}</p>
            <p className="text-xs font-bold text-gray-700 mt-1">
              Período: {formatDate(filters.startDate)} até {formatDate(filters.endDate)}
            </p>
          </div>
        </div>

        {/* Summary Section */}
        {data && (
          <div className="grid grid-cols-3 gap-4 mb-8">
            {type === 'fluxo-caixa' && (
              <>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total Recebido</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data.total)}</p>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Qtd Pagamentos</p>
                  <p className="text-xl font-bold text-gray-900">{data.count}</p>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Ticket Médio</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data.total / (data.count || 1))}</p>
                </div>
              </>
            )}
            {type === 'inadimplencia' && (
              <>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Total em Atraso</p>
                  <p className="text-xl font-bold text-gray-900">{formatCurrency(data.total)}</p>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50">
                  <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">Parcelas Pendentes</p>
                  <p className="text-xl font-bold text-gray-900">{data.count}</p>
                </div>
              </>
            )}
          </div>
        )}

        {/* Details Table */}
        {data && data.details && (
          <div className="mb-8">
            <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">Detalhamento dos Registros</h3>
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
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
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">Qtd</th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Total Produzido</th>
                    </>
                  )}
                  {type === 'pacientes' && (
                    <>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Nome</th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">Telefone</th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Cadastro</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
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
                        <td className="py-3 px-2 text-sm text-gray-600 text-center">{item.count}</td>
                        <td className="py-3 px-2 text-sm font-bold text-gray-900 text-right">{formatCurrency(item.total)}</td>
                      </>
                    )}
                    {type === 'pacientes' && (
                      <>
                        <td className="py-3 px-2 text-sm text-gray-900 font-bold">{item.full_name}</td>
                        <td className="py-3 px-2 text-sm text-gray-600">{item.phone || '-'}</td>
                        <td className="py-3 px-2 text-sm text-gray-500 text-right">{formatDate(item.created_at)}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            Nord Finanças - Sistema de Gestão Odontológica
          </p>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          @page { margin: 1cm; }
        }
      `}} />
    </div>
  );
}
