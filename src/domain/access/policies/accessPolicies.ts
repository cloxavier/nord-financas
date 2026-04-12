import { PermissionKey, PermissionMap, hasPermission } from '@/src/lib/permissions';

export function canAccessByPermission(
  permissions: PermissionMap | null | undefined,
  requiredPermission?: PermissionKey
): boolean {
  if (!requiredPermission) {
    return true;
  }

  return hasPermission(permissions, requiredPermission);
}

export function canSeeExecutiveDashboard(
  permissions: PermissionMap | null | undefined
): boolean {
  return hasPermission(permissions, 'dashboard_executive');
}

export function canSeeCollections(
  permissions: PermissionMap | null | undefined
): boolean {
  return hasPermission(permissions, 'collections_view');
}

export function canManageUsers(
  permissions: PermissionMap | null | undefined
): boolean {
  return hasPermission(permissions, 'users_manage');
}

export function canManageSettings(
  permissions: PermissionMap | null | undefined
): boolean {
  return hasPermission(permissions, 'settings_manage');
}

export function filterItemsByPermission<T extends { requiredPermission?: PermissionKey }>(
  items: T[],
  permissions: PermissionMap | null | undefined
): T[] {
  return items.filter((item) => canAccessByPermission(permissions, item.requiredPermission));
}