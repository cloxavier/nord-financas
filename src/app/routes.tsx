import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  ProtectedRoute,
  PublicRoute,
  PendingApprovalRoute,
  BlockedUserRoute,
  PermissionRoute,
} from '@/src/components/RouteGuards';
import AppLayout from '@/src/components/AppLayout';
import { getAllRoutes } from './moduleRegistry';

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
import ReportPrintPage from '@/src/pages/ReportPrintPage';
import InstallmentsPage from '@/src/pages/InstallmentsPage';
import InstallmentDetailPage from '@/src/pages/InstallmentDetailPage';
import BillingPage from '@/src/pages/BillingPage';
import ReportsPage from '@/src/pages/ReportsPage';
import ReportViewPage from '@/src/pages/ReportViewPage';
import SettingsPage from '@/src/pages/SettingsPage';
import ProfilePage from '@/src/pages/ProfilePage';
import ActivitiesPage from '@/src/pages/ActivitiesPage';
import UserAccessManagementPage from '@/src/pages/UserAccessManagementPage';
import ClinicSettingsPage from '@/src/pages/settings/ClinicSettingsPage';
import FinancialPixSettingsPage from '@/src/pages/settings/FinancialPixSettingsPage';
import NotificationsSettingsPage from '@/src/pages/settings/NotificationsSettingsPage';
import PermissionsSecuritySettingsPage from '@/src/pages/settings/PermissionsSecuritySettingsPage';
import PendingApprovalPage from '@/src/modules/auth/pages/PendingApprovalPage';
import BlockedAccessPage from '@/src/modules/auth/pages/BlockedAccessPage';

export default function AppRoutes() {
  const modularRoutes = getAllRoutes();
  const layoutRoutes = modularRoutes.filter((r) => r.layout && r.protected);
  const publicOnlyRoutes = modularRoutes.filter((r) => r.publicOnly);
  const otherProtectedRoutes = modularRoutes.filter((r) => r.protected && !r.layout);

  return (
    <Routes>
      {/* Rotas Públicas */}
      {publicOnlyRoutes.map((route) => (
        <React.Fragment key={route.path}>
          <Route
            path={route.path}
            element={<PublicRoute>{route.element}</PublicRoute>}
          />
        </React.Fragment>
      ))}

      {/* Rotas especiais por status de acesso - sem AppLayout */}
      <Route
        path="/aguardando-liberacao"
        element={
          <PendingApprovalRoute>
            <PendingApprovalPage />
          </PendingApprovalRoute>
        }
      />

      <Route
        path="/acesso-bloqueado"
        element={
          <BlockedUserRoute>
            <BlockedAccessPage />
          </BlockedUserRoute>
        }
      />

      {/* Rotas protegidas com layout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {layoutRoutes.map((route) => (
          <React.Fragment key={route.path}>
            <Route path={route.path} element={route.element} />
          </React.Fragment>
        ))}

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/atividades" element={<ActivitiesPage />} />
        <Route
          path="/usuarios"
          element={
            <PermissionRoute permission="users_manage">
              <UserAccessManagementPage />
            </PermissionRoute>
          }
        />

        <Route path="/pacientes" element={<PatientsPage />} />
        <Route path="/pacientes/novo" element={<PatientFormPage />} />
        <Route path="/pacientes/:id" element={<PatientDetailPage />} />
        <Route path="/pacientes/:id/editar" element={<PatientFormPage />} />

        <Route path="/procedimentos" element={<ProceduresPage />} />
        <Route path="/procedimentos/novo" element={<ProcedureFormPage />} />
        <Route path="/procedimentos/:id" element={<ProcedureDetailPage />} />
        <Route path="/procedimentos/:id/editar" element={<ProcedureFormPage />} />

        <Route path="/tratamentos" element={<TreatmentsPage />} />
        <Route path="/tratamentos/novo" element={<TreatmentFormPage />} />
        <Route path="/tratamentos/:id" element={<TreatmentDetailPage />} />
        <Route path="/tratamentos/:id/editar" element={<TreatmentFormPage />} />

        <Route path="/parcelas" element={<InstallmentsPage />} />
        <Route path="/parcelas/:id" element={<InstallmentDetailPage />} />

        <Route path="/cobrancas" element={<BillingPage />} />

        <Route path="/relatorios" element={<ReportsPage />} />
        <Route path="/relatorios/:type" element={<ReportViewPage />} />

        <Route
          path="/configuracoes"
          element={
            <PermissionRoute permission="settings_manage">
              <SettingsPage />
            </PermissionRoute>
          }
        >
          <Route index element={<Navigate to="/configuracoes/clinica" replace />} />
          <Route path="clinica" element={<ClinicSettingsPage />} />
          <Route path="financeiro-pix" element={<FinancialPixSettingsPage />} />
          <Route path="notificacoes" element={<NotificationsSettingsPage />} />
          <Route
            path="permissoes-seguranca"
            element={<PermissionsSecuritySettingsPage />}
          />
        </Route>

        <Route path="/perfil" element={<ProfilePage />} />
      </Route>

      {/* Outras rotas protegidas sem layout */}
      {otherProtectedRoutes.map((route) => (
        <React.Fragment key={route.path}>
          <Route
            path={route.path}
            element={<ProtectedRoute>{route.element}</ProtectedRoute>}
          />
        </React.Fragment>
      ))}

      <Route
        path="/tratamentos/:id/imprimir"
        element={
          <ProtectedRoute>
            <TreatmentPrintPage />
          </ProtectedRoute>
        }
      />

      <Route
        path="/relatorios/:type/imprimir"
        element={
          <ProtectedRoute>
            <ReportPrintPage />
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}