/**
 * Camada utilitária de permissões.
 * Centraliza leitura segura do permissions_json vindo do cargo.
 */

export type PermissionKey =
  | 'dashboard_basic'
  | 'dashboard_executive'
  | 'patients_view'
  | 'patients_create'
  | 'patients_edit'
  | 'treatments_view'
  | 'treatments_create'
  | 'treatments_edit'
  | 'installments_view'
  | 'payments_register'
  | 'payments_edit'
  | 'collections_view'
  | 'users_manage'
  | 'roles_manage'
  | 'settings_manage';

export type PermissionMap = Partial<Record<PermissionKey, boolean>>;

/**
 * Garante que o permissions_json seja tratado como objeto simples.
 */
export function normalizePermissions(input: unknown): PermissionMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  return input as PermissionMap;
}

/**
 * Lê uma permissão específica.
 * Se não existir, cai para false por segurança.
 */
export function hasPermission(
  permissions: PermissionMap | null | undefined,
  key: PermissionKey
): boolean {
  return Boolean(permissions?.[key]);
}