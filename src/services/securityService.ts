/**
 * Nexus Agents Studio — Security Service
 * API keys, security events, audit trail.
 */
import { supabase } from '@/integrations/supabase/client';

export async function listApiKeys() {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, is_active, last_used_at, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createApiKey(name: string, scopes: string[] = ['read', 'execute']) {
  const rawKey = `nxs_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyPrefix = rawKey.substring(0, 12);

  // Hash the key for storage (simple sha-256 via SubtleCrypto)
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).maybeSingle();

  const { error } = await supabase.from('api_keys').insert({
    user_id: user.id,
    workspace_id: member?.workspace_id ?? null,
    name,
    key_prefix: keyPrefix,
    key_hash: keyHash,
    scopes,
  });

  if (error) throw error;
  return { raw_key: rawKey, key_prefix: keyPrefix };
}

export async function revokeApiKey(id: string) {
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

export async function getSecurityEvents(_options?: { severity?: string; limit?: number }) {
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
