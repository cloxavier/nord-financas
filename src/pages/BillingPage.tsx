/**
 * Página de Gestão de Cobranças.
 * Nesta fase, consome a fila operacional real baseada em collection_tasks
 * e permite concluir ou dispensar tarefas pendentes.
 */
import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn, formatCurrency, formatDate } from '../lib/utils';
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

export default function BillingPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BillingQueueRow[]>([]);
  const [summary, setSummary] = useState<CollectionOperationalSummary>(emptySummary);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillingQueueFilter>('overdue');
  const [processingTaskId, setProcessingTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchBillingData();
  }, [statusFilter]);

  async function fetchBillingData() {
    setLoading(true);

    try {
      const result = await getBillingQueueData(statusFilter);
      setRows(result.rows);
      setSummary(result.summary);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCompleteTask(taskId: string) {
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

  async function handleDismissTask(taskId: string) {
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

  const filteredRows = rows.filter((row) =>
    row.patientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getWhatsAppLink = (phone: string, name: string, amount: number, dueDate: string) => {
    const message = `Olá ${name}, tudo bem? Aqui é da Nord Finanças. Notamos que sua parcela de ${formatCurrency(amount)} com vencimento em ${formatDate(dueDate)} ainda precisa de acompanhamento. Poderia nos responder por aqui?`;
    return `https://wa.me/${(phone || '').replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
  };

  const copyBillingMessage = (name: string, amount: number, dueDate: string) => {
    const message = `Olá ${name}, tudo bem? Aqui é da Nord Finanças. Notamos que sua parcela de ${formatCurrency(amount)} com vencimento em ${formatDate(dueDate)} ainda precisa de acompanhamento. Poderia nos responder por aqui?`;
    navigator.clipboard.writeText(message);
    alert('Mensagem copiada para a área de transferência!');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gestão de Cobranças</h1>
          <p className="text-sm text-gray-500">
            Acompanhe a fila operacional real de cobranças e vencimentos.
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
          <div className="bg-white rounded-xl border shadow-sm p-4 flex items-center gap-4">
            <div className="relative flex-1">
              <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar por paciente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
          </div>

          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
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
                  ) : filteredRows.length > 0 ? (
                    filteredRows.map((row) => {
                      const isProcessing = processingTaskId === row.id;

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

                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1">
                              Programado para {formatDate(row.scheduledFor)}
                            </p>

                            {row.isOverdue && (
                              <p className="text-[10px] font-bold text-red-400 uppercase tracking-wider mt-0.5">
                                Atrasado
                              </p>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <p className="text-sm font-bold text-gray-900">
                              {formatCurrency(row.amount)}
                            </p>
                            <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                              Tarefa operacional
                            </p>
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2 flex-wrap">
                              <a
                                href={getWhatsAppLink(
                                  row.patientPhone,
                                  row.patientName,
                                  row.amount,
                                  row.dueDate
                                )}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition-colors"
                                title="Abrir WhatsApp"
                              >
                                <Phone size={18} />
                              </a>

                              <button
                                onClick={() =>
                                  copyBillingMessage(row.patientName, row.amount, row.dueDate)
                                }
                                className="p-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                                title="Copiar Mensagem"
                              >
                                <Copy size={18} />
                              </button>

                              <button
                                onClick={() => handleCompleteTask(row.id)}
                                disabled={isProcessing}
                                className="p-2 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100 transition-colors disabled:opacity-50"
                                title="Marcar como concluída"
                              >
                                <CheckCircle2 size={18} />
                              </button>

                              <button
                                onClick={() => handleDismissTask(row.id)}
                                disabled={isProcessing}
                                className="p-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                                title="Dispensar tarefa"
                              >
                                <XCircle size={18} />
                              </button>
                            </div>
                          </td>

                          <td className="px-6 py-4 text-right">
                            {row.installmentId ? (
                              <Link
                                to={`/parcelas/${row.installmentId}`}
                                className="text-gray-400 hover:text-blue-600 transition-colors"
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
                        <p className="text-gray-500">
                          Nenhuma cobrança encontrada para este filtro.
                        </p>
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
              ) : filteredRows.length > 0 ? (
                filteredRows.map((row) => {
                  const isProcessing = processingTaskId === row.id;

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
                            Programado para {formatDate(row.scheduledFor)}
                          </p>
                        </div>

                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider mb-1">
                            Valor
                          </p>
                          <p className="text-sm font-bold text-gray-900">
                            {formatCurrency(row.amount)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <a
                          href={getWhatsAppLink(
                            row.patientPhone,
                            row.patientName,
                            row.amount,
                            row.dueDate
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-2 bg-green-50 text-green-600 rounded-lg text-xs font-bold"
                        >
                          <Phone size={14} />
                          WhatsApp
                        </a>

                        <button
                          onClick={() =>
                            copyBillingMessage(row.patientName, row.amount, row.dueDate)
                          }
                          className="p-2 bg-blue-50 text-blue-600 rounded-lg"
                        >
                          <Copy size={16} />
                        </button>

                        <button
                          onClick={() => handleCompleteTask(row.id)}
                          disabled={isProcessing}
                          className="p-2 bg-emerald-50 text-emerald-600 rounded-lg disabled:opacity-50"
                          title="Concluir"
                        >
                          <CheckCircle2 size={16} />
                        </button>

                        <button
                          onClick={() => handleDismissTask(row.id)}
                          disabled={isProcessing}
                          className="p-2 bg-gray-100 text-gray-600 rounded-lg disabled:opacity-50"
                          title="Dispensar"
                        >
                          <XCircle size={16} />
                        </button>

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
                  {formatCurrency(summary.totalOverdueAmount)}
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Parcelas em atraso</span>
                  <span className="font-bold text-gray-900">
                    {summary.overdueInstallmentsCount}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Pacientes devedores</span>
                  <span className="font-bold text-gray-900">
                    {summary.overduePatientsCount}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Tarefas na fila atual</span>
                  <span className="font-bold text-gray-900">
                    {summary.pendingTasksCount}
                  </span>
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