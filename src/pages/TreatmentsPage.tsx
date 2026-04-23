/**
 * Página de Listagem de Tratamentos.
 * Nesta etapa:
 * - a lista passa a usar paginação server-side
 * - a busca passa a ser feita no servidor
 * - o filtro de status passa a ser aplicado no servidor
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  Loader2,
  ChevronRight,
  User,
  Calendar,
  ChevronLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { canViewOperationalFinancialData } from '@/src/domain/access/policies/financialScopePolicies';
import { formatCurrency, formatDate } from '../lib/utils';
import {
  getTreatmentsListData,
  TreatmentListFilter,
  TreatmentListRow,
} from '@/src/domain/treatments/services/treatmentsListService';

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
  return `Mostrando ${start}-${end} de ${totalCount} tratamentos`;
}

export default function TreatmentsPage() {
  const { financialScope } = useAuth();
  const canViewOperationalFinancials = canViewOperationalFinancialData(financialScope);
  const renderAmount = (value: number) =>
    canViewOperationalFinancials ? formatCurrency(value) : 'Acesso restrito';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<TreatmentListRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<TreatmentListFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter, pageSize]);

  useEffect(() => {
    fetchTreatments();
  }, [page, pageSize, statusFilter, debouncedSearchTerm]);

  async function fetchTreatments() {
    setLoading(true);
    try {
      const result = await getTreatmentsListData({
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
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Error fetching treatments:', error);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };

    const labels: Record<string, string> = {
      draft: 'Rascunho',
      pending: 'Pendente',
      in_progress: 'Em Andamento',
      completed: 'Concluído',
      cancelled: 'Cancelado',
    };

    return (
      <span
        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status] || 'bg-gray-100 text-gray-700'}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tratamentos</h1>
          <p className="text-sm text-gray-500">
            Acompanhe os orçamentos e tratamentos em andamento com paginação e busca mais leve.
          </p>
        </div>
        <Link
          to="/tratamentos/novo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          <Plus size={20} />
          <span>Novo Tratamento</span>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por paciente ou ID completo do tratamento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 xl:shrink-0">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as TreatmentListFilter)}
            className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="draft">Orçamento</option>
            <option value="pending">Pendente</option>
            <option value="in_progress">Em Andamento</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
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
                  Paciente / ID
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Valor Total
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Data
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
                  </td>
                </tr>
              ) : rows.length > 0 ? (
                rows.map((t) => (
                  <tr key={t.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                          <User size={20} />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-gray-900">{t.patientName}</p>
                          <p className="text-[10px] font-mono text-gray-400">#{t.id.slice(0, 8)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(t.status)}</td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-gray-900">
                        {renderAmount(t.total_amount)}
                      </p>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                        Sub: {renderAmount(t.subtotal)}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Calendar size={14} className="text-gray-400" />
                        {formatDate(t.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/tratamentos/${t.id}`}
                        className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:text-blue-700 transition-colors"
                      >
                        <span>Detalhes</span>
                        <ChevronRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <p className="text-gray-500">Nenhum tratamento encontrado.</p>
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
            rows.map((t) => (
              <div key={t.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600">
                      <User size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">{t.patientName}</p>
                      <p className="text-[10px] font-mono text-gray-400">#{t.id.slice(0, 8)}</p>
                    </div>
                  </div>
                  {getStatusBadge(t.status)}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-gray-400 uppercase font-bold text-[9px]">Valor Total</p>
                    <p className="font-bold text-gray-900">{renderAmount(t.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 uppercase font-bold text-[9px]">Data</p>
                    <p className="font-bold text-gray-700">{formatDate(t.created_at)}</p>
                  </div>
                </div>

                <Link
                  to={`/tratamentos/${t.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-colors"
                >
                  <span>Ver Detalhes</span>
                  <ChevronRight size={14} />
                </Link>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-500">Nenhum tratamento encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
