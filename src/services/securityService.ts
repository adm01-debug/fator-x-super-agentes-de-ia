/**
 * Nexus Agents Studio — Security Service
 * API keys, security events, audit trail.
 */
import { supabase } from '@/integrations/supabase/client';

export async function listApiKeys() {
  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, rate_limit_tier, last_used_at, is_active, created_at')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createApiKey(name: string, scopes: string[] = ['read', 'execute']) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const rawKey = `nxs_${crypto.randomUUID().replace(/-/g, '')}`;
  const keyPrefix = rawKey.substring(0, 12);

  // Hash the key for storage
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(rawKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const { data, error } = await supabase
    .from('api_keys')
    .insert({ name, key_hash: keyHash, key_prefix: keyPrefix, scopes, created_by: user.id })
    .select()
    .single();

  if (error) throw error;

  // Return raw key ONCE (not stored in plaintext)
  return { ...data, raw_key: rawKey };
}

export async function revokeApiKey(id: string) {
  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false })
    .eq('id', id);

  if (error) throw error;
}

export async function getSecurityEvents(options?: { severity?: string; limit?: number }) {
  let query = supabase
    .from('security_events')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 50);

  if (options?.severity) query = query.eq('severity', options.severity);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function getAuditLog(options?: { userId?: string; limit?: number }) {
  let query = supabase
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(options?.limit || 100);

  if (options?.userId) query = query.eq('user_id', options.userId);

  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}
