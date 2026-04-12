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
   * Exemplo: dentro de /configuracoes, redirecionar automaticamente para /configuracoes/clinica
   */
  index?: boolean;

  /**
   * Elemento React da rota.
   */
  element: ReactNode;

  /**
   * Indica se a rota exige autenticação.
   */
  protected?: boolean;

  /**
   * Indica se a rota deve existir apenas para usuários não autenticados.
   * Exemplo: login, cadastro, recuperar senha.
   */
  publicOnly?: boolean;

  /**
   * Indica se a rota deve ser renderizada dentro do AppLayout.
   */
  layout?: boolean;

  /**
   * Permissão exigida para acessar a rota.
   * Quando presente, o AppRoutes fará o wrap automático com PermissionRoute.
   */
  requiredPermission?: PermissionKey;

  /**
   * Ordem opcional para organização futura.
   */
  order?: number;

  /**
   * Permite registrar subrotas diretamente no módulo.
   * Isso é importante para áreas como Configurações, que possuem árvore própria.
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