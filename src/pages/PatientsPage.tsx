/**
 * Página de Listagem de Pacientes.
 * Nesta etapa:
 * - a lista passa a usar paginação server-side
 * - a busca passa a ser feita no servidor
 * - adiciona badge "Ativo"
 * - adiciona filtro rápido "Só ativos"
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Search,
  User,
  Loader2,
  ChevronRight,
  Phone,
  Mail,
  Calendar,
  ChevronLeft,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { formatDate, cn } from '../lib/utils';
import {
  getPatientsListData,
  PatientListRow,
} from '@/src/domain/patients/services/patientsListService';

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
  return `Mostrando ${start}-${end} de ${totalCount} pacientes`;
}

export default function PatientsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<PatientListRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [onlyActive, setOnlyActive] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  const debouncedSearchTerm = useDebouncedValue(searchTerm, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, onlyActive, pageSize]);

  useEffect(() => {
    fetchPatients();
  }, [page, pageSize, debouncedSearchTerm, onlyActive]);

  async function fetchPatients() {
    setLoading(true);
    try {
      const result = await getPatientsListData({
        page,
        pageSize,
        searchTerm: debouncedSearchTerm,
        onlyActive,
      });

      if (result.totalPages > 0 && page > result.totalPages) {
        setPage(result.totalPages);
        return;
      }

      setRows(result.rows);
      setTotalCount(result.totalCount);
      setTotalPages(result.totalPages);
    } catch (error) {
      console.error('Error fetching patients:', error);
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
          <h1 className="text-2xl font-bold text-gray-900">Pacientes</h1>
          <p className="text-sm text-gray-500">
            Gerencie o cadastro, histórico e pacientes atualmente em acompanhamento.
          </p>
        </div>
        <Link
          to="/pacientes/novo"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
        >
          <Plus size={20} />
          <span>Novo Paciente</span>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-xl border shadow-sm flex flex-col xl:flex-row gap-4 xl:items-center">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Buscar por nome, CPF ou telefone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-3 xl:shrink-0">
          <button
            type="button"
            onClick={() => setOnlyActive((prev) => !prev)}
            className={cn(
              'px-4 py-2 rounded-lg border text-sm font-bold transition-colors',
              onlyActive
                ? 'bg-green-50 text-green-700 border-green-200'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            {onlyActive ? 'Mostrando só ativos' : 'Filtrar só ativos'}
          </button>

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
                  Paciente
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Contato
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  CPF
                </th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">
                  Cadastro
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
                rows.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                          {p.full_name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-bold text-gray-900">{p.full_name}</p>
                            {p.isActive && (
                              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
                                Ativo
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            ID: {p.id.slice(0, 8)}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-gray-600">
                          <Phone size={12} className="text-gray-400" />
                          {p.phone || 'N/A'}
                        </div>
                        {p.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Mail size={12} className="text-gray-400" />
                            {p.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 font-medium">{p.cpf || '---'}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-xs text-gray-600">
                        <Calendar size={12} className="text-gray-400" />
                        {formatDate(p.created_at)}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        to={`/pacientes/${p.id}`}
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
                    <p className="text-gray-500">Nenhum paciente encontrado.</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="md:hidden divide-y">
          {loading ? (
            <div className="px-6 py-12 text-center">
              <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto" />
            </div>
          ) : rows.length > 0 ? (
            rows.map((p) => (
              <div key={p.id} className="p-4 space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 font-bold shrink-0">
                      {p.full_name.charAt(0)}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-gray-900 leading-tight">{p.full_name}</h3>
                        {p.isActive && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-green-100 text-green-700">
                            Ativo
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                        ID: {p.id.slice(0, 8)}
                      </p>
                    </div>
                  </div>
                  <Link
                    to={`/pacientes/${p.id}`}
                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <ChevronRight size={20} />
                  </Link>
                </div>

                <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Contato</p>
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Phone size={12} className="text-gray-400" />
                        {p.phone || 'N/A'}
                      </div>
                      {p.email && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 truncate">
                          <Mail size={12} className="text-gray-400" />
                          <span className="truncate">{p.email}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Documento</p>
                    <p className="text-xs text-gray-700 font-medium">{p.cpf || '---'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Cadastro</p>
                    <div className="flex items-center gap-1.5 text-xs text-gray-600">
                      <Calendar size={12} className="text-gray-400" />
                      {formatDate(p.created_at)}
                    </div>
                  </div>
                </div>

                <Link
                  to={`/pacientes/${p.id}`}
                  className="flex items-center justify-center gap-2 w-full py-2.5 bg-gray-50 text-blue-600 rounded-lg text-sm font-bold hover:bg-blue-100 transition-colors border border-gray-100"
                >
                  Ver Detalhes do Paciente
                </Link>
              </div>
            ))
          ) : (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-500">Nenhum paciente encontrado.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
