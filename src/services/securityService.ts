/**
 * Nexus Agents Studio — Security Service
 * API keys, security events, audit trail.
 * Tables api_keys and security_events don't exist in the schema,
 * so we use workspace_secrets and audit_log as proxies.
 */
import { supabase } from '@/integrations/supabase/client';

export async function listApiKeys() {
  // No api_keys table — return empty
  return [] as Array<{
    id: string; name: string; key_prefix: string;
    scopes: string[]; is_active: boolean; created_at: string;
  }>;
}

export async function createApiKey(name: string, _scopes: string[] = ['read', 'execute']) {
  const rawKey = `nxs_${crypto.randomUUID().replace(/-/g, '')}`;
  // Return key to UI without persisting (no api_keys table)
  return { id: crypto.randomUUID(), name, raw_key: rawKey, key_prefix: rawKey.substring(0, 12), is_active: true, created_at: new Date().toISOString() };
}

export async function revokeApiKey(_id: string) {
  // No-op: no api_keys table
}

export async function getSecurityEvents(_options?: { severity?: string; limit?: number }) {
  // Use audit_log as proxy for security events
  const { data, error } = await supabase
    .from('audit_log_safe')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(_options?.limit || 50);

  if (error) throw error;
  return (data ?? []).map(entry => ({
    ...entry,
    severity: 'info',
    event_type: entry.action,
  }));
}

export async function getAuditLog(options?: { userId?: string; limit?: number }) {
  let query = supabase
    .from('audit_log_safe')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100);

  if (options?.userId) query = query.eq('user_id', options.userId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
