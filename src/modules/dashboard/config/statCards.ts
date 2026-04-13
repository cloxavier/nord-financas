import { type ComponentType } from 'react';
import { Users, ClipboardList, TrendingUp, AlertCircle } from 'lucide-react';
import { PermissionKey } from '@/src/lib/permissions';

export interface DashboardStatCardDefinition {
  key: string;
  label: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  color: string;
  to: string;
  helperText: string;
  requiredPermission?: PermissionKey;
}

export const dashboardStatCardDefinitions: DashboardStatCardDefinition[] = [
  {
    key: 'patients.total',
    label: 'Total de Pacientes',
    icon: Users,
    color: 'bg-blue-500',
    to: '/pacientes',
    helperText: 'Ver lista de pacientes',
  },
  {
    key: 'treatments.active',
    label: 'Tratamentos Ativos',
    icon: ClipboardList,
    color: 'bg-green-500',
    to: '/tratamentos',
    helperText: 'Ver lista de tratamentos',
  },
  {
    key: 'revenue.month',
    label: 'Recebido no Mês',
    icon: TrendingUp,
    color: 'bg-purple-500',
    to: '/parcelas',
    helperText: 'Ver parcelas e recebimentos',
    requiredPermission: 'dashboard_executive',
  },
  {
    key: 'collections.overdue',
    label: 'Parcelas em Atraso',
    icon: AlertCircle,
    color: 'bg-red-500',
    to: '/cobrancas',
    helperText: 'Ver cobranças pendentes',
    requiredPermission: 'dashboard_executive',
  },
];