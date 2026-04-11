/**
 * Compatibilidade temporária:
 * as seções de configurações agora nascem do registry central de módulos.
 * Este arquivo permanece para evitar regressão enquanto a tela ainda consome a estrutura antiga.
 */
import { type LucideIcon } from 'lucide-react';
import { getAllSettingsSections } from '@/src/app/moduleRegistry';

export interface SettingsSection {
  key: string;
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
}

export const settingsSections: SettingsSection[] = getAllSettingsSections().map((section) => ({
  key: section.key,
  title: section.title,
  description: section.description,
  path: section.path,
  icon: section.icon,
}));