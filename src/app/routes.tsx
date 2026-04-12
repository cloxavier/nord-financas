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
function wrapRouteElement(route: AppRouteDefinition) {
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
 * Renderiza recursivamente rotas modulares.
 */
function renderModularRoute(
  route: AppRouteDefinition,
  parentKey = ''
): React.ReactElement {
  const routeKey = route.index
    ? `${parentKey}index`
    : `${parentKey}${route.path ?? 'route-without-path'}`;

  return (
    <Route
      key={routeKey}
      index={route.index}
      path={route.index ? undefined : route.path}
      element={wrapRouteElement(route)}
    >
      {route.children?.map((childRoute, index) =>
        renderModularRoute(childRoute, `${routeKey}-${index}-`)
      )}
    </Route>
  );
}

export default function AppRoutes() {
  const modularRoutes = getAllRoutes();

  /**
   * Rotas públicas:
   * login, cadastro, recuperação de senha.
   */
  const publicOnlyRoutes = modularRoutes.filter((route) => route.publicOnly);

  /**
   * Rotas exclusivas para usuário pendente.
   */
  const pendingApprovalOnlyRoutes = modularRoutes.filter(
    (route) => route.pendingApprovalOnly
  );

  /**
   * Rotas exclusivas para usuário bloqueado.
   */
  const blockedUserOnlyRoutes = modularRoutes.filter(
    (route) => route.blockedUserOnly
  );

  /**
   * Rotas protegidas com layout principal.
   */
  const layoutRoutes = modularRoutes.filter(
    (route) =>
      route.layout &&
      route.protected &&
      !route.publicOnly &&
      !route.pendingApprovalOnly &&
      !route.blockedUserOnly
  );

  /**
   * Rotas protegidas sem layout.
   */
  const otherProtectedRoutes = modularRoutes.filter(
    (route) =>
      route.protected &&
      !route.layout &&
      !route.publicOnly &&
      !route.pendingApprovalOnly &&
      !route.blockedUserOnly
  );

  return (
    <Routes>
      {/* Rotas públicas */}
      {publicOnlyRoutes.map((route, index) => (
        <Route
          key={`${route.path ?? 'public-route'}-${index}`}
          path={route.path}
          element={<PublicRoute>{route.element}</PublicRoute>}
        />
      ))}

      {/* Rotas exclusivas para usuário pendente */}
      {pendingApprovalOnlyRoutes.map((route, index) => (
        <Route
          key={`${route.path ?? 'pending-route'}-${index}`}
          path={route.path}
          element={
            <PendingApprovalRoute>
              {wrapRouteElement(route)}
            </PendingApprovalRoute>
          }
        />
      ))}

      {/* Rotas exclusivas para usuário bloqueado */}
      {blockedUserOnlyRoutes.map((route, index) => (
        <Route
          key={`${route.path ?? 'blocked-route'}-${index}`}
          path={route.path}
          element={
            <BlockedUserRoute>
              {wrapRouteElement(route)}
            </BlockedUserRoute>
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
          key={`${route.path ?? 'protected-route'}-${index}`}
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