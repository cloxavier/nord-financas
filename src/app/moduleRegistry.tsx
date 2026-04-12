import {
  AppModuleDefinition,
  AppNavigationItemDefinition,
  AppRouteDefinition,
  AppSettingsSectionDefinition,
  AppSlotKey,
  AppWidgetDefinition,
} from '@/src/app/extensions/contracts';

import { authModule } from '@/src/modules/auth';
import { dashboardModule } from '@/src/modules/dashboard';
import { coreModule } from '@/src/modules/core';

/**
 * Registry central dos módulos da aplicação.
 * Usamos Map para:
 * - manter a ordem de registro
 * - evitar duplicidade acidental por nome
 * - facilitar futuras extensões plugáveis
 */
const registeredModules = new Map<string, AppModuleDefinition>([
  [authModule.name, authModule],
  [dashboardModule.name, dashboardModule],
  [coreModule.name, coreModule],
]);

/**
 * Ordenação padrão por "order".
 * Mantém o código centralizado e evita repetir sort em vários pontos.
 */
function sortByOrder<T extends { order?: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

/**
 * Permite registro futuro de módulos extras sem sobrescrever
 * silenciosamente um módulo já existente.
 */
export function registerModule(module: AppModuleDefinition) {
  if (registeredModules.has(module.name)) {
    console.warn(
      `[moduleRegistry] módulo "${module.name}" já está registrado e foi ignorado para evitar duplicidade.`
    );
    return;
  }

  registeredModules.set(module.name, module);
}

/**
 * Retorna todos os módulos registrados no momento.
 */
function getAllModules(): AppModuleDefinition[] {
  return Array.from(registeredModules.values());
}

export function getAllRoutes(): AppRouteDefinition[] {
  return getAllModules().flatMap((module) => module.routes ?? []);
}

export function getAllNavigationItems(): AppNavigationItemDefinition[] {
  return sortByOrder(
    getAllModules().flatMap((module) => module.navigationItems ?? [])
  );
}

export function getAllSettingsSections(): AppSettingsSectionDefinition[] {
  return sortByOrder(
    getAllModules().flatMap((module) => module.settingsSections ?? [])
  );
}

export function getWidgetsBySlot(slot: AppSlotKey): AppWidgetDefinition[] {
  return sortByOrder(
    getAllModules()
      .flatMap((module) => module.widgets ?? [])
      .filter((widget) => widget.slot === slot)
  );
}