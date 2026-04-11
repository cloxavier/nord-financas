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

const PERMISSION_KEYS: PermissionKey[] = [
  'dashboard_basic',
  'dashboard_executive',
  'patients_view',
  'patients_create',
  'patients_edit',
  'treatments_view',
  'treatments_create',
  'treatments_edit',
  'installments_view',
  'payments_register',
  'payments_edit',
  'collections_view',
  'users_manage',
  'roles_manage',
  'settings_manage',
];

/**
 * Converte o valor bruto para boolean de forma segura.
 * Só aceita true real, "true" e 1 como verdadeiro.
 * Todo o resto vira false por segurança.
 */
function coercePermissionValue(value: unknown): boolean {
  if (value === true) return true;
  if (value === 'true') return true;
  if (value === 1) return true;

  return false;
}

/**
 * Garante que o permissions_json seja tratado como objeto simples
 * e normaliza cada chave para boolean real.
 */
export function normalizePermissions(input: unknown): PermissionMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const raw = input as Record<string, unknown>;
  const normalized: PermissionMap = {};

  for (const key of PERMISSION_KEYS) {
    normalized[key] = coercePermissionValue(raw[key]);
  }

  return normalized;
}

/**
 * Lê uma permissão específica.
 * Se não existir, cai para false por segurança.
 */
export function hasPermission(
  permissions: PermissionMap | null | undefined,
  key: PermissionKey
): boolean {
  return permissions?.[key] === true;
}