import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import {
  ProtectedRoute,
  PublicRoute,
  PendingApprovalRoute,
  BlockedUserRoute,
  PermissionRoute,
} from '@/src/components/RouteGuards';
import AppLayout from '@/src/components/AppLayout';
import { AppRouteDefinition } from '@/src/app/extensions/contracts';
import { getAllRoutes } from './moduleRegistry';

/**
 * Aplica proteção por permissão automaticamente quando a rota declarar requiredPermission.
 */
function wrapRouteElement(route: AppRouteDefinition): React.ReactNode {
  if (route.requiredPermission) {
    return (
      <PermissionRoute permission={route.requiredPermission}>
        {route.element}
      </PermissionRoute>
    );
  }

  return route.element;
}

/**
 * Type guard para rotas que obrigatoriamente possuem path.
 * Isso ajuda o TypeScript a aceitar corretamente as props do Route.
 */
function hasPath(
  route: AppRouteDefinition
): route is AppRouteDefinition & { path: string } {
  return typeof route.path === 'string' && route.path.length > 0;
}

/**
 * Renderiza recursivamente rotas modulares.
 * Fazemos o branch explícito entre rota index e rota com path,
 * porque o Route do react-router usa união de tipos.
 */
function renderModularRoute(
  route: AppRouteDefinition,
  parentKey = ''
): React.ReactNode {
  const routeKey = route.index
    ? `${parentKey}index`
    : `${parentKey}${route.path ?? 'route-without-path'}`;

  const children = route.children?.map((childRoute, index) =>
    renderModularRoute(childRoute, `${routeKey}-${index}-`)
  );

  if (route.index) {
    return (
      <Route key={routeKey} index element={wrapRouteElement(route)}>
        {children}
      </Route>
    );
  }

  if (!hasPath(route)) {
    return null;
  }

  return (
    <Route key={routeKey} path={route.path} element={wrapRouteElement(route)}>
      {children}
    </Route>
  );
}

export default function AppRoutes() {
  const modularRoutes = getAllRoutes();

  /**
   * Rotas públicas:
   * login, cadastro, recuperação de senha.
   */
  const publicOnlyRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.publicOnly && hasPath(route)
  );

  /**
   * Rotas exclusivas para usuário pendente.
   */
  const pendingApprovalOnlyRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.pendingApprovalOnly && hasPath(route)
  );

  /**
   * Rotas exclusivas para usuário bloqueado.
   */
  const blockedUserOnlyRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.blockedUserOnly && hasPath(route)
  );

  /**
   * Rotas protegidas com layout principal.
   */
  const layoutRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.layout &&
      !!route.protected &&
      !route.publicOnly &&
      !route.pendingApprovalOnly &&
      !route.blockedUserOnly &&
      hasPath(route)
  );

  /**
   * Rotas protegidas sem layout.
   */
  const otherProtectedRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.protected &&
      !route.layout &&
      !route.publicOnly &&
      !route.pendingApprovalOnly &&
      !route.blockedUserOnly &&
      hasPath(route)
  );

  return (
    <Routes>
      {/* Rotas públicas */}
      {publicOnlyRoutes.map((route, index) => (
        <Route
          key={`${route.path}-${index}`}
          path={route.path}
          element={<PublicRoute>{route.element}</PublicRoute>}
        />
      ))}

      {/* Rotas exclusivas para usuário pendente */}
      {pendingApprovalOnlyRoutes.map((route, index) => (
        <Route
          key={`${route.path}-${index}`}
          path={route.path}
          element={
            <PendingApprovalRoute>{wrapRouteElement(route)}</PendingApprovalRoute>
          }
        />
      ))}

      {/* Rotas exclusivas para usuário bloqueado */}
      {blockedUserOnlyRoutes.map((route, index) => (
        <Route
          key={`${route.path}-${index}`}
          path={route.path}
          element={
            <BlockedUserRoute>{wrapRouteElement(route)}</BlockedUserRoute>
          }
        />
      ))}

      {/* Rotas protegidas que usam AppLayout */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        {layoutRoutes.map((route, index) =>
          renderModularRoute(route, `layout-${index}-`)
        )}
      </Route>

      {/* Rotas protegidas sem layout */}
      {otherProtectedRoutes.map((route, index) => (
        <Route
          key={`${route.path}-${index}`}
          path={route.path}
          element={<ProtectedRoute>{wrapRouteElement(route)}</ProtectedRoute>}
        >
          {route.children?.map((childRoute, childIndex) =>
            renderModularRoute(childRoute, `protected-${index}-${childIndex}-`)
          )}
        </Route>
      ))}

      {/* Fallback da aplicação */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}