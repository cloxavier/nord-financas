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
 */
function hasPath(
  route: AppRouteDefinition
): route is AppRouteDefinition & { path: string } {
  return typeof route.path === 'string' && route.path.length > 0;
}

/**
 * Renderiza recursivamente rotas modulares.
 * O key fica no Fragment, não no Route, para evitar erro de tipagem.
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
    <React.Fragment key={routeKey}>
      <Route index element={wrapRouteElement(route)} />
    </React.Fragment>
  );
}

  if (!hasPath(route)) {
    return null;
  }

  return (
    <React.Fragment key={routeKey}>
      <Route path={route.path} element={wrapRouteElement(route)}>
        {children}
      </Route>
    </React.Fragment>
  );
}

export default function AppRoutes() {
  const modularRoutes = getAllRoutes();

  const publicOnlyRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.publicOnly && hasPath(route)
  );

  const pendingApprovalOnlyRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.pendingApprovalOnly && hasPath(route)
  );

  const blockedUserOnlyRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.blockedUserOnly && hasPath(route)
  );

  const layoutRoutes = modularRoutes.filter(
    (route): route is AppRouteDefinition & { path: string } =>
      !!route.layout &&
      !!route.protected &&
      !route.publicOnly &&
      !route.pendingApprovalOnly &&
      !route.blockedUserOnly &&
      hasPath(route)
  );

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
      {publicOnlyRoutes.map((route, index) => (
        <React.Fragment key={`${route.path}-${index}`}>
          <Route
            path={route.path}
            element={<PublicRoute>{route.element}</PublicRoute>}
          />
        </React.Fragment>
      ))}

      {pendingApprovalOnlyRoutes.map((route, index) => (
        <React.Fragment key={`${route.path}-${index}`}>
          <Route
            path={route.path}
            element={
              <PendingApprovalRoute>{wrapRouteElement(route)}</PendingApprovalRoute>
            }
          />
        </React.Fragment>
      ))}

      {blockedUserOnlyRoutes.map((route, index) => (
        <React.Fragment key={`${route.path}-${index}`}>
          <Route
            path={route.path}
            element={
              <BlockedUserRoute>{wrapRouteElement(route)}</BlockedUserRoute>
            }
          />
        </React.Fragment>
      ))}

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

      {otherProtectedRoutes.map((route, index) => (
        <React.Fragment key={`${route.path}-${index}`}>
          <Route
            path={route.path}
            element={<ProtectedRoute>{wrapRouteElement(route)}</ProtectedRoute>}
          >
            {route.children?.map((childRoute, childIndex) =>
              renderModularRoute(childRoute, `protected-${index}-${childIndex}-`)
            )}
          </Route>
        </React.Fragment>
      ))}

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}