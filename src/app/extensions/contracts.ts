import { ReactNode } from 'react';
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
  path: string;
  element: ReactNode;
  protected?: boolean;
  publicOnly?: boolean;
  layout?: boolean;
  requiredPermission?: PermissionKey;
  order?: number;
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
  component: React.ComponentType<TProps>;
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