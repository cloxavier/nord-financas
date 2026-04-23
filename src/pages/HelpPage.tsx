import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  CircleHelp,
  ClipboardList,
  CreditCard,
  FileText,
  LayoutDashboard,
  MessageSquareWarning,
  Settings,
  Shield,
  Smartphone,
  Users,
  Wallet,
  Bell,
  Stethoscope,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getAllNavigationItems } from '@/src/app/moduleRegistry';
import { filterItemsByPermission } from '@/src/domain/access/policies/accessPolicies';

type HelpShortcut = {
  title: string;
  description: string;
  path: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
};

function HelpSection({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white rounded-xl border shadow-sm p-5 md:p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-500 mt-1 leading-6">{description}</p>
      </div>
      {children}
    </section>
  );
}

export default function HelpPage() {
  const { roleName, permissions } = useAuth();

  const visibleNavigationItems = useMemo(() => {
    return filterItemsByPermission(getAllNavigationItems(), permissions);
  }, [permissions]);

  const visiblePaths = new Set(visibleNavigationItems.map((item) => item.path));

  const shortcuts: HelpShortcut[] = [
    {
      title: 'Dashboard',
      description: 'Visão geral da operação, indicadores principais e atalhos para as áreas do sistema.',
      path: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'Pacientes',
      description: 'Cadastro, busca, visualização de pacientes e acompanhamento do status ativo.',
      path: '/pacientes',
      icon: Users,
    },
    {
      title: 'Tratamentos',
      description: 'Orçamentos, aprovação, andamento, impressão e acompanhamento financeiro do tratamento.',
      path: '/tratamentos',
      icon: ClipboardList,
    },
    {
      title: 'Parcelas',
      description: 'Consulta, baixa, acompanhamento de vencimentos e visão detalhada das parcelas.',
      path: '/parcelas',
      icon: CreditCard,
    },
    {
      title: 'Cobranças',
      description: 'Fila operacional para acompanhar atrasos, próximos vencimentos e lembretes.',
      path: '/cobrancas',
      icon: Bell,
    },
    {
      title: 'Relatórios',
      description: 'Relatórios operacionais e executivos, de acordo com o escopo financeiro do cargo.',
      path: '/relatorios',
      icon: FileText,
    },
    {
      title: 'Procedimentos',
      description: 'Catálogo de procedimentos usados em tratamentos e produção.',
      path: '/procedimentos',
      icon: Stethoscope,
    },
    {
      title: 'Configurações',
      description: 'Dados da clínica, Pix, notificações e preferências de segurança.',
      path: '/configuracoes',
      icon: Settings,
    },
  ].filter((shortcut) => visiblePaths.has(shortcut.path));

  const visibleLabels = visibleNavigationItems.map((item) => item.label).join(', ');

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl p-6 md:p-8 text-white shadow-lg shadow-blue-100">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
            <BookOpen size={24} />
          </div>

          <div className="min-w-0">
            <h1 className="text-2xl font-bold">Ajuda do Nord Finanças</h1>
            <p className="text-sm md:text-base text-blue-50 mt-2 leading-7 max-w-3xl">
              Use esta página para entender os recursos principais do sistema, a lógica de navegação,
              as diferenças entre perfis e alguns atalhos importantes do uso diário.
            </p>
            <div className="mt-4 flex flex-wrap gap-2 text-xs md:text-sm">
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">
                Cargo atual: {roleName || 'Sem cargo definido'}
              </span>
              <span className="px-3 py-1 rounded-full bg-white/15 border border-white/20">
                Áreas visíveis para você: {visibleLabels || 'Nenhuma área disponível'}
              </span>
            </div>
          </div>
        </div>
      </div>

      <HelpSection
        title="Atalhos rápidos"
        description="Estas entradas levam direto para as áreas que estão liberadas para o seu perfil."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {shortcuts.map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Link
                key={shortcut.path}
                to={shortcut.path}
                className="rounded-xl border p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-3">
                  <Icon size={18} />
                </div>
                <h3 className="font-semibold text-gray-900">{shortcut.title}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-6">{shortcut.description}</p>
              </Link>
            );
          })}
        </div>
      </HelpSection>

      <HelpSection
        title="Como navegar no sistema"
        description="Resumo rápido da lógica principal de uso do Nord Finanças."
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <LayoutDashboard size={16} className="text-blue-600" />
              Dashboard
            </div>
            <p className="leading-6">
              O dashboard concentra visão rápida do mês, atividades recentes, alertas de cobrança e,
              para quem tem permissão, uma visão executiva mais financeira.
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Users size={16} className="text-blue-600" />
              Pacientes
            </div>
            <p className="leading-6">
              A lista de pacientes permite busca, paginação, identificação dos pacientes ativos e acesso
              ao detalhe individual para histórico e ações relacionadas.
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <ClipboardList size={16} className="text-blue-600" />
              Tratamentos
            </div>
            <p className="leading-6">
              Use tratamentos para criar orçamento, aprovar, acompanhar execução, gerar parcelas,
              imprimir e controlar o ciclo financeiro do atendimento.
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Wallet size={16} className="text-blue-600" />
              Parcelas, cobranças e relatórios
            </div>
            <p className="leading-6">
              Parcelas e cobranças atendem o fluxo operacional do financeiro. Relatórios ajudam a analisar
              recebido, atraso, produção, crescimento e visão executiva, conforme o cargo.
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        title="Perfis, cargos e visibilidade"
        description="O que você vê no sistema depende das permissões do seu cargo e do escopo financeiro associado a ele."
      >
        <div className="rounded-xl border p-4 bg-gray-50/70 text-sm text-gray-600 leading-7">
          <p>
            O menu lateral, as rotas disponíveis, os relatórios financeiros e até alguns valores exibidos
            mudam conforme o cargo. Isso ajuda a manter cada pessoa vendo apenas o que faz sentido no seu trabalho.
          </p>
          <p className="mt-3">
            Se uma área não aparece para você, normalmente isso significa que o seu cargo atual não tem
            aquela permissão liberada.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Shield size={16} className="text-violet-600" />
              Permissões por tela e ação
            </div>
            <p className="leading-6">
              Algumas pessoas podem ver pacientes e tratamentos, mas não parcelas, cobranças ou relatórios.
              Outras podem operar o financeiro, mas sem acesso administrativo completo.
            </p>
          </div>

          <div className="rounded-xl border p-4 space-y-2">
            <div className="flex items-center gap-2 text-gray-900 font-semibold">
              <Wallet size={16} className="text-violet-600" />
              Escopo financeiro
            </div>
            <p className="leading-6">
              O escopo financeiro define se o usuário pode ver números operacionais, visão financeira mais
              ampla ou resumo executivo do negócio.
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        title="Ações sensíveis e confirmações reforçadas"
        description="Algumas operações podem alterar dados críticos da clínica e, por isso, exigem mais cuidado."
      >
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 leading-7 flex gap-3">
          <MessageSquareWarning size={18} className="mt-1 shrink-0" />
          <div>
            <p className="font-semibold">Essas ações podem exibir confirmação reforçada:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Excluir paciente</li>
              <li>Excluir tratamento permanentemente</li>
              <li>Editar pagamento já recebido</li>
              <li>Apagar registro financeiro</li>
            </ul>
          </div>
        </div>
        <p className="text-sm text-gray-600 leading-7">
          Essas confirmações são controladas em <strong>Configurações → Permissões e Segurança</strong> e existem
          para reduzir erros em operações que podem afetar rastreabilidade, recebimentos e histórico da clínica.
        </p>
      </HelpSection>

      <HelpSection
        title="Atalho experimental no mobile"
        description="Recurso adicional para facilitar o uso em celular, sem substituir o menu tradicional."
      >
        <div className="rounded-xl border p-4 bg-blue-50/60 flex gap-3 text-sm text-blue-900 leading-7">
          <Smartphone size={18} className="mt-1 shrink-0" />
          <div>
            <p className="font-semibold">Como funciona</p>
            <p className="mt-1">
              No topo mobile, o <strong>nome “Nord Finanças”</strong> leva para o dashboard com um toque simples.
              Já o <strong>ícone N</strong> aceita um <strong>pressionar e segurar</strong> como atalho experimental
              para abrir ou fechar o menu.
            </p>
            <p className="mt-3">
              O botão de menu tradicional continua disponível normalmente. Esse atalho existe como opção extra
              de uso, principalmente para quem quiser testar uma navegação mais confortável no mobile.
            </p>
          </div>
        </div>
      </HelpSection>

      <HelpSection
        title="Dúvidas frequentes"
        description="Respostas rápidas para situações comuns do dia a dia."
      >
        <div className="space-y-3">
          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">Não estou vendo uma área no menu. O sistema está com erro?</h3>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              Na maioria dos casos, não. Isso normalmente significa que o seu cargo atual não tem permissão para
              aquela tela ou ação.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">Por que alguns valores financeiros não aparecem para mim?</h3>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              O sistema respeita o escopo financeiro do cargo. Dependendo do perfil, a pessoa pode operar o fluxo
              sem ver todos os números estratégicos da clínica.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">Como encontro rapidamente um item específico?</h3>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              Use a busca e os filtros das listagens. Parcelas, cobranças, pacientes e tratamentos já contam com
              paginação e filtros server-side para melhorar velocidade e clareza.
            </p>
          </div>

          <div className="rounded-xl border p-4">
            <h3 className="font-semibold text-gray-900">Quando usar Relatórios e quando usar Dashboard?</h3>
            <p className="text-sm text-gray-600 mt-2 leading-6">
              O dashboard serve para visão rápida e operacional. Os relatórios servem para análise de período,
              comparação, impressão e leitura mais gerencial.
            </p>
          </div>
        </div>
      </HelpSection>

      <div className="rounded-xl border bg-white p-5 md:p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <CircleHelp size={18} className="text-blue-600 mt-0.5 shrink-0" />
          <p className="text-sm text-gray-600 leading-7">
            Esta página é a primeira versão da ajuda do software. Conforme o Nord Finanças evoluir, novos recursos,
            atalhos e orientações podem ser acrescentados aqui.
          </p>
        </div>
      </div>
    </div>
  );
}
