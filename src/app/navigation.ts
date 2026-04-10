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

export interface NavItem {
  icon: LucideIcon;
  label: string;
  path: string;
  visibleForRoleSlugs?: string[];
}

export const menuItems: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
  { icon: Users, label: 'Pacientes', path: '/pacientes' },
  { icon: Stethoscope, label: 'Procedimentos', path: '/procedimentos' },
  { icon: ClipboardList, label: 'Tratamentos', path: '/tratamentos' },
  { icon: CreditCard, label: 'Parcelas', path: '/parcelas' },
  { icon: Bell, label: 'Cobranças', path: '/cobrancas' },
  { icon: BarChart3, label: 'Relatórios', path: '/relatorios' },
  { icon: Shield, label: 'Usuários', path: '/usuarios', visibleForRoleSlugs: ['gestor'] },
  { icon: Settings, label: 'Configurações', path: '/configuracoes' },
  { icon: User, label: 'Perfil', path: '/perfil' },
];