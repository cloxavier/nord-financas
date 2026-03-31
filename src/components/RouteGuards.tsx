/**
 * Guardas de Rota (Route Guards).
 * Este arquivo contém componentes para proteger ou restringir o acesso a determinadas rotas da aplicação.
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/**
 * Componente ProtectedRoute: Protege rotas que exigem autenticação.
 * Se o usuário não estiver logado, ele é redirecionado para a página de login.
 * @param children Os componentes que devem ser renderizados se o acesso for permitido.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth(); // Obtém o estado de autenticação do contexto
  const location = useLocation(); // Obtém a localização atual para redirecionamento posterior

  // Enquanto a autenticação está sendo verificada, exibe um spinner de carregamento
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Se não houver usuário autenticado, redireciona para o login, salvando a rota de origem
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se estiver autenticado, renderiza os componentes filhos
  return <>{children}</>;
}

/**
 * Componente PublicRoute: Restringe o acesso a rotas públicas (como Login) para usuários já logados.
 * Se o usuário já estiver logado, ele é redirecionado para o dashboard.
 * @param children Os componentes que devem ser renderizados (ex: formulário de login).
 */
export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  // Exibe spinner enquanto verifica a sessão
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Se já houver um usuário autenticado, redireciona para o dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  // Se não estiver logado, permite o acesso à página pública
  return <>{children}</>;
}
