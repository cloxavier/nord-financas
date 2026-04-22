/**
 * Página de Listagem de Parcelas.
 * Nesta etapa:
 * - a lista passa a usar paginação server-side
 * - a busca passa a ser feita no servidor
 * - o filtro por status passa a ser feito no servidor
 * - o resumo financeiro continua no topo
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react';
import { formatCurrency, formatDate, cn } from '../lib/utils';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  canViewFinancialSummary,
  canViewOpenAmountTotal,
  canViewOperationalFinancialData,
} from '@/src/domain/access/policies/financialScopePolicies';
import {
  getInstallmentsListData,
  InstallmentListFilter,
  InstallmentListRow,
  InstallmentListSummary,
} from '@/src/domain/receivables/services/installmentsListService';

const emptySummary: InstallmentListSummary = {
  overdueAmount: 0,
  overdueCount: 0,
  pendingAmount: 0,
  pendingCount: 0,
  paidAmount: 0,
  paidCount: 0,
};

function useDebouncedValue<T>(value: T, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

function getPaginationLabel(page: number, pageSize: number, totalCount: number) {
  if (totalCount === 0) return 'Nenhum resultado encontrado';

  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, totalCount);
  return `Mostrando ${start}-${end} de ${totalCount} parcelas`;
}

export default function InstallmentsPage() {
  const { financialScope } = useAuth();
  const canViewOperationalFinancials = canViewOperationalFinancialData(financialScope);
  const canViewSummaryFinancials =
    canViewFinancialSummary(financialScope) || canViewOpenAmountTotal(financialScope);

  const renderOperationalAmount = (value: number) =>
    canViewOperationalFinancials ? formatCurrency(value) : 'Acesso restrito';

  const renderSummaryAmount = (value: number) =>
    canViewSummaryFinancials ? formatCurrency(value) : 'Acesso restrito';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<InstallmentListRow[]>([]);
  const [summary, setSummary] = useState<InstallmentListSummary>(emptySummary);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InstallmentListFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter, pageSize]);

  useEffect(() => {
    fetchInstallments();
  }, [page, pageSize, statusFilter, debouncedSearchTerm]);

  async function fetchInstallments() {
    setLoading(true);

    try {
      const result = await getInstallmentsListData({
        page,
        pageSize,
        searchTerm: debouncedSearchTerm,
        statusFilter,
      });

      if (result.totalPages > 0 && page > result.totalPages) {
        setPage(result.totalPages);
        return;
      }

      setRows(result.rows);
      setSummary(result.summary);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Error fetching installments:', error);
      setRows([]);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }

  const paginationLabel = useMemo(
    () => getPaginationLabel(page, pageSize, totalCount),
    [page, pageSize, totalCount]
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parcelas</h1>
          <p className="text-sm text-gray-500">
            Controle o recebimento das parcelas de tratamentos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl border border-red-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-red-500 uppercase tracking-wider">
              Vencidas
            </span>
            <AlertCircle size={18} className="text-red-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {renderSummaryAmount(summary.overdueAmount)}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {summary.overdueCount} parcelas em atraso
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-blue-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-blue-500 uppercase tracking-wider">
              A Vencer
            </span>
            <Clock size={18} className="text-blue-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {renderSummaryAmount(summary.pendingAmount)}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {summary.pendingCount} parcelas previstas
          </p>
        </div>

        <div className="bg-white p-6 rounded-xl border border-green-100 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
              Recebidas
            </span>
            <CheckCircle size={18} className="text-green-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {renderSummaryAmount(summary.paidAmount)}
          </p>
          <p className="text-xs text-gray-500 mt-1 font-medium">
            {summary.paidCount} parcelas pagas
          </p>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center">
        <div className="flex-1 relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar por paciente, telefone ou ID completo do tratamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 xl:shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InstallmentListFilter)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="pending">Pendente</option>
            <option value="paid">Pago</option>
            <option value="overdue">Atrasado</option>
          </select>

          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value))}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
          >
            <option value={25}>25 por página</option>
            <option value={50}>50 por página</option>
            <option value={100}>100 por página</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b bg-gray-50/50 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <p className="text-sm font-medium text-gray-600">{paginationLabel}</p>

          <div className="flex items-center gap-2 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              disabled={loading || page <= 1}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
              Anterior
            </button>

            <span className="text-sm font-semibold text-gray-700 px-2">
              Página {totalPages === 0 ? 0 : page} de {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setPage((prev) => Math.min(totalPages || 1, prev + 1))}
              disabled={loading || page >= totalPages}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Próxima
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Vencimento
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Paciente / Tratamento
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Parcela
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Valor
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>

            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((inst) => (
                  <tr key={inst.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'text-sm font-bold',
                          inst.effectiveStatus === 'overdue' ? 'text-red-600' : 'text-gray-700'
                        )}
                      >
                        {formatDate(inst.due_date)}
                      </span>
                    </td>

                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">{inst.patientName}</p>
                      <p className="text-xs text-gray-500">
                        Tratamento #{inst.treatment_id?.slice(0, 8)}
                      </p>
                    </td>

                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {inst.installment_number}
                    </td>

                    <td className="px-6 py-4">
                      {inst.effectiveStatus === 'paid' ? (
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {renderOperationalAmount(inst.actualReceivedAmount)}
                          </p>
                          <p className="text-[10px] text-gray-500 font-medium">
                            recebido · principal {renderOperationalAmount(inst.amount)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <p className="text-sm font-bold text-gray-900">
                            {renderOperationalAmount(inst.amount)}
                          </p>
                          {inst.effectiveStatus === 'overdue' && (
                            <p className="text-[10px] text-red-500 font-medium">
                              em aberto {renderOperationalAmount(inst.outstandingAmount)}
                            </p>
                          )}
                        </div>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider',
                          inst.effectiveStatus === 'paid'
                            ? 'bg-green-100 text-green-700'
                            : inst.effectiveStatus === 'overdue'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {inst.effectiveStatus === 'paid' ? (
                          <CheckCircle size={12} />
                        ) : inst.effectiveStatus === 'overdue' ? (
                          <AlertCircle size={12} />
                        ) : (
                          <Clock size={12} />
                        )}
                        {inst.effectiveStatusLabel}
                      </span>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/parcelas/${inst.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <span>{inst.effectiveStatus === 'paid' ? 'Detalhes' : 'Dar Baixa'}</span>
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Nenhuma parcela encontrada.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
            </div>
          ) : rows.length > 0 ? (
            rows.map((inst) => (
              <div key={inst.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-bold text-gray-900">{inst.patientName}</p>
                    <p className="text-[10px] text-gray-500">
                      Tratamento #{inst.treatment_id?.slice(0, 8)}
                    </p>
                  </div>

                  <span
                    className={cn(
                      'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider',
                      inst.effectiveStatus === 'paid'
                        ? 'bg-green-100 text-green-700'
                        : inst.effectiveStatus === 'overdue'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-gray-100 text-gray-700'
                    )}
                  >
                    {inst.effectiveStatusLabel}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400 uppercase font-bold text-[9px]">Vencimento</p>
                    <p
                      className={cn(
                        'font-bold',
                        inst.effectiveStatus === 'overdue' ? 'text-red-600' : 'text-gray-700'
                      )}
                    >
                      {formatDate(inst.due_date)}
                    </p>
                  </div>

                  <div>
                    <p className="text-gray-400 uppercase font-bold text-[9px]">Parcela</p>
                    <p className="font-bold text-gray-700">{inst.installment_number}ª Parcela</p>
                  </div>

                  <div className="col-span-2">
                    <p className="text-gray-400 uppercase font-bold text-[9px]">Valor</p>
                    {inst.effectiveStatus === 'paid' ? (
                      <div>
                        <p className="font-bold text-gray-900">
                          {renderOperationalAmount(inst.actualReceivedAmount)}
                        </p>
                        <p className="text-[10px] text-gray-500 font-medium">
                          recebido · principal {renderOperationalAmount(inst.amount)}
                        </p>
                      </div>
                    ) : (
                      <p className="font-bold text-gray-900">
                        {renderOperationalAmount(inst.amount)}
                      </p>
                    )}
                  </div>
                </div>

                <Link
                  to={`/parcelas/${inst.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold"
                >
                  <span>
                    {inst.effectiveStatus === 'paid' ? 'Ver Detalhes' : 'Dar Baixa / Detalhes'}
                  </span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">Nenhuma parcela encontrada.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
