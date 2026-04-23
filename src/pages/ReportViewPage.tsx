/**
 * Página de Visualização de Relatório Detalhado.
 * Nesta etapa:
 * - usa financialMetrics.ts como camada central
 * - adiciona o relatório Financeiro Executivo
 * - respeita o escopo financeiro por cargo
 * - mantém filtros por período e impressão
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Calendar,
  FileText,
  Loader2,
  Lock,
  Printer,
  TrendingUp,
  Users,
  WalletCards,
} from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  formatDateOnlyForInput,
  getMonthStartDateInAppTimezone,
  getTodayDateInAppTimezone,
} from '../lib/utils';
import {
  getReportData,
  FinancialReportData,
  FinancialReportType,
} from '../lib/financialMetrics';
import { useAuth } from '../contexts/AuthContext';
import {
  canViewMonthlyForecast,
  canViewOpenAmountTotal,
  getFinancialAccessLevel,
} from '@/src/domain/access/policies/financialScopePolicies';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
  Tooltip,
  XAxis,
  YAxis,
  LineChart,
  Line,
} from 'recharts';

function isValidReportType(value: string | undefined): value is FinancialReportType {
  return (
    value === 'financeiro-executivo' ||
    value === 'fluxo-caixa' ||
    value === 'inadimplencia' ||
    value === 'procedimentos' ||
    value === 'pacientes'
  );
}

function getReportTitle(type: FinancialReportType) {
  switch (type) {
    case 'financeiro-executivo':
      return 'Financeiro Executivo';
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
}

function canAccessReportType(type: FinancialReportType, financialAccessLevel: string) {
  if (type === 'pacientes') return true;
  if (type === 'financeiro-executivo') return financialAccessLevel === 'executive';
  return financialAccessLevel === 'financial' || financialAccessLevel === 'executive';
}

function getRestrictionText(type: FinancialReportType) {
  if (type === 'financeiro-executivo') {
    return 'Este relatório exige escopo financeiro do tipo Executivo.';
  }

  return 'Este relatório exige escopo financeiro do tipo Financeiro ou Executivo.';
}

function formatPercent(value: number | null) {
  if (value === null || Number.isNaN(value)) return 'N/A';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export default function ReportViewPage() {
  const { type } = useParams<{ type: FinancialReportType }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { financialScope } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialReportData | null>(null);

  const [filters, setFilters] = useState({
    startDate:
      formatDateOnlyForInput(searchParams.get('start')) || getMonthStartDateInAppTimezone(),
    endDate:
      formatDateOnlyForInput(searchParams.get('end')) || getTodayDateInAppTimezone(),
  });

  const financialAccessLevel = getFinancialAccessLevel(financialScope);
  const canSeeMonthlyForecast = canViewMonthlyForecast(financialScope);
  const canSeeOpenAmountTotal = canViewOpenAmountTotal(financialScope);

  const validType = isValidReportType(type) ? type : null;
  const isRestricted = validType
    ? !canAccessReportType(validType, financialAccessLevel)
    : false;

  useEffect(() => {
    if (!validType || isRestricted) {
      setLoading(false);
      return;
    }

    fetchReportData();
  }, [validType, filters.startDate, filters.endDate, isRestricted]);

  async function fetchReportData() {
    if (!validType) return;

    setLoading(true);

    try {
      const reportData = await getReportData(validType, {
        startDate: filters.startDate,
        endDate: filters.endDate,
      });

      setData(reportData);
    } catch (error) {
      console.error('Error fetching report:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  const handleApplyFilters = () => {
    const params = new URLSearchParams();
    params.set('start', filters.startDate);
    params.set('end', filters.endDate);
    setSearchParams(params);
  };

  const handlePrint = () => {
    if (!validType) return;

    const params = new URLSearchParams();
    params.set('start', filters.startDate);
    params.set('end', filters.endDate);
    params.set('back', `/relatorios/${validType}?start=${filters.startDate}&end=${filters.endDate}`);
    navigate(`/relatorios/${validType}/imprimir?${params.toString()}`);
  };

  const executiveSummaryCards = useMemo(() => {
    if (!data || data.kind !== 'financeiro-executivo') return [];

    const baseCards = [
      {
        label: 'Recebido no período',
        value: formatCurrency(data.summary.receivedTotal),
      },
      {
        label: 'Previsto no período',
        value: formatCurrency(data.summary.scheduledInPeriodTotal),
      },
      {
        label: 'Em atraso no período',
        value: formatCurrency(data.summary.overdueInPeriodTotal),
      },
      {
        label: 'Ticket médio',
        value: formatCurrency(data.summary.averageTicket),
      },
      {
        label: 'Taxa de recebimento',
        value: formatPercent(data.summary.collectionRatePercent),
      },
    ];

    if (canSeeOpenAmountTotal) {
      baseCards.splice(3, 0, {
        label: 'Carteira em aberto',
        value: formatCurrency(data.summary.openPortfolioTotal),
      });

      baseCards.splice(4, 0, {
        label: 'Carteira vencida',
        value: formatCurrency(data.summary.overduePortfolioTotal),
      });
    }

    return baseCards;
  }, [data, canSeeOpenAmountTotal]);

  if (!validType) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>Tipo de relatório inválido.</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin h-8 w-8 text-blue-600" />
      </div>
    );
  }

  if (isRestricted) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/relatorios')}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft size={20} className="text-gray-600" />
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900">{getReportTitle(validType)}</h1>
            <p className="text-sm text-gray-500">Acesso restrito por escopo financeiro.</p>
          </div>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 flex gap-3">
          <Lock size={18} className="mt-0.5 shrink-0" />
          <span>{getRestrictionText(validType)}</span>
        </div>
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
            <h1 className="text-2xl font-bold text-gray-900">{getReportTitle(validType)}</h1>
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
            <span>Imprimir / Salvar PDF</span>
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 print:hidden">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1">
          <div className="flex items-center gap-2 flex-1">
            <Calendar size={18} className="text-gray-400 shrink-0" />
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              className="flex-1 px-3 py-1.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-0"
            />
          </div>

          <span className="text-gray-400 text-center hidden sm:inline">até</span>
          <span className="text-gray-400 text-xs font-bold uppercase sm:hidden px-7">até</span>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-[18px] sm:hidden" />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value }))}
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

      {data?.kind === 'financeiro-executivo' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
            {executiveSummaryCards.map((card) => (
              <div key={card.label} className="bg-white rounded-xl border shadow-sm p-5">
                <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  {card.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <WalletCards size={18} className="text-indigo-600" />
              Comparativo mensal do período
            </h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.monthlyComparison}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="monthLabel" />
                  <YAxis tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                  <Legend />
                  <Bar dataKey="scheduledAmount" name="Previsto" />
                  <Bar dataKey="receivedAmount" name="Recebido" />
                  <Bar dataKey="overdueAmount" name="Em atraso" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {canSeeMonthlyForecast && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
                <TrendingUp size={18} className="text-blue-600" />
                Previsão de carteira aberta — próximos 12 meses
              </h3>

              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={data.forecastNext12Months}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="monthLabel" />
                    <YAxis tickFormatter={(value) => `R$ ${value}`} />
                    <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                    <Legend />
                    <Line type="monotone" dataKey="openAmount" name="Carteira em aberto" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Top parcelas em atraso</h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Parcela
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Em aberto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.topOverdueDetails.length > 0 ? (
                    data.topOverdueDetails.map((item) => (
                      <tr key={item.installmentId}>
                        <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                          {item.patientName}
                        </td>
                        <td className="px-6 py-4 text-sm text-red-600 font-bold">
                          {formatDate(item.dueDate)}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600">
                          {item.installmentNumber ? `${item.installmentNumber}ª parcela` : '-'}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 font-bold text-right">
                          {formatCurrency(item.outstandingAmount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                        Nenhuma parcela em atraso encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {data.topOverdueDetails.length > 0 ? (
                data.topOverdueDetails.map((item) => (
                  <div key={item.installmentId} className="p-4 space-y-2">
                    <div className="flex justify-between items-start gap-3">
                      <div>
                        <p className="text-sm font-bold text-gray-900">{item.patientName}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {item.installmentNumber ? `${item.installmentNumber}ª parcela` : '-'}
                        </p>
                      </div>
                      <p className="text-sm font-bold text-gray-900">
                        {formatCurrency(item.outstandingAmount)}
                      </p>
                    </div>
                    <p className="text-xs text-red-600 font-bold">
                      Vencimento: {formatDate(item.dueDate)}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-12 text-center text-gray-500">
                  Nenhuma parcela em atraso encontrada.
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {data?.kind === 'fluxo-caixa' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Total Recebido
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.total)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Pagamentos
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{data.count}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Ticket Médio
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.averageTicket)}
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <TrendingUp size={18} className="text-green-600" />
              Evolução diária do recebimento
            </h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" />
                  <YAxis tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                  <Bar dataKey="amount" name="Recebido" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Detalhamento dos pagamentos</h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Método
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.details.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(item.payment_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.payment_method}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(Number(item.amount_paid || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {data.details.map((item: any, idx: number) => (
                <div key={idx} className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-sm font-bold text-gray-900">
                      {formatDate(item.payment_date)}
                    </p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(Number(item.amount_paid || 0))}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">{item.payment_method}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {data?.kind === 'inadimplencia' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Total em atraso
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.total)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Parcelas em atraso
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{data.count}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Parcelas em atraso no período</h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Parcela
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Em aberto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.details.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {item.patientName}
                      </td>
                      <td className="px-6 py-4 text-sm text-red-600 font-bold">
                        {formatDate(item.due_date)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {item.installment_number ? `${item.installment_number}ª parcela` : '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(Number(item.outstandingAmount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {data.details.map((item: any, idx: number) => (
                <div key={idx} className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">{item.patientName}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {item.installment_number ? `${item.installment_number}ª parcela` : '-'}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(Number(item.outstandingAmount || 0))}
                    </p>
                  </div>
                  <p className="text-xs text-red-600 font-bold">
                    Vencimento: {formatDate(item.due_date)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {data?.kind === 'procedimentos' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Total produzido
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">
                {formatCurrency(data.total)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Quantidade de procedimentos
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{data.count}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 size={18} className="text-blue-600" />
              Produção por procedimento
            </h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis tickFormatter={(value) => `R$ ${value}`} />
                  <Tooltip formatter={(value: any) => formatCurrency(Number(value || 0))} />
                  <Bar dataKey="total" name="Produção" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Detalhamento por procedimento</h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Procedimento
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Total produzido
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.details.map((item) => (
                    <tr key={item.name}>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {item.name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.count}</td>
                      <td className="px-6 py-4 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {data.details.map((item) => (
                <div key={item.name} className="p-4 space-y-2">
                  <div className="flex justify-between items-start gap-3">
                    <p className="text-sm font-bold text-gray-900">{item.name}</p>
                    <p className="text-sm font-bold text-gray-900">
                      {formatCurrency(item.total)}
                    </p>
                  </div>
                  <p className="text-xs text-gray-500">Quantidade: {item.count}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {data?.kind === 'pacientes' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Novos pacientes no período
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{data.count}</p>
            </div>

            <div className="bg-white p-5 rounded-xl border shadow-sm">
              <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                Meses analisados
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-2">{data.chartData.length}</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-6 flex items-center gap-2">
              <Users size={18} className="text-purple-600" />
              Crescimento mensal de pacientes
            </h3>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="monthLabel" />
                  <YAxis allowDecimals={false} />
                  <Tooltip formatter={(value: any) => Number(value || 0)} />
                  <Bar dataKey="newPatientsCount" name="Novos pacientes" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b bg-gray-50/50">
              <h3 className="font-bold text-gray-900">Pacientes cadastrados no período</h3>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Telefone
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      E-mail
                    </th>
                    <th className="px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Cadastro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {data.details.map((item: any) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 text-sm text-gray-900 font-medium">
                        {item.full_name}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.phone || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">{item.email || '-'}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 text-right">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="md:hidden divide-y">
              {data.details.map((item: any) => (
                <div key={item.id} className="p-4 space-y-2">
                  <p className="text-sm font-bold text-gray-900">{item.full_name}</p>
                  <p className="text-xs text-gray-500">{item.phone || '-'}</p>
                  <p className="text-xs text-gray-500">{item.email || '-'}</p>
                  <p className="text-xs text-gray-400">Cadastro: {formatDate(item.created_at)}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}