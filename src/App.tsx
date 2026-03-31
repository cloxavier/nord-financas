/**
 * Componente principal da aplicação (App).
 * Este arquivo define a estrutura de roteamento e os provedores de contexto globais.
 */

import { BrowserRouter as Router } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import AppRoutes from './app/routes';

/**
 * Função App: Define a árvore de componentes principal.
 * Envolve a aplicação com o AuthProvider para gerenciar o estado de autenticação.
 * Utiliza o react-router-dom para gerenciar a navegação entre as páginas.
 */
export default function App() {
  return (
    // Provedor de contexto de autenticação para disponibilizar o estado do usuário em toda a aplicação
    <AuthProvider>
      {/* Gerenciador de roteamento do navegador */}
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
