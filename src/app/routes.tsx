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
import PendingApprovalPage from '@/src/modules/auth/pages/PendingApprovalPage';
import BlockedAccessPage from '@/src/modules/auth/pages/BlockedAccessPage';

/**
 * Aplica proteção por permissão automaticamente quando a rota declarar requiredPermission.
 * Isso evita repetir PermissionRoute manualmente em vários pontos do AppRoutes.
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
 * Isso permite que módulos registrem árvore de rotas, como /configuracoes + suas filhas.
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
   * Rotas protegidas com layout principal.
   */
  const layoutRoutes = modularRoutes.filter(
    (route) => route.layout && route.protected
  );

  /**
   * Rotas protegidas sem layout.
   * Exemplo: impressão.
   */
  const otherProtectedRoutes = modularRoutes.filter(
    (route) => route.protected && !route.layout
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

      {/* Rotas especiais de status de acesso.
          Nesta etapa elas continuam explícitas porque pertencem ao fluxo-base de autenticação/status. */}
      <Route
        path="/aguardando-liberacao"
        element={
          <PendingApprovalRoute>
            <PendingApprovalPage />
          </PendingApprovalRoute>
        }
      />

      <Route
        path="/acesso-bloqueado"
        element={
          <BlockedUserRoute>
            <BlockedAccessPage />
          </BlockedUserRoute>
        }
      />

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