export type PermissionDomain =
  | 'dashboard'
  | 'patients'
  | 'procedures'
  | 'treatments'
  | 'financial'
  | 'collections'
  | 'reports'
  | 'activities'
  | 'users'
  | 'settings';

export type PermissionKey =
  | 'dashboard_basic'
  | 'dashboard_executive'
  | 'activities_view'
  | 'patients_view'
  | 'patients_create'
  | 'patients_edit'
  | 'procedures_view'
  | 'procedures_create'
  | 'procedures_edit'
  | 'treatments_view'
  | 'treatments_create'
  | 'treatments_edit'
  | 'installments_view'
  | 'payments_register'
  | 'payments_edit'
  | 'collections_view'
  | 'reports_view'
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
    key: 'activities_view',
    label: 'Ver atividades',
    description: 'Permite acessar o histórico de atividades do sistema.',
    domain: 'activities',
    order: 30,
  },
  {
    key: 'patients_view',
    label: 'Ver pacientes',
    description: 'Permite visualizar a lista e os detalhes de pacientes.',
    domain: 'patients',
    order: 40,
  },
  {
    key: 'patients_create',
    label: 'Criar pacientes',
    description: 'Permite cadastrar novos pacientes.',
    domain: 'patients',
    order: 50,
  },
  {
    key: 'patients_edit',
    label: 'Editar pacientes',
    description: 'Permite alterar dados de pacientes existentes.',
    domain: 'patients',
    order: 60,
  },
  {
    key: 'procedures_view',
    label: 'Ver procedimentos',
    description: 'Permite acessar o catálogo de procedimentos.',
    domain: 'procedures',
    order: 70,
  },
  {
    key: 'procedures_create',
    label: 'Criar procedimentos',
    description: 'Permite cadastrar novos procedimentos no catálogo.',
    domain: 'procedures',
    order: 80,
  },
  {
    key: 'procedures_edit',
    label: 'Editar procedimentos',
    description: 'Permite alterar procedimentos já cadastrados.',
    domain: 'procedures',
    order: 90,
  },
  {
    key: 'treatments_view',
    label: 'Ver tratamentos',
    description: 'Permite visualizar tratamentos e seus detalhes.',
    domain: 'treatments',
    order: 100,
  },
  {
    key: 'treatments_create',
    label: 'Criar tratamentos',
    description: 'Permite cadastrar novos tratamentos.',
    domain: 'treatments',
    order: 110,
  },
  {
    key: 'treatments_edit',
    label: 'Editar tratamentos',
    description: 'Permite editar tratamentos existentes.',
    domain: 'treatments',
    order: 120,
  },
  {
    key: 'installments_view',
    label: 'Ver parcelas',
    description: 'Permite visualizar parcelas e sua situação financeira.',
    domain: 'financial',
    order: 130,
  },
  {
    key: 'payments_register',
    label: 'Registrar pagamentos',
    description: 'Permite dar baixa e registrar pagamentos.',
    domain: 'financial',
    order: 140,
  },
  {
    key: 'payments_edit',
    label: 'Editar pagamentos',
    description: 'Permite ajustar registros de pagamento.',
    domain: 'financial',
    order: 150,
  },
  {
    key: 'collections_view',
    label: 'Ver cobranças',
    description: 'Permite acessar cobranças, vencimentos e acompanhamento operacional.',
    domain: 'collections',
    order: 160,
  },
  {
    key: 'reports_view',
    label: 'Ver relatórios',
    description: 'Permite acessar relatórios e análises da aplicação.',
    domain: 'reports',
    order: 170,
  },
  {
    key: 'users_manage',
    label: 'Gerenciar usuários',
    description: 'Permite aprovar, bloquear e administrar acessos de usuários.',
    domain: 'users',
    order: 180,
  },
  {
    key: 'roles_manage',
    label: 'Gerenciar cargos',
    description: 'Permite criar e editar cargos e permissões.',
    domain: 'users',
    order: 190,
  },
  {
    key: 'settings_manage',
    label: 'Gerenciar configurações',
    description: 'Permite acessar e alterar configurações administrativas do sistema.',
    domain: 'settings',
    order: 200,
  },
];

export const permissionKeys: PermissionKey[] = permissionCatalog.map((item) => item.key);

export function getPermissionCatalog() {
  return permissionCatalog;
}

export function getPermissionDefinition(key: PermissionKey) {
  return permissionCatalog.find((item) => item.key === key) ?? null;
}