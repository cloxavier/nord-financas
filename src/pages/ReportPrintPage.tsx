/**
 * Página de impressão dos relatórios.
 * Nesta etapa:
 * - usa financialMetrics.ts como camada central
 * - respeita o escopo financeiro por cargo
 * - adiciona o relatório Financeiro Executivo
 * - mantém impressão coerente com a visualização em tela
 * - melhora o fluxo mobile navegando pela mesma aba
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Loader2, Lock, Printer } from 'lucide-react';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
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

export default function ReportPrintPage() {
  const { type } = useParams<{ type: FinancialReportType }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { financialScope } = useAuth();

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<FinancialReportData | null>(null);
  const autoPrintAttemptedRef = useRef(false);

  const filters = useMemo(
    () => ({
      startDate:
        formatDateOnlyForInput(searchParams.get('start')) || getMonthStartDateInAppTimezone(),
      endDate:
        formatDateOnlyForInput(searchParams.get('end')) || getTodayDateInAppTimezone(),
    }),
    [searchParams]
  );

  const shouldAutoPrint = searchParams.get('autoprint') !== '0';
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
  }, [validType, isRestricted, filters.startDate, filters.endDate]);

  useEffect(() => {
    if (!loading && data && !isRestricted && shouldAutoPrint && !autoPrintAttemptedRef.current) {
      autoPrintAttemptedRef.current = true;

      const firstTry = window.setTimeout(() => {
        window.print();
      }, 350);

      const secondTry = window.setTimeout(() => {
        window.print();
      }, 1200);

      return () => {
        window.clearTimeout(firstTry);
        window.clearTimeout(secondTry);
      };
    }
  }, [loading, data, isRestricted, shouldAutoPrint]);

  async function fetchReportData() {
    if (!validType) return;

    setLoading(true);

    try {
      const reportData = await getReportData(validType, filters);
      setData(reportData);
    } catch (error) {
      console.error('Error fetching print report:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  function handleBack() {
    if (!validType) {
      navigate('/relatorios');
      return;
    }

    const params = new URLSearchParams();
    params.set('start', filters.startDate);
    params.set('end', filters.endDate);
    navigate(`/relatorios/${validType}?${params.toString()}`);
  }

  if (!validType) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700 flex gap-3">
          <AlertCircle size={18} className="mt-0.5 shrink-0" />
          <span>Tipo de relatório inválido.</span>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-white">
        <Loader2 className="animate-spin h-10 w-10 text-blue-600" />
        <p className="text-gray-500 font-medium">Preparando relatório para impressão...</p>
      </div>
    );
  }

  if (isRestricted) {
    return (
      <div className="min-h-screen bg-white p-8">
        <div className="max-w-4xl mx-auto rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-800 flex gap-3">
          <Lock size={18} className="mt-0.5 shrink-0" />
          <span>{getRestrictionText(validType)}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto mb-8 print:hidden bg-gray-50 p-4 rounded-xl border border-gray-200">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 font-bold transition-colors"
          >
            <ArrowLeft size={20} />
            Voltar
          </button>

          <div className="flex flex-col sm:items-end gap-3">
            <p className="text-sm text-gray-500 sm:text-right">
              O sistema tentará abrir a impressão automaticamente. Se não abrir, use o botão abaixo.
            </p>

            <button
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100 w-full sm:w-auto"
            >
              <Printer size={20} />
              Imprimir / Salvar PDF
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto bg-white print:p-0">
        <div className="border-b-2 border-gray-900 pb-6 mb-8 flex justify-between items-start gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 uppercase tracking-tight">
              Nord Finanças
            </h1>
            <p className="text-sm text-gray-500 font-medium">Relatório Administrativo</p>
          </div>

          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-900">{getReportTitle(validType)}</h2>
            <p className="text-xs text-gray-500">Emissão: {formatDateTime(new Date())}</p>
            <p className="text-xs font-bold text-gray-700 mt-1">
              Período: {formatDate(filters.startDate)} até {formatDate(filters.endDate)}
            </p>
          </div>
        </div>

        {data?.kind === 'financeiro-executivo' && (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Recebido no período
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.summary.receivedTotal)}
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Previsto no período
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.summary.scheduledInPeriodTotal)}
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Em atraso no período
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.summary.overdueInPeriodTotal)}
                </p>
              </div>

              {canSeeOpenAmountTotal && (
                <>
                  <div className="p-4 border rounded-lg bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Carteira em aberto
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(data.summary.openPortfolioTotal)}
                    </p>
                  </div>

                  <div className="p-4 border rounded-lg bg-gray-50">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                      Carteira vencida
                    </p>
                    <p className="text-xl font-bold text-gray-900">
                      {formatCurrency(data.summary.overduePortfolioTotal)}
                    </p>
                  </div>
                </>
              )}

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Ticket médio
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.summary.averageTicket)}
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Taxa de recebimento
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatPercent(data.summary.collectionRatePercent)}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Comparativo mensal do período
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Mês
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Previsto
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Recebido
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Em atraso
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.monthlyComparison.map((item) => (
                    <tr key={item.monthKey}>
                      <td className="py-3 px-2 text-sm text-gray-900 font-medium">
                        {item.monthLabel}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 text-right">
                        {formatCurrency(item.scheduledAmount)}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 text-right">
                        {formatCurrency(item.receivedAmount)}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 text-right">
                        {formatCurrency(item.overdueAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {canSeeMonthlyForecast && (
              <div className="mb-8">
                <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                  Previsão da carteira aberta — próximos 12 meses
                </h3>

                <table className="w-full border-collapse">
                  <thead>
                    <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                        Mês
                      </th>
                      <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                        Carteira em aberto
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {data.forecastNext12Months.map((item) => (
                      <tr key={item.monthKey}>
                        <td className="py-3 px-2 text-sm text-gray-900 font-medium">
                          {item.monthLabel}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900 text-right">
                          {formatCurrency(item.openAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Top parcelas em atraso
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Parcela
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Em aberto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.topOverdueDetails.length > 0 ? (
                    data.topOverdueDetails.map((item) => (
                      <tr key={item.installmentId}>
                        <td className="py-3 px-2 text-sm text-gray-900">{item.patientName}</td>
                        <td className="py-3 px-2 text-sm text-red-600 font-bold">
                          {formatDate(item.dueDate)}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-600">
                          {item.installmentNumber ? `${item.installmentNumber}ª parcela` : '-'}
                        </td>
                        <td className="py-3 px-2 text-sm text-gray-900 font-bold text-right">
                          {formatCurrency(item.outstandingAmount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-8 px-2 text-center text-sm text-gray-500">
                        Nenhuma parcela em atraso encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data?.kind === 'fluxo-caixa' && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Total Recebido
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.total)}
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Qtd Pagamentos
                </p>
                <p className="text-xl font-bold text-gray-900">{data.count}</p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Ticket Médio
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.averageTicket)}
                </p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Detalhamento dos pagamentos
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Data
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Método
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Valor
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.details.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-3 px-2 text-sm text-gray-900">
                        {formatDate(item.payment_date)}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">
                        {item.payment_method}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(Number(item.amount_paid || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data?.kind === 'inadimplencia' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Total em Atraso
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.total)}
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Parcelas Pendentes
                </p>
                <p className="text-xl font-bold text-gray-900">{data.count}</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Parcelas em atraso
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Parcela
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Valor em Aberto
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.details.map((item: any, idx: number) => (
                    <tr key={idx}>
                      <td className="py-3 px-2 text-sm text-gray-900">{item.patientName}</td>
                      <td className="py-3 px-2 text-sm text-red-600 font-bold">
                        {formatDate(item.due_date)}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">
                        {item.installment_number ? `${item.installment_number}ª parcela` : '-'}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(Number(item.outstandingAmount || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data?.kind === 'procedimentos' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Total Produzido
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {formatCurrency(data.total)}
                </p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Quantidade
                </p>
                <p className="text-xl font-bold text-gray-900">{data.count}</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Produção por procedimento
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Procedimento
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-center">
                      Qtd
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Total Produzido
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.details.map((item) => (
                    <tr key={item.name}>
                      <td className="py-3 px-2 text-sm text-gray-900">{item.name}</td>
                      <td className="py-3 px-2 text-sm text-gray-600 text-center">{item.count}</td>
                      <td className="py-3 px-2 text-sm text-gray-900 font-bold text-right">
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {data?.kind === 'pacientes' && (
          <>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Novos pacientes
                </p>
                <p className="text-xl font-bold text-gray-900">{data.count}</p>
              </div>

              <div className="p-4 border rounded-lg bg-gray-50">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                  Meses analisados
                </p>
                <p className="text-xl font-bold text-gray-900">{data.chartData.length}</p>
              </div>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Crescimento mensal de pacientes
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Mês
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Novos pacientes
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.chartData.map((item) => (
                    <tr key={item.monthKey}>
                      <td className="py-3 px-2 text-sm text-gray-900 font-medium">
                        {item.monthLabel}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-900 text-right">
                        {item.newPatientsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mb-8">
              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest mb-4">
                Pacientes cadastrados no período
              </h3>

              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100 text-left bg-gray-50">
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Nome
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Telefone
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      E-mail
                    </th>
                    <th className="py-3 px-2 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                      Cadastro
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {data.details.map((item: any) => (
                    <tr key={item.id}>
                      <td className="py-3 px-2 text-sm text-gray-900 font-bold">
                        {item.full_name}
                      </td>
                      <td className="py-3 px-2 text-sm text-gray-600">{item.phone || '-'}</td>
                      <td className="py-3 px-2 text-sm text-gray-600">{item.email || '-'}</td>
                      <td className="py-3 px-2 text-sm text-gray-500 text-right">
                        {formatDate(item.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div className="mt-12 pt-8 border-t border-gray-100 text-center">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest">
            Nord Finanças - Sistema de Gestão Odontológica
          </p>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body { background: white !important; }
              .print\:hidden { display: none !important; }
              @page { margin: 1cm; }
            }
          `,
        }}
      />
    </div>
  );
}
