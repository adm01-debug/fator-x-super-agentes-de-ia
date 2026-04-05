/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — AccessControl Component
 * ═══════════════════════════════════════════════════════════════
 * Conditionally renders children based on user permissions.
 * Pattern: CopilotKit <CopilotGuard> + Dify workspace permissions
 *
 * Usage:
 *   <AccessControl permission="agents.create">
 *     <Button>Criar Agente</Button>
 *   </AccessControl>
 *
 *   <AccessControl permission={['agents.update', 'agents.delete']} mode="all" fallback={<Badge>Sem acesso</Badge>}>
 *     <DangerZone />
 *   </AccessControl>
 */

import type { ReactNode } from 'react';
import { useRBAC } from '@/hooks/useRBAC';
import type { PermissionKey } from '@/services/rbacService';

interface AccessControlProps {
  /** Required permission(s) */
  permission: PermissionKey | PermissionKey[];
  /** 'any' = at least one permission, 'all' = all permissions required */
  mode?: 'any' | 'all';
  /** Content to render when authorized */
  children: ReactNode;
  /** Content to render when NOT authorized (optional) */
  fallback?: ReactNode;
  /** If true, show a loading skeleton while permissions load */
  showLoading?: boolean;
}

export function AccessControl({
  permission,
  mode = 'any',
  children,
  fallback = null,
  showLoading = false,
}: AccessControlProps) {
  const { can, loading } = useRBAC();

  if (loading) {
    if (showLoading) {
      return (
        <div className="animate-pulse bg-[#111122] rounded-lg h-8 w-24" />
      );
    }
    return null;
  }

  if (can(permission, mode)) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}

/**
 * Hook version for programmatic checks in event handlers.
 *
 * Usage:
 *   const { guardAction } = useAccessGuard();
 *   const handleDelete = guardAction('agents.delete', async () => {
 *     await deleteAgent(id);
 *   });
 */
export function useAccessGuard() {
  const { can } = useRBAC();

  function guardAction(
    permission: PermissionKey | PermissionKey[],
    action: () => void | Promise<void>,
    onDenied?: () => void
  ) {
    return async () => {
      if (can(permission)) {
        await action();
      } else {
        onDenied?.();
      }
    };
  }

  return { guardAction, can };
}
