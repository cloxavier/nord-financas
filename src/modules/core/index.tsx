import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
  User,
  Shield,
  Building2,
  Activity,
  CircleHelp,
} from 'lucide-react';
import { Navigate } from 'react-router-dom';
import { AppModuleDefinition } from '@/src/app/extensions/contracts';

import PatientsPage from '@/src/pages/PatientsPage';
import PatientFormPage from '@/src/pages/PatientFormPage';
import PatientDetailPage from '@/src/pages/PatientDetailPage';
import ProceduresPage from '@/src/pages/ProceduresPage';
import ProcedureFormPage from '@/src/pages/ProcedureFormPage';
import ProcedureDetailPage from '@/src/pages/ProcedureDetailPage';
import TreatmentsPage from '@/src/pages/TreatmentsPage';
import TreatmentFormPage from '@/src/pages/TreatmentFormPage';
import TreatmentDetailPage from '@/src/pages/TreatmentDetailPage';
import TreatmentPrintPage from '@/src/pages/TreatmentPrintPage';
import InstallmentsPage from '@/src/pages/InstallmentsPage';
import InstallmentDetailPage from '@/src/pages/InstallmentDetailPage';
import BillingPage from '@/src/pages/BillingPage';
import ReportsPage from '@/src/pages/ReportsPage';
import ReportViewPage from '@/src/pages/ReportViewPage';
import ReportPrintPage from '@/src/pages/ReportPrintPage';
import SettingsPage from '@/src/pages/SettingsPage';
import ProfilePage from '@/src/pages/ProfilePage';
import ActivitiesPage from '@/src/pages/ActivitiesPage';
import UserAccessManagementPage from '@/src/pages/UserAccessManagementPage';
import HelpPage from '@/src/pages/HelpPage';
import ClinicSettingsPage from '@/src/pages/settings/ClinicSettingsPage';
import FinancialPixSettingsPage from '@/src/pages/settings/FinancialPixSettingsPage';
import NotificationsSettingsPage from '@/src/pages/settings/NotificationsSettingsPage';
import PermissionsSecuritySettingsPage from '@/src/pages/settings/PermissionsSecuritySettingsPage';

export const coreModule: AppModuleDefinition = {
  name: 'core',

  routes: [
    {
      path: '/',
      element: <Navigate to="/dashboard" replace />,
      protected: true,
      layout: true,
      order: 1,
    },

    {
      path: '/atividades',
      element: <ActivitiesPage />,
      protected: true,
      layout: true,
      requiredPermission: 'activities_view',
      order: 15,
    },

    {
      path: '/usuarios',
      element: <UserAccessManagementPage />,
      protected: true,
      layout: true,
      requiredPermission: 'users_manage',
      order: 18,
    },

    {
      path: '/pacientes',
      element: <PatientsPage />,
      protected: true,
      layout: true,
      requiredPermission: 'patients_view',
      order: 20,
    },
    {
      path: '/pacientes/novo',
      element: <PatientFormPage />,
      protected: true,
      layout: true,
      requiredPermission: 'patients_create',
      order: 21,
    },
    {
      path: '/pacientes/:id',
      element: <PatientDetailPage />,
      protected: true,
      layout: true,
      requiredPermission: 'patients_view',
      order: 22,
    },
    {
      path: '/pacientes/:id/editar',
      element: <PatientFormPage />,
      protected: true,
      layout: true,
      requiredPermission: 'patients_edit',
      order: 23,
    },

    {
      path: '/procedimentos',
      element: <ProceduresPage />,
      protected: true,
      layout: true,
      requiredPermission: 'procedures_view',
      order: 30,
    },
    {
      path: '/procedimentos/novo',
      element: <ProcedureFormPage />,
      protected: true,
      layout: true,
      requiredPermission: 'procedures_create',
      order: 31,
    },
    {
      path: '/procedimentos/:id',
      element: <ProcedureDetailPage />,
      protected: true,
      layout: true,
      requiredPermission: 'procedures_view',
      order: 32,
    },
    {
      path: '/procedimentos/:id/editar',
      element: <ProcedureFormPage />,
      protected: true,
      layout: true,
      requiredPermission: 'procedures_edit',
      order: 33,
    },

    {
      path: '/tratamentos',
      element: <TreatmentsPage />,
      protected: true,
      layout: true,
      requiredPermission: 'treatments_view',
      order: 40,
    },
    {
      path: '/tratamentos/novo',
      element: <TreatmentFormPage />,
      protected: true,
      layout: true,
      requiredPermission: 'treatments_create',
      order: 41,
    },
    {
      path: '/tratamentos/:id',
      element: <TreatmentDetailPage />,
      protected: true,
      layout: true,
      requiredPermission: 'treatments_view',
      order: 42,
    },
    {
      path: '/tratamentos/:id/editar',
      element: <TreatmentFormPage />,
      protected: true,
      layout: true,
      requiredPermission: 'treatments_edit',
      order: 43,
    },

    {
      path: '/parcelas',
      element: <InstallmentsPage />,
      protected: true,
      layout: true,
      requiredPermission: 'installments_view',
      order: 50,
    },
    {
      path: '/parcelas/:id',
      element: <InstallmentDetailPage />,
      protected: true,
      layout: true,
      requiredPermission: 'installments_view',
      order: 51,
    },

    {
      path: '/cobrancas',
      element: <BillingPage />,
      protected: true,
      layout: true,
      requiredPermission: 'collections_view',
      order: 60,
    },

    {
      path: '/relatorios',
      element: <ReportsPage />,
      protected: true,
      layout: true,
      requiredPermission: 'reports_view',
      order: 70,
    },
    {
      path: '/relatorios/:type',
      element: <ReportViewPage />,
      protected: true,
      layout: true,
      requiredPermission: 'reports_view',
      order: 71,
    },

    {
      path: '/configuracoes',
      element: <SettingsPage />,
      protected: true,
      layout: true,
      requiredPermission: 'settings_manage',
      order: 90,
      children: [
        {
          index: true,
          element: <Navigate to="/configuracoes/clinica" replace />,
        },
        {
          path: 'clinica',
          element: <ClinicSettingsPage />,
          requiredPermission: 'settings_manage',
        },
        {
          path: 'financeiro-pix',
          element: <FinancialPixSettingsPage />,
          requiredPermission: 'settings_manage',
        },
        {
          path: 'notificacoes',
          element: <NotificationsSettingsPage />,
          requiredPermission: 'settings_manage',
        },
        {
          path: 'permissoes-seguranca',
          element: <PermissionsSecuritySettingsPage />,
          requiredPermission: 'settings_manage',
        },
      ],
    },

    {
      path: '/perfil',
      element: <ProfilePage />,
      protected: true,
      layout: true,
      order: 100,
    },
    {
      path: '/ajuda',
      element: <HelpPage />,
      protected: true,
      layout: true,
      order: 105,
    },

    {
      path: '/tratamentos/:id/imprimir',
      element: <TreatmentPrintPage />,
      protected: true,
      requiredPermission: 'treatments_view',
      order: 200,
    },
    {
      path: '/relatorios/:type/imprimir',
      element: <ReportPrintPage />,
      protected: true,
      requiredPermission: 'reports_view',
      order: 210,
    },
  ],

  navigationItems: [
    {
      key: 'dashboard',
      label: 'Dashboard',
      path: '/dashboard',
      icon: LayoutDashboard,
      requiredPermission: 'dashboard_basic',
      order: 10,
    },
    {
      key: 'activities',
      label: 'Atividades',
      path: '/atividades',
      icon: Activity,
      requiredPermission: 'activities_view',
      order: 15,
    },
    {
      key: 'patients',
      label: 'Pacientes',
      path: '/pacientes',
      icon: Users,
      requiredPermission: 'patients_view',
      order: 20,
    },
    {
      key: 'procedures',
      label: 'Procedimentos',
      path: '/procedimentos',
      icon: Stethoscope,
      requiredPermission: 'procedures_view',
      order: 30,
    },
    {
      key: 'treatments',
      label: 'Tratamentos',
      path: '/tratamentos',
      icon: ClipboardList,
      requiredPermission: 'treatments_view',
      order: 40,
    },
    {
      key: 'installments',
      label: 'Parcelas',
      path: '/parcelas',
      icon: CreditCard,
      requiredPermission: 'installments_view',
      order: 50,
    },
    {
      key: 'billing',
      label: 'Cobranças',
      path: '/cobrancas',
      icon: Bell,
      requiredPermission: 'collections_view',
      order: 60,
    },
    {
      key: 'reports',
      label: 'Relatórios',
      path: '/relatorios',
      icon: BarChart3,
      requiredPermission: 'reports_view',
      order: 70,
    },
    {
      key: 'users',
      label: 'Usuários',
      path: '/usuarios',
      icon: Shield,
      requiredPermission: 'users_manage',
      order: 80,
    },
    {
      key: 'settings',
      label: 'Configurações',
      path: '/configuracoes',
      icon: Settings,
      requiredPermission: 'settings_manage',
      order: 90,
    },
    {
      key: 'profile',
      label: 'Perfil',
      path: '/perfil',
      icon: User,
      order: 100,
    },
    {
      key: 'help',
      label: 'Ajuda',
      path: '/ajuda',
      icon: CircleHelp,
      order: 110,
    },
  ],

  settingsSections: [
    {
      key: 'clinica',
      title: 'Dados da Clínica',
      description: 'Informações institucionais e de contato usadas no sistema.',
      path: '/configuracoes/clinica',
      icon: Building2,
      requiredPermission: 'settings_manage',
      order: 10,
    },
    {
      key: 'financeiro-pix',
      title: 'Financeiro & Pix',
      description: 'Configure os dados básicos usados em cobranças, recebimentos e Pix.',
      path: '/configuracoes/financeiro-pix',
      icon: CreditCard,
      requiredPermission: 'settings_manage',
      order: 20,
    },
    {
      key: 'notificacoes',
      title: 'Notificações',
      description: 'Configure alertas internos e a base da cobrança assistida por WhatsApp.',
      path: '/configuracoes/notificacoes',
      icon: Bell,
      requiredPermission: 'settings_manage',
      order: 30,
    },
    {
      key: 'permissoes-seguranca',
      title: 'Permissões e Segurança',
      description: 'Configure confirmações reforçadas e a base de segurança para ações sensíveis.',
      path: '/configuracoes/permissoes-seguranca',
      icon: Shield,
      requiredPermission: 'settings_manage',
      order: 40,
    },
  ],
};
