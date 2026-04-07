/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — ProtectedRoute Component
 * ═══════════════════════════════════════════════════════════════
 * Route-level guard that redirects unauthorized users.
 * Pattern: n8n enterprise route protection
 *
 * Usage in App.tsx:
 *   <Route path="/settings" element={
 *     <ProtectedRoute permission="settings.read">
 *       <SettingsPage />
 *     </ProtectedRoute>
 *   } />
 */

import { type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useRBAC } from '@/hooks/useRBAC';
import { useAuth } from '@/contexts/AuthContext';
import type { PermissionKey, RoleKey } from '@/services/rbacService';

interface ProtectedRouteProps {
  children: ReactNode;
  /** Required permission(s) — checked via RBAC */
  permission?: PermissionKey | PermissionKey[];
  /** Required minimum role level */
  minRole?: RoleKey;
  /** Redirect path when unauthorized (default: /agents) */
  redirectTo?: string;
  /** 'any' or 'all' for multiple permissions */
  mode?: 'any' | 'all';
}

export function ProtectedRoute({
  children,
  permission,
  minRole,
  redirectTo = '/agents',
  mode = 'any',
}: ProtectedRouteProps) {
  const { user, loading: authLoading } = useAuth();
  const { can, isAtLeast, loading: rbacLoading } = useRBAC();

  // Still loading auth or RBAC
  if (authLoading || rbacLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080816]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-[#4D96FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">Verificando permissões...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Check permission
  if (permission && !can(permission, mode)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#080816]">
        <div className="text-center max-w-md p-8">
          <div className="text-5xl mb-4">🔒</div>
          <h2 className="text-xl font-bold text-foreground mb-2">Acesso Restrito</h2>
          <p className="text-muted-foreground mb-6">
            Você não tem permissão para acessar esta página.
            Entre em contato com o administrador do workspace.
          </p>
          <a
            href={redirectTo}
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-foreground rounded-lg hover:bg-[#3a7de0] transition-colors"
          >
            Voltar para Agentes
          </a>
        </div>
      </div>
    );
  }

  // Check role level
  if (minRole && !isAtLeast(minRole)) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
