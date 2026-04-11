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

const modules: AppModuleDefinition[] = [
  authModule,
  dashboardModule,
  coreModule,
];

export function registerModule(module: AppModuleDefinition) {
  modules.push(module);
}

export function getModules() {
  return modules;
}

export function getAllRoutes(): AppRouteDefinition[] {
  return modules.flatMap((module) => module.routes ?? []);
}

export function getAllNavigationItems(): AppNavigationItemDefinition[] {
  return modules
    .flatMap((module) => module.navigationItems ?? [])
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function getAllSettingsSections(): AppSettingsSectionDefinition[] {
  return modules
    .flatMap((module) => module.settingsSections ?? [])
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}

export function getWidgetsBySlot(slot: AppSlotKey): AppWidgetDefinition[] {
  return modules
    .flatMap((module) => module.widgets ?? [])
    .filter((widget) => widget.slot === slot)
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}