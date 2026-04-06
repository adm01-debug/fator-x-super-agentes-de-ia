/**
 * Helper for tables added by migrations but not yet in auto-generated types.
 * Uses type assertion scoped to this single file to keep the rest of the codebase clean.
 *
 * Known extended tables: roles, permissions, role_permissions, user_roles,
 * mcp_servers, cron_schedules, cron_schedule_executions, execution_history,
 * agent_configs, embedding_configs, ragas_scores, nlp_extractions,
 * guardrail_ml_logs, model_pricing_v2, security_events, credential_vault,
 * notifications, finetune_jobs, hf_config, prompt_ab_tests, alert_rules
 */
import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFrom = any;

/** Known extended table names for type safety at call sites */
export type ExtendedTableName =
  | 'roles' | 'permissions' | 'role_permissions' | 'user_roles' | 'agent_permissions'
  | 'mcp_servers' | 'cron_schedules' | 'cron_schedule_executions'
  | 'execution_history' | 'agent_configs'
  | 'embedding_configs' | 'ragas_scores' | 'nlp_extractions'
  | 'guardrail_ml_logs' | 'model_pricing_v2'
  | 'security_events' | 'credential_vault' | 'credential_audit_logs'
  | 'notifications' | 'notification_templates'
  | 'finetune_jobs' | 'hf_config'
  | 'prompt_ab_tests' | 'alert_rules'
  | 'task_queues' | 'queue_items' | 'dead_letter_queue'
  | 'webhook_endpoints' | 'webhook_events'
  | 'batch_jobs' | 'installed_templates'
  | 'workflow_checkpoints' | 'workflow_executions' | 'workflow_handoffs';

/**
 * Access a table that is not in the auto-generated Supabase types.
 * Returns an untyped query builder — callers should cast results.
 */
export function fromTable(name: ExtendedTableName | string): AnyFrom {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).from(name);
}

/**
 * Call an RPC function that is not in the auto-generated Supabase types.
 * Scopes the type assertion to this single file.
 */
export async function rpcCall(
  fnName: string,
  params: Record<string, unknown> = {},
): Promise<{ data: unknown; error: { message: string } | null }> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (supabase as any).rpc(fnName, params);
}
