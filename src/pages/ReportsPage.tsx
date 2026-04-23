/**
 * Página de Relatórios.
 * Lista os diferentes tipos de relatórios disponíveis para análise da clínica.
 *
 * Nesta etapa:
 * - adiciona o relatório Financeiro Executivo
 * - separa relatórios financeiros por escopo financeiro
 * - mantém Crescimento de Pacientes disponível fora da trava financeira pesada
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Download,
  FileText,
  Lock,
  PieChart,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getFinancialAccessLevel } from '@/src/domain/access/policies/financialScopePolicies';

type ReportType =
  | 'financeiro-executivo'
  | 'fluxo-caixa'
  | 'inadimplencia'
  | 'procedimentos'
  | 'pacientes';

interface ReportCardDefinition {
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  color: string;
  type: ReportType;
  access: 'public' | 'financial' | 'executive';
}

function canAccessReport(
  reportAccess: ReportCardDefinition['access'],
  financialAccessLevel: string
) {
  if (reportAccess === 'public') return true;
  if (reportAccess === 'financial') {
    return financialAccessLevel === 'financial' || financialAccessLevel === 'executive';
  }
  return financialAccessLevel === 'executive';
}

function getRestrictionLabel(reportAccess: ReportCardDefinition['access']) {
  if (reportAccess === 'executive') {
    return 'Disponível apenas para escopo Executivo';
  }

  return 'Disponível apenas para escopo Financeiro ou Executivo';
}

export default function ReportsPage() {
  const { financialScope } = useAuth();
  const navigate = useNavigate();
  const financialAccessLevel = getFinancialAccessLevel(financialScope);

  const reports: ReportCardDefinition[] = [
    {
      title: 'Financeiro Executivo',
      description:
        'Visão gerencial consolidada com recebido no período, atraso, carteira em aberto, comparação mensal e previsão dos próximos 12 meses.',
      icon: WalletCards,
      color: 'text-indigo-600',
      type: 'financeiro-executivo',
      access: 'executive',
    },
    {
      title: 'Fluxo de Caixa',
      description: 'Entradas realizadas por período, com total recebido, ticket médio e evolução diária.',
      icon: TrendingUp,
      color: 'text-green-600',
      type: 'fluxo-caixa',
      access: 'financial',
    },
    {
      title: 'Inadimplência',
      description: 'Parcelas vencidas e não pagas, com visão objetiva dos valores em atraso.',
      icon: BarChart3,
      color: 'text-red-600',
      type: 'inadimplencia',
      access: 'financial',
    },
    {
      title: 'Produção por Procedimento',
      description: 'Volume produzido por procedimento dentro do período selecionado.',
      icon: PieChart,
      color: 'text-blue-600',
      type: 'procedimentos',
      access: 'financial',
    },
    {
      title: 'Crescimento de Pacientes',
      description: 'Novos cadastros por período e evolução da base de pacientes.',
      icon: FileText,
      color: 'text-purple-600',
      type: 'pacientes',
      access: 'public',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500">
            Analise o desempenho financeiro e operacional da clínica com visão por período.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-4 sm:gap-6">
        {reports.map((report) => {
          const isRestricted = !canAccessReport(report.access, financialAccessLevel);

          return (
            <div
              key={report.type}
              className="bg-white p-5 sm:p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex items-start gap-4"
            >
              <div className={`p-3 rounded-lg bg-gray-50 ${report.color} shrink-0`}>
                <report.icon size={22} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">
                    {report.title}
                  </h3>

                  {isRestricted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                      <Lock size={11} />
                      Restrito
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-gray-500 mt-1 leading-6">
                  {report.description}
                </p>

                {isRestricted ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 leading-5">
                    {getRestrictionLabel(report.access)}
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to={`/relatorios/${report.type}`}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:underline"
                    >
                      <FileText size={14} />
                      Ver em Tela
                    </Link>

                    <button
                      onClick={() =>
                        navigate(`/relatorios/${report.type}/imprimir?back=${encodeURIComponent('/relatorios')}`)
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:underline"
                    >
                      <Download size={14} />
                      Imprimir / Salvar PDF
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}