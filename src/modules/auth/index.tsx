import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RecoverPasswordPage from './pages/RecoverPasswordPage';
import { AppModule } from '@/src/app/moduleRegistry';

export const authModule: AppModule = {
  name: 'auth',
  routes: [
    { path: '/login', element: <LoginPage />, publicOnly: true },
    { path: '/cadastro', element: <RegisterPage />, publicOnly: true },
    { path: '/recuperar-senha', element: <RecoverPasswordPage />, publicOnly: true },
  ],
};
