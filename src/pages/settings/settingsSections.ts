/**
 * Configuração central das seções da área de Configurações.
 * Mantém rótulos, ícones e rotas em um único lugar para facilitar manutenção futura.
 */
import { Bell, Building2, CreditCard, Shield, type LucideIcon } from 'lucide-react';

export interface SettingsSection {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const settingsSections: SettingsSection[] = [
  {
    key: 'clinica',
    title: 'Dados da Clínica',
    description: 'Informações institucionais e de contato usadas no sistema.',
    path: '/configuracoes/clinica',
    icon: Building2,
  },
  {
    key: 'financeiro-pix',
    title: 'Financeiro & Pix',
    description: 'Base estrutural criada para a próxima fase de dados financeiros e recebimentos.',
    path: '/configuracoes/financeiro-pix',
    icon: CreditCard,
  },
  {
    key: 'notificacoes',
    title: 'Notificações',
    description: 'Base estrutural para alertas internos e cobrança assistida por WhatsApp.',
    path: '/configuracoes/notificacoes',
    icon: Bell,
  },
  {
    key: 'permissoes-seguranca',
    title: 'Permissões e Segurança',
    description: 'Área preparada para regras de acesso e ações sensíveis, sem termos técnicos para o usuário.',
    path: '/configuracoes/permissoes-seguranca',
    icon: Shield,
  },
];