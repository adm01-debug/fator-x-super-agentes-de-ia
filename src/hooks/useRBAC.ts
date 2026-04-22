/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — useRBAC Hook
 * ═══════════════════════════════════════════════════════════════
 * React hook for role-based access control.
 * Loads user's permissions once and caches them.
 *
 * Usage:
 *   const { can, role, loading } = useRBAC();
 *   if (can('agents.create')) { ... }
 *   if (can(['agents.update', 'agents.delete'], 'all')) { ... }
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { useAuth } from '@/contexts/AuthContext';
import {
  getUserRole,
  getUserPermissions,
  hasPermission,
  type PermissionKey,
  type RoleKey,
} from '@/services/rbacService';

interface RBACState {
  role: RoleKey | null;
  permissions: Set<PermissionKey>;
  loading: boolean;
  error: string | null;
}

export function useRBAC() {
  const { user } = useAuth();
  const [state, setState] = useState<RBACState>({
    role: null,
    permissions: new Set(),
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!user?.id) {
      setState({ role: null, permissions: new Set(), loading: false, error: null });
      return;
    }

    let cancelled = false;

    async function loadPermissions() {
      try {
        // Get workspace ID
        const { data: membership } = await supabaseExternal
          .from('workspace_members')
          .select('workspace_id')
          .eq('user_id', user!.id)
          .limit(1)
          .maybeSingle();

        if (!membership?.workspace_id) {
          if (!cancelled) {
            setState({ role: null, permissions: new Set(), loading: false, error: null });
          }
          return;
        }

        const [userRole, permissions] = await Promise.all([
          getUserRole(user!.id, membership.workspace_id),
          getUserPermissions(user!.id, membership.workspace_id),
        ]);

        if (!cancelled) {
          setState({
            role: (userRole?.role_key as RoleKey) ?? null,
            permissions,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load permissions',
          }));
        }
      }
    }

    loadPermissions();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  /**
   * Check if user has permission(s).
   * @param required - Single permission key or array of keys
   * @param mode - 'any' (default) = at least one, 'all' = every one
   */
  const can = useCallback(
    (required: PermissionKey | PermissionKey[], mode: 'any' | 'all' = 'any'): boolean => {
      // Admins can do everything
      if (state.role === 'workspace_admin') return true;
      return hasPermission(state.permissions, required, mode);
    },
    [state.role, state.permissions],
  );

  /**
   * Check if user has a specific role or higher.
   */
  const isAtLeast = useCallback(
    (requiredRole: RoleKey): boolean => {
      const levels: Record<RoleKey, number> = {
        workspace_admin: 100,
        agent_editor: 70,
        operator: 50,
        auditor: 40,
        agent_viewer: 30,
      };
      if (!state.role) return false;
      return (levels[state.role] ?? 0) >= (levels[requiredRole] ?? 0);
    },
    [state.role],
  );

  const isAdmin = useMemo(() => state.role === 'workspace_admin', [state.role]);

  return {
    /** Check permission(s) */
    can,
    /** Check role hierarchy */
    isAtLeast,
    /** Current role key */
    role: state.role,
    /** Is workspace admin */
    isAdmin,
    /** All permissions as Set */
    permissions: state.permissions,
    /** Loading state */
    loading: state.loading,
    /** Error message */
    error: state.error,
  };
}
