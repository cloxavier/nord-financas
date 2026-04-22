/**
 * Página de Relatórios.
 * Lista os diferentes tipos de relatórios disponíveis para análise da clínica.
 * Nesta etapa, cartões financeiros respeitam o escopo financeiro do cargo.
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { BarChart3, Download, FileText, Lock, PieChart, TrendingUp } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { canViewFinancialReports } from '@/src/domain/access/policies/financialScopePolicies';

export default function ReportsPage() {
  const { financialScope } = useAuth();
  const canSeeFinancialReports = canViewFinancialReports(financialScope);

  const reports = [
    {
      title: 'Fluxo de Caixa',
      description: 'Entradas e saídas detalhadas por período.',
      icon: TrendingUp,
      color: 'text-green-600',
      type: 'fluxo-caixa',
      requiresFinancialScope: true,
    },
    {
      title: 'Inadimplência',
      description: 'Relatório de parcelas vencidas e não pagas.',
      icon: BarChart3,
      color: 'text-red-600',
      type: 'inadimplencia',
      requiresFinancialScope: true,
    },
    {
      title: 'Produção por Procedimento',
      description: 'Volume financeiro produzido por tipo de procedimento.',
      icon: PieChart,
      color: 'text-blue-600',
      type: 'procedimentos',
      requiresFinancialScope: true,
    },
    {
      title: 'Crescimento de Pacientes',
      description: 'Novos cadastros e retenção.',
      icon: FileText,
      color: 'text-purple-600',
      type: 'pacientes',
      requiresFinancialScope: false,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500">Analise o desempenho financeiro e operacional da clínica.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
        {reports.map((report, idx) => {
          const isRestricted = report.requiresFinancialScope && !canSeeFinancialReports;

          return (
            <div key={idx} className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
              <div className={`p-2.5 sm:p-3 rounded-lg bg-gray-50 ${report.color} shrink-0`}>
                <report.icon size={20} className="sm:w-6 sm:h-6" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{report.title}</h3>
                  {isRestricted && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
                      <Lock size={11} /> Restrito
                    </span>
                  )}
                </div>

                <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{report.description}</p>

                {isRestricted ? (
                  <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-xs text-amber-800 leading-5">
                    Este relatório depende de um escopo financeiro do tipo <strong>Financeiro</strong> ou <strong>Executivo</strong>.
                  </div>
                ) : (
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      to={`/relatorios/${report.type}`}
                      className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-blue-600 hover:underline"
                    >
                      <FileText size={14} />
                      Ver em Tela
                    </Link>

                    <button
                      onClick={() => window.open(`/relatorios/${report.type}/imprimir`, '_blank')}
                      className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-600 hover:underline"
                    >
                      <Download size={14} />
                      Gerar PDF
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
