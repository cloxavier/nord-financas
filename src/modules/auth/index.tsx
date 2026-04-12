import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RecoverPasswordPage from './pages/RecoverPasswordPage';
import PendingApprovalPage from './pages/PendingApprovalPage';
import BlockedAccessPage from './pages/BlockedAccessPage';
import { AppModuleDefinition } from '@/src/app/extensions/contracts';

export const authModule: AppModuleDefinition = {
  name: 'auth',
  routes: [
    /**
     * Rotas públicas do fluxo de autenticação.
     */
    { path: '/login', element: <LoginPage />, publicOnly: true, order: 10 },
    { path: '/cadastro', element: <RegisterPage />, publicOnly: true, order: 20 },
    { path: '/recuperar-senha', element: <RecoverPasswordPage />, publicOnly: true, order: 30 },

    /**
     * Rotas especiais por status de acesso.
     * Agora também passam a nascer do módulo auth,
     * reduzindo o conhecimento manual dentro do AppRoutes.
     */
    {
      path: '/aguardando-liberacao',
      element: <PendingApprovalPage />,
      pendingApprovalOnly: true,
      order: 40,
    },
    {
      path: '/acesso-bloqueado',
      element: <BlockedAccessPage />,
      blockedUserOnly: true,
      order: 50,
    },
  ],
};