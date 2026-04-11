export type PermissionDomain =
  | 'dashboard'
  | 'patients'
  | 'treatments'
  | 'financial'
  | 'collections'
  | 'users'
  | 'settings';

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

export interface PermissionCatalogItem {
  key: PermissionKey;
  label: string;
  description: string;
  domain: PermissionDomain;
  order: number;
}

export const permissionCatalog: PermissionCatalogItem[] = [
  {
    key: 'dashboard_basic',
    label: 'Dashboard básico',
    description: 'Permite acessar a visão operacional básica do dashboard.',
    domain: 'dashboard',
    order: 10,
  },
  {
    key: 'dashboard_executive',
    label: 'Dashboard executivo',
    description: 'Permite acessar indicadores estratégicos e cards executivos do dashboard.',
    domain: 'dashboard',
    order: 20,
  },
  {
    key: 'patients_view',
    label: 'Ver pacientes',
    description: 'Permite visualizar a lista e os detalhes de pacientes.',
    domain: 'patients',
    order: 30,
  },
  {
    key: 'patients_create',
    label: 'Criar pacientes',
    description: 'Permite cadastrar novos pacientes.',
    domain: 'patients',
    order: 40,
  },
  {
    key: 'patients_edit',
    label: 'Editar pacientes',
    description: 'Permite alterar dados de pacientes existentes.',
    domain: 'patients',
    order: 50,
  },
  {
    key: 'treatments_view',
    label: 'Ver tratamentos',
    description: 'Permite visualizar tratamentos e seus detalhes.',
    domain: 'treatments',
    order: 60,
  },
  {
    key: 'treatments_create',
    label: 'Criar tratamentos',
    description: 'Permite cadastrar novos tratamentos.',
    domain: 'treatments',
    order: 70,
  },
  {
    key: 'treatments_edit',
    label: 'Editar tratamentos',
    description: 'Permite editar tratamentos existentes.',
    domain: 'treatments',
    order: 80,
  },
  {
    key: 'installments_view',
    label: 'Ver parcelas',
    description: 'Permite visualizar parcelas e sua situação financeira.',
    domain: 'financial',
    order: 90,
  },
  {
    key: 'payments_register',
    label: 'Registrar pagamentos',
    description: 'Permite dar baixa e registrar pagamentos.',
    domain: 'financial',
    order: 100,
  },
  {
    key: 'payments_edit',
    label: 'Editar pagamentos',
    description: 'Permite ajustar registros de pagamento.',
    domain: 'financial',
    order: 110,
  },
  {
    key: 'collections_view',
    label: 'Ver cobranças',
    description: 'Permite acessar cobranças, vencimentos e acompanhamento operacional.',
    domain: 'collections',
    order: 120,
  },
  {
    key: 'users_manage',
    label: 'Gerenciar usuários',
    description: 'Permite aprovar, bloquear e administrar acessos de usuários.',
    domain: 'users',
    order: 130,
  },
  {
    key: 'roles_manage',
    label: 'Gerenciar cargos',
    description: 'Permite criar e editar cargos e permissões.',
    domain: 'users',
    order: 140,
  },
  {
    key: 'settings_manage',
    label: 'Gerenciar configurações',
    description: 'Permite acessar e alterar configurações administrativas do sistema.',
    domain: 'settings',
    order: 150,
  },
];

export const permissionKeys: PermissionKey[] = permissionCatalog.map((item) => item.key);

export function getPermissionCatalog() {
  return permissionCatalog;
}

export function getPermissionDefinition(key: PermissionKey) {
  return permissionCatalog.find((item) => item.key === key) ?? null;
}