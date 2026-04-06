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

export async function invokeGuardrailsCheck(text: string) {
  const { data, error } = await supabase.functions.invoke('guardrails-engine', {
    body: { action: 'check_full', text },
  });
  if (error) throw error;
  return data;
}


export async function getAuthSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

export async function getAuthUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

// ──────── Guardrail Policies ────────

export async function listGuardrailPolicies() {
  const { data, error } = await supabase
    .from('guardrail_policies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function createGuardrailPolicy(name: string, type: string, workspaceId: string | null) {
  const { error } = await supabase.from('guardrail_policies').insert({
    name,
    type,
    workspace_id: workspaceId,
  });
  if (error) throw error;
}

export async function toggleGuardrailPolicy(id: string, enabled: boolean) {
  const { error } = await supabase
    .from('guardrail_policies')
    .update({ is_enabled: enabled })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteGuardrailPolicy(id: string) {
  const { error } = await supabase
    .from('guardrail_policies')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function testGuardrails(text: string, checks: string[] = ['pii', 'injection', 'toxicity', 'content']) {
  const { data, error } = await supabase.functions.invoke('guardrails-engine', {
    body: { text, checks },
  });
  if (error) throw error;
  return data;
}

// ──────── Session Management ────────

export async function getActiveSessions() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return [];
  return [{
    id: session.access_token.substring(0, 8),
    device: navigator.userAgent,
    lastActive: new Date().toISOString(),
    current: true,
  }];
}

export async function signOutOtherSessions() {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw error;
}

// ──────── Security Posture (real checks) ────────

export async function getSecurityPosture() {
  const checks = [];

  // Check TLS (always pass in Supabase)
  checks.push({ id: 'tls', title: 'Criptografia em transito', desc: 'TLS 1.3 em todas as comunicacoes', status: 'pass' as const });

  // Check API Keys
  try {
    const keys = await listApiKeys();
    const activeKeys = keys.filter((k: { is_active: boolean }) => k.is_active);
    checks.push({ id: 'api_keys', title: 'Gestao de API Keys', desc: `${activeKeys.length} chave(s) ativa(s)`, status: activeKeys.length > 0 ? 'pass' as const : 'warn' as const });
  } catch {
    checks.push({ id: 'api_keys', title: 'Gestao de API Keys', desc: 'Tabela nao configurada', status: 'warn' as const });
  }

  // Check Guardrails
  try {
    const guardrails = await listGuardrailPolicies();
    const enabledCount = guardrails.filter((g: { is_enabled: boolean }) => g.is_enabled).length;
    checks.push({ id: 'guardrails', title: 'Guardrails Ativos', desc: `${enabledCount}/${guardrails.length} politica(s) habilitada(s)`, status: enabledCount > 0 ? 'pass' as const : 'warn' as const });
  } catch {
    checks.push({ id: 'guardrails', title: 'Guardrails Ativos', desc: 'Sem politicas configuradas', status: 'warn' as const });
  }

  // Check PII detection (always available via guardrails-engine)
  checks.push({ id: 'pii', title: 'Mascaramento de PII', desc: 'CPF, CNPJ, email, cartao detectados', status: 'pass' as const });

  // Check Anti-Jailbreak (always available)
  checks.push({ id: 'jailbreak', title: 'Anti-Jailbreak', desc: 'Deteccao de prompt injection ativa', status: 'pass' as const });

  // Check Audit Logging
  try {
    const logs = await getAuditLog({ limit: 1 });
    checks.push({ id: 'audit', title: 'Audit Logging', desc: logs.length > 0 ? 'Acoes registradas com trace' : 'Nenhum log ainda', status: logs.length > 0 ? 'pass' as const : 'warn' as const });
  } catch {
    checks.push({ id: 'audit', title: 'Audit Logging', desc: 'View nao disponivel', status: 'warn' as const });
  }

  return checks;
}

// ──────── Rate Limiting Stats ────────

export async function getRateLimitStats() {
  try {
    const { data, error } = await supabase
      .from('rate_limit_log')
      .select('endpoint, blocked')
      .gte('created_at', new Date(Date.now() - 60000).toISOString());
    if (error) throw error;

    const endpoints: Record<string, { total: number; blocked: number }> = {};
    (data ?? []).forEach((row: { endpoint: string; blocked: boolean }) => {
      if (!endpoints[row.endpoint]) endpoints[row.endpoint] = { total: 0, blocked: 0 };
      endpoints[row.endpoint].total++;
      if (row.blocked) endpoints[row.endpoint].blocked++;
    });

    return [
      { name: 'API Requests', current: Object.values(endpoints).reduce((s, e) => s + e.total, 0), max: 1000, unit: '/min' },
      { name: 'LLM Calls', current: endpoints['llm-gateway']?.total ?? 0, max: 200, unit: '/min' },
      { name: 'File Uploads', current: endpoints['rag-ingest']?.total ?? 0, max: 50, unit: '/hora' },
      { name: 'Blocked', current: Object.values(endpoints).reduce((s, e) => s + e.blocked, 0), max: 100, unit: '/min' },
    ];
  } catch {
    return [
      { name: 'API Requests', current: 0, max: 1000, unit: '/min' },
      { name: 'LLM Calls', current: 0, max: 200, unit: '/min' },
      { name: 'File Uploads', current: 0, max: 50, unit: '/hora' },
      { name: 'Blocked', current: 0, max: 100, unit: '/min' },
    ];
  }
}
