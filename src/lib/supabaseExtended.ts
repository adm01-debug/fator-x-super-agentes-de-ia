/**
 * Helper for tables added by migrations but not yet in auto-generated types.
 * Uses type assertion scoped to this single file to keep the rest of the codebase clean.
 *
 * Tables here: prompt_ab_tests, alert_rules, roles, permissions, role_permissions,
 * user_roles, mcp_servers, workflow_executions, workflow_checkpoints,
 * workflow_handoffs, agent_configs
 *
 * NOTE: When Supabase CLI regenerates types, move these tables out of this file.
 */
import { supabase } from '@/integrations/supabase/client';

/**
 * Untyped query builder for tables not in auto-generated types.
 * This is the ONLY place in the codebase where `as any` is used for Supabase access.
 */
interface UntypedQueryBuilder {
  select: (columns?: string, options?: Record<string, unknown>) => UntypedQueryBuilder;
  insert: (data: Record<string, unknown> | Record<string, unknown>[]) => UntypedQueryBuilder;
  update: (data: Record<string, unknown>) => UntypedQueryBuilder;
  delete: () => UntypedQueryBuilder;
  eq: (column: string, value: unknown) => UntypedQueryBuilder;
  neq: (column: string, value: unknown) => UntypedQueryBuilder;
  in: (column: string, values: unknown[]) => UntypedQueryBuilder;
  gte: (column: string, value: unknown) => UntypedQueryBuilder;
  lte: (column: string, value: unknown) => UntypedQueryBuilder;
  order: (column: string, options?: Record<string, unknown>) => UntypedQueryBuilder;
  limit: (count: number) => UntypedQueryBuilder;
  single: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }>;
  then: (onfulfilled?: (value: { data: Record<string, unknown>[] | null; error: { message: string } | null }) => unknown) => Promise<unknown>;
}

/**
 * Access a table that is not in the auto-generated Supabase types.
 * Returns a query builder scoped to this file's type assertion.
 */
export function fromTable(name: string): UntypedQueryBuilder {
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
