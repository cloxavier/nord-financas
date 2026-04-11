import DashboardPage from './pages/DashboardPage';
import { AppModuleDefinition } from '@/src/app/extensions/contracts';

export const dashboardModule: AppModuleDefinition = {
  name: 'dashboard',
  routes: [
    {
      path: '/dashboard',
      element: <DashboardPage />,
      protected: true,
      layout: true,
      order: 10,
    },
  ],
};