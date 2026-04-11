import { LucideIcon } from 'lucide-react';
import { PermissionKey } from '../lib/permissions';
import { getAllNavigationItems } from './moduleRegistry';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  requiredPermission?: PermissionKey;
}

export const menuItems: NavItem[] = getAllNavigationItems().map((item) => ({
  icon: item.icon,
  label: item.label,
  path: item.path,
  requiredPermission: item.requiredPermission,
}));