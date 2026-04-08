/**
 * Página de Relatórios.
 * Lista os diferentes tipos de relatórios disponíveis para análise da clínica.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Download, FileText, PieChart, TrendingUp } from 'lucide-react';

export default function ReportsPage() {
  // Hook para navegação programática
  const navigate = useNavigate();

  // Definição dos tipos de relatórios disponíveis
  const reports = [
    { 
      title: 'Fluxo de Caixa', 
      description: 'Entradas e saídas detalhadas por período.', 
      icon: TrendingUp, 
      color: 'text-green-600',
      type: 'fluxo-caixa'
    },
    { 
      title: 'Inadimplência', 
      description: 'Relatório de parcelas vencidas e não pagas.', 
      icon: BarChart3, 
      color: 'text-red-600',
      type: 'inadimplencia'
    },
    { 
      title: 'Produção por Procedimento', 
      description: 'Volume de tratamentos realizados por tipo.', 
      icon: PieChart, 
      color: 'text-blue-600',
      type: 'procedimentos'
    },
    { 
      title: 'Crescimento de Pacientes', 
      description: 'Novos cadastros e retenção.', 
      icon: FileText, 
      color: 'text-purple-600',
      type: 'pacientes'
    },
  ];

  return (
    <div className="space-y-6">
      {/* Cabeçalho da Página */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500">Analise o desempenho financeiro da sua clínica.</p>
        </div>
      </div>

      {/* Grid de Relatórios */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-4 sm:gap-6">
        {reports.map((report, idx) => (
          <div key={idx} className="bg-white p-4 sm:p-6 rounded-xl border shadow-sm hover:shadow-md transition-shadow flex items-start gap-4">
            {/* Ícone do Relatório */}
            <div className={`p-2.5 sm:p-3 rounded-lg bg-gray-50 ${report.color} shrink-0`}>
              <report.icon size={20} className="sm:w-6 sm:h-6" />
            </div>
            {/* Informações e Ações */}
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-gray-900 text-sm sm:text-base truncate">{report.title}</h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 line-clamp-2">{report.description}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                {/* Link para visualização em tela */}
                <Link 
                  to={`/relatorios/${report.type}`}
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-blue-600 hover:underline"
                >
                  <FileText size={14} />
                  Ver em Tela
                </Link>
                {/* Botão para gerar PDF (abre a página de relatório com parâmetro de impressão) */}
                <button 
                  onClick={() => window.open(`/relatorios/${report.type}/imprimir`, '_blank')}
                  className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-bold text-gray-600 hover:underline"
                >
                  <Download size={14} />
                  Gerar PDF
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
