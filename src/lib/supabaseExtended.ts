/**
 * Helper for tables added by migrations but not yet in auto-generated types.
 * Uses type assertion scoped to this single file to keep the rest of the codebase clean.
 * Tables here: prompt_ab_tests, alert_rules, roles, permissions, role_permissions, user_roles, mcp_servers
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyFrom = any;

/**
 * Access a table that is not in the auto-generated Supabase types.
 * Returns an untyped query builder — callers should cast results.
 */
export function fromTable(name: string): AnyFrom {
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
