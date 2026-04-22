/**
 * Hook para checagens programáticas de permissão em event handlers.
 *
 * Usage:
 *   const { guardAction } = useAccessGuard();
 *   const handleDelete = guardAction('agents.delete', async () => {
 *     await deleteAgent(id);
 *   });
 */
import { useRBAC } from '@/hooks/useRBAC';
import type { PermissionKey } from '@/services/rbacService';

export function useAccessGuard() {
  const { can } = useRBAC();

  function guardAction(
    permission: PermissionKey | PermissionKey[],
    action: () => void | Promise<void>,
    onDenied?: () => void,
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
