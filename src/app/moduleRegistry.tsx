import { ReactNode } from 'react';

export interface AppRoute {
  path: string;
  element: ReactNode;
  protected?: boolean;
  publicOnly?: boolean;
  layout?: boolean;
}

export interface AppModule {
  name: string;
  routes: AppRoute[];
}

import { authModule } from '@/src/modules/auth';
import { dashboardModule } from '@/src/modules/dashboard';

const modules: AppModule[] = [
  authModule,
  dashboardModule,
];

export function registerModule(module: AppModule) {
  modules.push(module);
}

export function getModules() {
  return modules;
}

export function getAllRoutes() {
  return modules.flatMap(m => m.routes);
}
