import DashboardPage from './pages/DashboardPage';
import QuickActionsWidget from './widgets/QuickActionsWidget';
import { AppModuleDefinition } from '@/src/app/extensions/contracts';

export const dashboardModule: AppModuleDefinition = {
  name: 'dashboard',
  routes: [
    {
      path: '/dashboard',
      element: <DashboardPage />,
      protected: true,
      layout: true,
      requiredPermission: 'dashboard_basic',
      order: 10,
    },
  ],
  widgets: [
    {
      key: 'dashboard.quick-actions',
      slot: 'dashboard.panel.right',
      component: QuickActionsWidget,
      order: 10,
    },
  ],
};