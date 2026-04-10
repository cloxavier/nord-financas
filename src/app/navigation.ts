import {
  LayoutDashboard,
  Users,
  Stethoscope,
  ClipboardList,
  CreditCard,
  Bell,
  BarChart3,
  Settings,
  User,
  Shield,
  LucideIcon,
} from 'lucide-react';
import { PermissionKey } from '../lib/permissions';

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  requiredPermission?: PermissionKey;
}

export const menuItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Pacientes', path: '/pacientes' },
  { icon: Stethoscope, label: 'Procedimentos', path: '/procedimentos' },
  { icon: ClipboardList, label: 'Tratamentos', path: '/tratamentos' },
  { icon: CreditCard, label: 'Parcelas', path: '/parcelas' },
  { icon: Bell, label: 'Cobranças', path: '/cobrancas' },
  { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
  { icon: Shield, label: 'Usuários', path: '/usuarios', requiredPermission: 'users_manage' },
  { icon: Settings, label: 'Configurações', path: '/configuracoes', requiredPermission: 'settings_manage' },
  { icon: User, label: 'Perfil', path: '/perfil' },
];