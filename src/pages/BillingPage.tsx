/**
 * Página de Gestão de Cobranças.
 * Nesta etapa:
 * - a fila passa a ser paginada
 * - a busca passa a ser feita no servidor
 * - as abas continuam separando atraso real e próximos vencimentos
 * - as ações operacionais continuam disponíveis
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Phone,
  Calendar,
  AlertCircle,
  Loader2,
  ExternalLink,
  Copy,
  CheckCircle2,
  XCircle,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  canViewFinancialSummary,
  canViewOpenAmountTotal,
  canViewOperationalFinancialData,
} from '@/src/domain/access/policies/financialScopePolicies';
import { buildWhatsAppLink, cn, formatCurrency, formatDate } from '../lib/utils';
import {
  BillingQueueFilter,
  BillingQueueRow,
  getBillingQueueData,
} from '@/src/domain/collections/services/billingQueueService';
import { CollectionOperationalSummary } from '@/src/domain/collections/contracts/collectionsContracts';
import {
  completeCollectionTask,
  dismissCollectionTask,
} from '@/src/domain/collections/services/collectionsMutationService';

const emptySummary: CollectionOperationalSummary = {
  pendingTasksCount: 0,
  overduePatientsCount: 0,
  overdueInstallmentsCount: 0,
  totalOverdueAmount: 0,
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
  return `Mostrando ${start}-${end} de ${totalCount} cobranças`;
}

export default function BillingPage() {
  const { financialScope } = useAuth();
  const canViewOperationalFinancials = canViewOperationalFinancialData(financialScope);
  const canViewSummaryFinancials =
    canViewFinancialSummary(financialScope) || canViewOpenAmountTotal(financialScope);

  const renderOperationalAmount = (value: number) =>
    canViewOperationalFinancials ? formatCurrency(value) : 'Acesso restrito';

  const renderSummaryAmount = (value: number) =>
    canViewSummaryFinancials ? formatCurrency(value) : 'Acesso restrito';

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BillingQueueRow[]>([]);
  const [summary, setSummary] = useState<CollectionOperationalSummary>(emptySummary);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillingQueueFilter>('overdue');
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter, pageSize]);

  useEffect(() => {
    fetchBillingData();
  }, [statusFilter, page, pageSize, debouncedSearchTerm]);

  async function fetchBillingData() {
    setLoading(true);

    try {
      const result = await getBillingQueueData({
        filter: statusFilter,
        page,
        pageSize,
        searchTerm: debouncedSearchTerm,
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
      console.error('Error fetching billing data:', error);
      setRows([]);
      setSummary(emptySummary);
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteTask(taskId: string | null) {
    if (!taskId) return;

    try {
      setProcessingTaskId(taskId);
      await completeCollectionTask(taskId);
      await fetchBillingData();
    } catch (error) {
      console.error('Error completing collection task:', error);
      alert('Não foi possível concluir a tarefa.');
    } finally {
      setProcessingTaskId(null);
    }
  }

  async function handleDismissTask(taskId: string | null) {
    if (!taskId) return;

    const confirmed = window.confirm('Deseja realmente dispensar esta tarefa?');
    if (!confirmed) return;

    try {
      setProcessingTaskId(taskId);
      await dismissCollectionTask(taskId);
      await fetchBillingData();
    } catch (error) {
      console.error('Error dismissing collection task:', error);
      alert('Não foi possível dispensar a tarefa.');
    } finally {
      setProcessingTaskId(null);
    }
  }

  const paginationLabel = useMemo(
    () => getPaginationLabel(page, pageSize, totalCount),
    [page, pageSize, totalCount]
  );

  const getBillingMessage = (name: string, amount: number, dueDate: string) => {
    const amountText = canViewOperationalFinancials ? formatCurrency(amount) : 'sua parcela';
    return `Olá ${name}, tudo bem? Aqui é da Nord Finanças. Notamos que ${amountText} com vencimento em ${formatDate(dueDate)} ainda precisa de acompanhamento. Poderia nos responder por aqui?`;
  };

  const getWhatsAppLink = (phone: string, name: string, amount: number, dueDate: string) => {
    const message = getBillingMessage(name, amount, dueDate);
    return buildWhatsAppLink(phone, message);
  };

  const handleOpenWhatsApp = (
    phone: string,
    name: string,
    amount: number,
    dueDate: string
  ) => {
    const link = getWhatsAppLink(phone, name, amount, dueDate);

    if (!link) {
      alert(
        'Não foi possível abrir o WhatsApp porque o telefone do paciente está ausente ou incompleto. Cadastre DDD + número para o contato funcionar corretamente.'
      );
      return;
    }

    window.open(link, '_blank', 'noopener,noreferrer');
  };

  const copyBillingMessage = async (name: string, amount: number, dueDate: string) => {
    const message = getBillingMessage(name, amount, dueDate);
    await navigator.clipboard.writeText(message);
    alert('Mensagem copiada para a área de transferência!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Cobranças</h1>
          <p className="text-sm text-gray-500">
            Acompanhe parcelas em atraso reais e a fila operacional dos próximos vencimentos.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-white p-1 rounded-lg border shadow-sm flex">
            <button
              onClick={() => setStatusFilter('overdue')}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-bold transition-all',
                statusFilter === 'overdue'
                  ? 'bg-red-600 text-white shadow-md shadow-red-100'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Em Atraso
            </button>

            <button
              onClick={() => setStatusFilter('pending')}
              className={cn(
                'px-4 py-1.5 rounded-md text-sm font-bold transition-all',
                statusFilter === 'pending'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-100'
                  : 'text-gray-500 hover:text-gray-700'
              )}
            >
              Próximos Vencimentos
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="md:col-span-3 space-y-4">
          <div className="bg-white rounded-xl border shadow-sm p-4 flex flex-col xl:flex-row gap-4 xl:items-center">
            <div className="relative flex-1">
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

            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white text-sm font-medium xl:shrink-0"
            >
              <option value={25}>25 por página</option>
              <option value={50}>50 por página</option>
              <option value={100}>100 por página</option>
            </select>
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
                  <tr className="border-b bg-gray-50/50">
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Paciente
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Vencimento
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Valor
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                      Ações de Cobrança
                    </th>
                    <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider"></th>
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
                    rows.map((row) => {
                      const isProcessing = !!row.taskId && processingTaskId === row.taskId;
                      const isOperationalTask = row.sourceType === 'task';

                      return (
                        <tr key={row.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
                                {row.patientName.charAt(0)}
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{row.patientName}</p>
                                <p className="text-xs text-gray-500">{row.patientPhone}</p>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">
                                  {row.taskTitle}
                                </p>
                                {row.treatmentId ? (
                                  <p className="text-[10px] text-gray-400 mt-0.5">
                                    Tratamento #{row.treatmentId.slice(0, 8)}
                                  </p>
                                ) : null}
                              </div>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <Calendar
                                size={14}
                                className={row.isOverdue ? 'text-red-500' : 'text-gray-400'}
                              />
                              <span
                                className={cn(
                                  'text-sm font-bold',
                                  row.isOverdue ? 'text-red-600' : 'text-gray-700'
                                )}
                              >
                                {formatDate(row.dueDate)}
                              </span>
                            </div>

                            {isOperationalTask ? (
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                                Programado para {formatDate(row.scheduledFor)}
                              </p>
                            ) : (
                              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                                Parcela real em atraso
                              </p>
                            )}

                            {row.isOverdue && (
                              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mt-0.5">
                                Atrasado
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900">
                              {renderOperationalAmount(row.amount)}
                            </p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              {isOperationalTask
                                ? 'Tarefa operacional'
                                : `Parcela ${row.installmentNumber ?? '-'}`}
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                onClick={() =>
                                  handleOpenWhatsApp(
                                    row.patientPhone,
                                    row.patientName,
                                    row.amount,
                                    row.dueDate
                                  )
                                }
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                title="Abrir WhatsApp"
                                type="button"
                              >
                                <Phone size={18} />
                              </button>

                              <button
                                onClick={() =>
                                  copyBillingMessage(row.patientName, row.amount, row.dueDate)
                                }
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Copiar Mensagem"
                              >
                                <Copy size={18} />
                              </button>

                              {isOperationalTask ? (
                                <>
                                  <button
                                    onClick={() => handleCompleteTask(row.taskId)}
                                    disabled={isProcessing}
                                    className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                    title="Marcar como concluída"
                                  >
                                    <CheckCircle2 size={18} />
                                  </button>

                                  <button
                                    onClick={() => handleDismissTask(row.taskId)}
                                    disabled={isProcessing}
                                    className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                                    title="Dispensar tarefa"
                                  >
                                    <XCircle size={18} />
                                  </button>
                                </>
                              ) : null}
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right">
                            {row.installmentId ? (
                              <Link
                                to={`/parcelas/${row.installmentId}`}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
                                title="Abrir parcela"
                              >
                                <ExternalLink size={18} />
                              </Link>
                            ) : (
                              <span className="text-gray-300">
                                <ExternalLink size={18} />
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center">
                        <p className="text-gray-500">Nenhuma cobrança encontrada para este filtro.</p>
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
                rows.map((row) => {
                  const isProcessing = !!row.taskId && processingTaskId === row.taskId;
                  const isOperationalTask = row.sourceType === 'task';

                  return (
                    <div key={row.id} className="p-4 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-sm">
                            {row.patientName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-gray-900">{row.patientName}</p>
                            <p className="text-xs text-gray-500">{row.patientPhone}</p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mt-1">
                              {row.taskTitle}
                            </p>
                            {row.treatmentId ? (
                              <p className="text-[10px] text-gray-400 mt-0.5">
                                Tratamento #{row.treatmentId.slice(0, 8)}
                              </p>
                            ) : null}
                          </div>
                        </div>

                        {row.installmentId ? (
                          <Link
                            to={`/parcelas/${row.installmentId}`}
                            className="p-2 text-gray-400 hover:text-blue-600"
                          >
                            <ExternalLink size={18} />
                          </Link>
                        ) : null}
                      </div>

                      <div className="grid grid-cols-2 gap-4 py-2 border-y border-gray-50">
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                            Vencimento
                          </p>
                          <div className="flex items-center gap-2">
                            <Calendar
                              size={14}
                              className={row.isOverdue ? 'text-red-500' : 'text-gray-400'}
                            />
                            <span
                              className={cn(
                                'text-sm font-bold',
                                row.isOverdue ? 'text-red-600' : 'text-gray-700'
                              )}
                            >
                              {formatDate(row.dueDate)}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {isOperationalTask
                              ? `Programado para ${formatDate(row.scheduledFor)}`
                              : 'Parcela real em atraso'}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                            Valor
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {renderOperationalAmount(row.amount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          onClick={() =>
                            handleOpenWhatsApp(
                              row.patientPhone,
                              row.patientName,
                              row.amount,
                              row.dueDate
                            )
                          }
                          className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold"
                          type="button"
                        >
                          <Phone size={14} />
                          WhatsApp
                        </button>

                        <button
                          onClick={() => copyBillingMessage(row.patientName, row.amount, row.dueDate)}
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                        >
                          <Copy size={16} />
                        </button>

                        {isOperationalTask ? (
                          <>
                            <button
                              onClick={() => handleCompleteTask(row.taskId)}
                              disabled={isProcessing}
                              className="p-2 bg-emerald-50 text-emerald-600 rounded-lg disabled:opacity-50"
                              title="Concluir"
                            >
                              <CheckCircle2 size={16} />
                            </button>

                            <button
                              onClick={() => handleDismissTask(row.taskId)}
                              disabled={isProcessing}
                              className="p-2 bg-gray-100 text-gray-600 rounded-lg disabled:opacity-50"
                              title="Dispensar"
                            >
                              <XCircle size={16} />
                            </button>
                          </>
                        ) : null}

                        {row.isOverdue && (
                          <span className="px-2 py-1 bg-red-100 text-red-600 text-[10px] font-bold rounded uppercase">
                            Atrasado
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center">
                  <p className="text-gray-500">Nenhuma cobrança encontrada.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-xl border shadow-sm p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <AlertCircle size={18} className="text-red-600" />
              Resumo do Atraso
            </h3>

            <div className="space-y-4">
              <div className="p-4 bg-red-50 rounded-lg border border-red-100">
                <p className="text-xs text-red-600 font-bold uppercase tracking-wider mb-1">
                  Total Inadimplente
                </p>
                <p className="text-2xl font-bold text-red-700">
                  {renderSummaryAmount(summary.totalOverdueAmount)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Parcelas em atraso</span>
                  <span className="font-bold text-gray-900">{summary.overdueInstallmentsCount}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pacientes devedores</span>
                  <span className="font-bold text-gray-900">{summary.overduePatientsCount}</span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tarefas na fila atual</span>
                  <span className="font-bold text-gray-900">{summary.pendingTasksCount}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-600 rounded-xl p-6 text-white shadow-lg shadow-blue-200">
            <h3 className="font-bold text-lg mb-2">Dica de Cobrança</h3>
            <p className="text-sm text-blue-100 leading-relaxed">
              Trabalhe a fila operacional do dia e registre o que foi feito. Isso melhora a
              rastreabilidade e reduz falhas de acompanhamento.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
