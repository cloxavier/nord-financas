import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

function FullScreenLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
    </div>
  );
}

function getStatusRedirect(accessStatus: 'pending' | 'active' | 'blocked' | null) {
  if (accessStatus === 'blocked') return '/acesso-bloqueado';
  if (accessStatus === 'pending') return '/aguardando-liberacao';
  return '/dashboard';
}

export function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, accessStatus } = useAuth();

  if (loading) return <FullScreenLoader />;

  if (user) {
    return <Navigate to={getStatusRedirect(accessStatus)} replace />;
  }

  return <>{children}</>;
}

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, accessStatus } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessStatus === 'pending') {
    return <Navigate to="/aguardando-liberacao" replace />;
  }

  if (accessStatus === 'blocked') {
    return <Navigate to="/acesso-bloqueado" replace />;
  }

  return <>{children}</>;
}

export function PendingApprovalRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, accessStatus } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessStatus === 'blocked') {
    return <Navigate to="/acesso-bloqueado" replace />;
  }

  if (accessStatus === 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

export function BlockedUserRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, accessStatus } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessStatus === 'pending') {
    return <Navigate to="/aguardando-liberacao" replace />;
  }

  if (accessStatus === 'active') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

/**
 * Guard temporário para áreas exclusivas do Gestor.
 * A matriz fina de permissões virá depois.
 */
export function ManagerOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, accessStatus, roleSlug } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (accessStatus === 'pending') {
    return <Navigate to="/aguardando-liberacao" replace />;
  }

  if (accessStatus === 'blocked') {
    return <Navigate to="/acesso-bloqueado" replace />;
  }

  if (roleSlug !== 'gestor') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}