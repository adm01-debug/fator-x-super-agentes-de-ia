/**
 * Nexus Agents Studio — Audit Log Service
 * Writes sensitive/destructive actions to the audit_log table so admins
 * can review who did what, when, and why.
 *
 * Every destructive action wrapped in <DangerousActionDialog> MUST call
 * logAudit() after successful execution (or with `status: 'failed'` on
 * error) — this is the enforcement layer for T04 RBAC granular.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { fromTable } from '@/lib/supabaseExtended';

export type AuditAction =
  | 'delete'
  | 'bulk_delete'
  | 'update'
  | 'create'
  | 'revoke'
  | 'rotate'
  | 'export'
  | 'import'
  | 'deploy'
  | 'undeploy'
  | 'promote'
  | 'role_change'
  | 'permission_grant'
  | 'permission_revoke'
  | 'credential_access'
  | 'data_erasure'
  | 'settings_change';

export type AuditStatus = 'success' | 'failed' | 'denied';

export interface AuditLogEntry {
  id?: string;
  user_id?: string;
  workspace_id?: string | null;
  action: AuditAction;
  resource_type: string;
  resource_id?: string | null;
  resource_name?: string | null;
  reason?: string | null;
  status?: AuditStatus;
  metadata?: Record<string, unknown>;
  ip_address?: string | null;
  user_agent?: string | null;
  created_at?: string;
}

export interface LogAuditInput {
  action: AuditAction;
  resource_type: string;
  resource_id?: string;
  resource_name?: string;
  reason?: string;
  status?: AuditStatus;
  metadata?: Record<string, unknown>;
}

/**
 * Writes an entry to the audit_log table. Best-effort: if the insert
 * fails we log the error client-side but do NOT throw — audit logging
 * should never block the main action from completing.
 */
export async function logAudit(input: LogAuditInput): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    let workspaceId: string | null = null;
    if (user?.id) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();
      workspaceId = (member as { workspace_id?: string } | null)?.workspace_id ?? null;
    }

    const entry: AuditLogEntry = {
      user_id: user?.id,
      workspace_id: workspaceId,
      action: input.action,
      resource_type: input.resource_type,
      resource_id: input.resource_id ?? null,
      resource_name: input.resource_name ?? null,
      reason: input.reason ?? null,
      status: input.status ?? 'success',
      metadata: input.metadata ?? {},
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    };

    const { error } = await fromTable('audit_log').insert(entry);

    if (error) {
      logger.error('audit log insert failed', {
        action: input.action,
        resource: input.resource_type,
        error: error.message,
      });
    }
  } catch (e) {
    logger.error('audit log threw', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Lists recent audit entries for the current workspace. Used by the
 * AdminPage Audit Trail tab.
 */
export async function listAuditEntries(limit = 100): Promise<AuditLogEntry[]> {
  const { data, error } = await fromTable('audit_log_safe')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('list audit entries failed', { error: error.message });
    return [];
  }
  return (data ?? []) as AuditLogEntry[];
}

/**
 * Lists audit entries filtered by action type. Used by the Audit Trail
 * tab filter dropdown.
 */
export async function listAuditEntriesByAction(
  action: AuditAction,
  limit = 100
): Promise<AuditLogEntry[]> {
  const { data, error } = await fromTable('audit_log_safe')
    .select('*')
    .eq('action', action)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('list audit entries by action failed', { error: error.message });
    return [];
  }
  return (data ?? []) as AuditLogEntry[];
}
