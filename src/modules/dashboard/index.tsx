import DashboardPage from './pages/DashboardPage';
import { AppModule } from '@/src/app/moduleRegistry';

export const dashboardModule: AppModule = {
  name: 'dashboard',
  routes: [
    { path: '/dashboard', element: <DashboardPage />, protected: true, layout: true },
  ],
};
