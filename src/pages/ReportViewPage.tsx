/**
 * Página de Visualização de Relatório Detalhado.
 * Gera e exibe dados estatísticos e gráficos baseados no tipo de relatório selecionado.
 *
 * Nesta fase:
 * - os filtros padrão usam a timezone oficial da aplicação
 * - a data/hora de geração do relatório respeita America/Sao_Paulo
 * - o agrupamento do gráfico do fluxo de caixa preserva a ordem correta por YYYY-MM-DD
 */
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  Printer,
  Calendar,
  Loader2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  BarChart3,
  FileText,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getMonthStartDateInAppTimezone,
  getTodayDateInAppTimezone,
  formatDateOnlyForInput,
} from '../lib/utils';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { supabase } from '../lib/supabase';
import { isInstallmentOverdue, resolvePatientName } from '../lib/businessRules';

type ReportType = 'fluxo-caixa' | 'inadimplencia' | 'procedimentos' | 'pacientes';

export default function ReportViewPage() {
  const { type } = useParams<{ type: ReportType }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const [filters, setFilters] = useState({
    startDate:
      formatDateOnlyForInput(searchParams.get('start')) ||
      getMonthStartDateInAppTimezone(),
    endDate:
      formatDateOnlyForInput(searchParams.get('end')) ||
      getTodayDateInAppTimezone(),
  });

  useEffect(() => {
    fetchReportData();
  }, [type, filters]);

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

        const grouped = (payments || []).reduce((acc: Record<string, number>, curr: any) => {
          const safeDateKey = String(curr.payment_date || '').split('T')[0];
          acc[safeDateKey] = (acc[safeDateKey] || 0) + Number(curr.amount_paid || 0);
          return acc;
        }, {});

        const chartData = Object.entries(grouped)
          .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
          .map(([date, amount]) => ({
            rawDate: date,
            date: formatDate(date),
            amount,
          }));

        setData({
          total: (payments || []).reduce((sum, p: any) => sum + Number(p.amount_paid || 0), 0),
          count: payments?.length || 0,
          chartData,
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
          total: overdue.reduce(
            (sum, p: any) => sum + (Number(p.amount || 0) - Number(p.amount_paid || 0)),
            0
          ),
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

          if (!acc[name]) {
            acc[name] = { name, count: 0, total: 0 };
          }

          acc[name].count += Number(curr.quantity || 0);
          acc[name].total += Number(curr.line_total || 0);

          return acc;
        }, {});

        const chartData = Object.values(grouped).sort(
          (a: any, b: any) => b.total - a.total
        );

        setData({
          chartData,
          details: chartData,
        });
      }
    } catch (error) {
      console.error('Error fetching report:', error);
    } finally {
      setLoading(false);
    }
  }

  const getReportTitle = () => {
    switch (type) {
      case 'fluxo-caixa':
        return 'Fluxo de Caixa';
      case 'inadimplencia':
        return 'Relatório de Inadimplência';
      case 'procedimentos':
        return 'Produção por Procedimento';
      case 'pacientes':
        return 'Crescimento de Pacientes';
      default:
        return 'Relatório';
    }
  };

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    params.set('start', filters.startDate);
    params.set('end', filters.endDate);
    setSearchParams(params);
    fetchReportData();
  };

  const handlePrint = () => {
    const params = new URLSearchParams();
    params.set('start', filters.startDate);
    params.set('end', filters.endDate);
    window.open(`/relatorios/${type}/imprimir?${params.toString()}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-8 print:space-y-4 print:p-0">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 print:hidden">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/relatorios')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getReportTitle()}</h1>
            <p className="text-sm text-gray-500">
              Período: {formatDate(filters.startDate)} até {formatDate(filters.endDate)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            <Printer size={18} />
            <span>Imprimir</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            <FileText size={18} />
            <span>Gerar PDF</span>
          </button>
        </div>
      </div>

      <div className="hidden print:block border-b-2 border-gray-900 pb-4 mb-6">
        <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
          Nord Finanças
        </h1>
        <div className="flex justify-between items-end mt-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{getReportTitle()}</h2>
            <p className="text-sm text-gray-600">
              Período: {formatDate(filters.startDate)} até {formatDate(filters.endDate)}
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Gerado em: {formatDateTime(new Date())}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <Calendar size={18} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={filters.startDate ?? ''}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            />
          </div>

          <span className="text-gray-400 text-center hidden sm:inline">até</span>
          <span className="text-gray-400 text-xs font-bold uppercase sm:hidden px-7">até</span>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-[18px] sm:hidden" />
            <input
              type="date"
              value={filters.endDate ?? ''}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            />
          </div>
        </div>

        <button
          onClick={handleApplyFilters}
          className="px-6 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-sm font-bold transition-colors border border-blue-100"
        >
          Filtrar
        </button>
      </div>

      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 print:grid-cols-3 print:gap-4">
          {type === 'fluxo-caixa' && (
            <>
              <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm print:p-4">
                <div className="flex items-center justify-between mb-2 print:mb-1">
                  <span className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase tracking-wider print:text-[10px]">
                    Total Recebido
                  </span>
                  <div className="p-2 bg-green-100 text-green-600 rounded-lg print:hidden">
                    <TrendingUp size={20} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 print:text-xl">
                  {formatCurrency(data.total)}
                </p>
                <p className="text-[10px] sm:text-xs text-green-600 mt-1 font-bold">
                  +{data.count} pagamentos
                </p>
              </div>

              <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm print:p-4">
                <div className="flex items-center justify-between mb-2 print:mb-1">
                  <span className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase tracking-wider print:text-[10px]">
                    Ticket Médio
                  </span>
                  <div className="p-2 bg-blue-100 text-blue-600 rounded-lg print:hidden">
                    <DollarSign size={20} />
                  </div>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 print:text-xl">
                  {formatCurrency(data.total / (data.count || 1))}
                </p>
              </div>
            </>
          )}

          {type === 'inadimplencia' && (
            <div className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm print:p-4">
              <div className="flex items-center justify-between mb-2 print:mb-1">
                <span className="text-[10px] sm:text-sm font-bold text-gray-500 uppercase tracking-wider print:text-[10px]">
                  Total em Atraso
                </span>
                <div className="p-2 bg-red-100 text-red-600 rounded-lg print:hidden">
                  <AlertCircle size={20} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 print:text-xl">
                {formatCurrency(data.total)}
              </p>
              <p className="text-[10px] sm:text-xs text-red-600 mt-1 font-bold">
                {data.count} parcelas pendentes
              </p>
            </div>
          )}
        </div>
      )}

      {data && data.chartData && (
        <div className="bg-white rounded-xl border shadow-sm p-6 print:hidden">
          <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 size={18} className="text-blue-600" />
            Visualização Gráfica
          </h3>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey={type === 'procedimentos' ? 'name' : 'date'} />
                <YAxis tickFormatter={(value) => `R$ ${value}`} />
                <Tooltip
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                  }}
                />
                <Bar
                  dataKey={type === 'procedimentos' ? 'total' : 'amount'}
                  fill="#2563eb"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data && data.details && (
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden print:border-none print:shadow-none">
          <div className="px-6 py-4 border-b bg-gray-50/50 print:px-0 print:bg-transparent">
            <h3 className="font-bold text-gray-900">Detalhamento</h3>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b bg-gray-50/50 print:bg-gray-100">
                  {type === 'fluxo-caixa' && (
                    <>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2 print:py-1">
                        Data
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2 print:py-1">
                        Método
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right print:px-2 print:py-1">
                        Valor
                      </th>
                    </>
                  )}

                  {type === 'inadimplencia' && (
                    <>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2 print:py-1">
                        Paciente
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2 print:py-1">
                        Vencimento
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right print:px-2 print:py-1">
                        Valor em Aberto
                      </th>
                    </>
                  )}

                  {type === 'procedimentos' && (
                    <>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2 print:py-1">
                        Procedimento
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider print:px-2 print:py-1">
                        Quantidade
                      </th>
                      <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right print:px-2 print:py-1">
                        Total Produzido
                      </th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y">
                {data.details.map((item: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-50 transition-colors print:hover:bg-transparent">
                    {type === 'fluxo-caixa' && (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium print:px-2 print:py-1">
                          {formatDate(item.payment_date)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 print:px-2 print:py-1">
                          {item.payment_method}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right print:px-2 print:py-1">
                          {formatCurrency(item.amount_paid)}
                        </td>
                      </>
                    )}

                    {type === 'inadimplencia' && (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium print:px-2 print:py-1">
                          {item.patientName}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600 font-bold print:px-2 print:py-1">
                          {formatDate(item.due_date)}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right print:px-2 print:py-1">
                          {formatCurrency(item.amount - (item.amount_paid || 0))}
                        </td>
                      </>
                    )}

                    {type === 'procedimentos' && (
                      <>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium print:px-2 print:py-1">
                          {item.name}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 print:px-2 print:py-1">
                          {item.count}
                        </td>
                        <td className="px-6 py-4 text-sm font-bold text-gray-900 text-right print:px-2 print:py-1">
                          {formatCurrency(item.total)}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y">
            {data.details.map((item: any, idx: number) => (
              <div key={idx} className="p-4 space-y-2">
                {type === 'fluxo-caixa' && (
                  <>
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-gray-900">
                        {formatDate(item.payment_date)}
                      </p>
                      <p className="text-sm font-bold text-green-600">
                        {formatCurrency(item.amount_paid)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">{item.payment_method}</p>
                  </>
                )}

                {type === 'inadimplencia' && (
                  <>
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-gray-900">{item.patientName}</p>
                      <p className="text-sm font-bold text-red-600">
                        {formatCurrency(item.amount - (item.amount_paid || 0))}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Vencimento: {formatDate(item.due_date)}
                    </p>
                  </>
                )}

                {type === 'procedimentos' && (
                  <>
                    <div className="flex justify-between items-start">
                      <p className="text-sm font-bold text-gray-900">{item.name}</p>
                      <p className="text-sm font-bold text-blue-600">
                        {formatCurrency(item.total)}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">Quantidade: {item.count}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}