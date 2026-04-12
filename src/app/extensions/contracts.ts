import { ReactNode, ComponentType } from 'react';
import { LucideIcon } from 'lucide-react';
import { PermissionKey } from '@/src/lib/permissions';

export type AppSlotKey =
  | 'dashboard.cards.primary'
  | 'dashboard.cards.secondary'
  | 'dashboard.panel.left'
  | 'dashboard.panel.right'
  | 'settings.sections'
  | 'patient.detail.panels'
  | 'activities.detail.resolvers';

export interface AppRouteDefinition {
  /**
   * Caminho da rota.
   * - Em rotas de primeiro nível, use caminho absoluto: "/pacientes"
   * - Em rotas filhas, use caminho relativo: "clinica"
   */
  path?: string;

  /**
   * Quando true, representa uma rota index filha.
   */
  index?: boolean;

  /**
   * Elemento React da rota.
   */
  element: ReactNode;

  /**
   * Rota protegida padrão da aplicação.
   */
  protected?: boolean;

  /**
   * Rota exclusiva para usuários não autenticados.
   */
  publicOnly?: boolean;

  /**
   * Rota exclusiva para usuário autenticado com status pendente.
   */
  pendingApprovalOnly?: boolean;

  /**
   * Rota exclusiva para usuário autenticado com status bloqueado.
   */
  blockedUserOnly?: boolean;

  /**
   * Indica se a rota deve ser renderizada dentro do AppLayout.
   */
  layout?: boolean;

  /**
   * Permissão exigida para acessar a rota.
   */
  requiredPermission?: PermissionKey;

  /**
   * Ordem opcional para organização futura.
   */
  order?: number;

  /**
   * Permite registrar subrotas diretamente no módulo.
   */
  children?: AppRouteDefinition[];
}

export interface AppNavigationItemDefinition {
  key: string;
  label: string;
  path: string;
  icon: LucideIcon;
  requiredPermission?: PermissionKey;
  order?: number;
}

export interface AppWidgetDefinition<TProps = Record<string, never>> {
  key: string;
  slot: AppSlotKey;
  component: ComponentType<TProps>;
  requiredPermission?: PermissionKey;
  order?: number;
}

export interface AppSettingsSectionDefinition {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  requiredPermission?: PermissionKey;
  order?: number;
}

export interface AppModuleDefinition {
  name: string;
  routes?: AppRouteDefinition[];
  navigationItems?: AppNavigationItemDefinition[];
  widgets?: AppWidgetDefinition[];
  settingsSections?: AppSettingsSectionDefinition[];
}