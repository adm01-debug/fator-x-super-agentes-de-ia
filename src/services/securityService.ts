/**
 * Nexus Agents Studio — Security Service
 * API keys, security events, audit trail, guardrails, sessions, posture.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';
import { invokeTracedFunction } from '@/services/llmGatewayService';

export async function listApiKeys() {
  const { data, error } = await supabaseExternal
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
  const keyHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data: member } = await supabaseExternal
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();

  const { error } = await supabaseExternal.from('api_keys').insert({
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
  const { error } = await supabaseExternal.from('api_keys').update({ is_active: false }).eq('id', id);
  if (error) throw error;
}

export async function getSecurityEvents(_options?: { severity?: string; limit?: number }) {
  const { data, error } = await supabaseExternal
    .from('audit_log_safe')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(_options?.limit || 50);

  if (error) throw error;
  return (data ?? []).map((entry) => ({
    ...entry,
    severity: 'info',
    event_type: entry.action,
  }));
}

export async function getAuditLog(options?: { userId?: string; limit?: number }) {
  try {
    let query = supabaseExternal
      .from('audit_log_safe')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(options?.limit || 100);

    if (options?.userId) query = query.eq('user_id', options.userId);

    const { data, error } = await query;
    if (error) {
      console.warn('Audit log query failed:', error.message);
      return [];
    }
    return data ?? [];
  } catch {
    return [];
  }
}

export async function invokeGuardrailsCheck(text: string) {
  return invokeTracedFunction(
    'guardrails-engine',
    { action: 'check_full', text },
    {
      spanKind: 'guardrail',
    },
  );
}

export async function getAuthSession() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session;
}

export async function getAuthUser() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

// ──────── Guardrail Policies ────────

export async function listGuardrailPolicies() {
  const { data, error } = await supabaseExternal
    .from('guardrail_policies')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    logger.error('listGuardrailPolicies failed', { error: error.message });
    throw error;
  }
  return data ?? [];
}

export async function createGuardrailPolicy(
  name: string,
  type: string,
  workspaceId: string | null,
) {
  const { error } = await supabaseExternal
    .from('guardrail_policies')
    .insert({ name, type, workspace_id: workspaceId });
  if (error) {
    logger.error('createGuardrailPolicy failed', { error: error.message });
    throw error;
  }
}

export async function toggleGuardrailPolicy(id: string, enabled: boolean) {
  const { error } = await supabaseExternal
    .from('guardrail_policies')
    .update({ is_enabled: enabled })
    .eq('id', id);
  if (error) {
    logger.error('toggleGuardrailPolicy failed', { error: error.message });
    throw error;
  }
}

export async function deleteGuardrailPolicy(id: string) {
  const { error } = await supabaseExternal.from('guardrail_policies').delete().eq('id', id);
  if (error) {
    logger.error('deleteGuardrailPolicy failed', { error: error.message });
    throw error;
  }
}

export async function installGuardrailPreset(
  preset: { id: string; name: string; type: string; config: Record<string, unknown>; severity?: string; tags?: string[] },
  workspaceId: string | null,
) {
  const { error } = await supabaseExternal.from('guardrail_policies').insert({
    name: preset.name,
    type: preset.type as 'content_filter' | 'pii_detection' | 'prompt_injection' | 'toxicity' | 'custom',
    workspace_id: workspaceId,
    is_enabled: true,
    config: { ...preset.config, preset_id: preset.id, severity: preset.severity, tags: preset.tags },
  });
  if (error) {
    logger.error('installGuardrailPreset failed', { error: error.message, preset: preset.id });
    throw error;
  }
}

export async function testGuardrails(
  text: string,
  checks: string[] = ['pii', 'injection', 'toxicity', 'content'],
) {
  return invokeTracedFunction(
    'guardrails-engine',
    { text, checks },
    {
      spanKind: 'guardrail',
    },
  );
}

// ──────── Session Management ────────

export async function getActiveSessions() {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return [];
  return [
    {
      id: session.access_token.substring(0, 8),
      device: navigator.userAgent,
      lastActive: new Date().toISOString(),
      current: true,
    },
  ];
}

export async function signOutOtherSessions() {
  const { error } = await supabase.auth.signOut({ scope: 'others' });
  if (error) throw error;
}

// ──────── Security Posture ────────

export async function getSecurityPosture() {
  const checks: Array<{ id: string; title: string; desc: string; status: 'pass' | 'warn' }> = [];

  // TLS — only truly passes in production HTTPS
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  checks.push({
    id: 'tls',
    title: 'Criptografia em transito',
    desc: isHttps ? 'TLS ativo (HTTPS)' : 'Ambiente sem HTTPS — apenas dev',
    status: isHttps ? 'pass' : 'warn',
  });

  // API Keys — real check
  try {
    const keys = await listApiKeys();
    const active = keys.filter((k) => k.is_active === true);
    checks.push({
      id: 'api_keys',
      title: 'Gestao de API Keys',
      desc: `${active.length} chave(s) ativa(s)`,
      status: active.length > 0 ? 'pass' : 'warn',
    });
  } catch {
    checks.push({
      id: 'api_keys',
      title: 'Gestao de API Keys',
      desc: 'Tabela nao configurada',
      status: 'warn',
    });
  }

  // Guardrails — real check
  try {
    const guardrails = await listGuardrailPolicies();
    const enabled = guardrails.filter((g) => g.is_enabled === true).length;
    checks.push({
      id: 'guardrails',
      title: 'Guardrails Ativos',
      desc: `${enabled}/${guardrails.length} habilitada(s)`,
      status: enabled > 0 ? 'pass' : 'warn',
    });
  } catch {
    checks.push({
      id: 'guardrails',
      title: 'Guardrails Ativos',
      desc: 'Sem politicas',
      status: 'warn',
    });
  }

  // PII Masking — verify guardrail policy exists for PII
  try {
    const guardrails = await listGuardrailPolicies();
    const piiPolicy = guardrails.find((g) => g.type === 'pii_detection' && g.is_enabled);
    checks.push({
      id: 'pii',
      title: 'Mascaramento de PII',
      desc: piiPolicy ? 'CPF, CNPJ, email, cartao detectados' : 'Nenhuma politica de PII ativa',
      status: piiPolicy ? 'pass' : 'warn',
    });
  } catch {
    checks.push({
      id: 'pii',
      title: 'Mascaramento de PII',
      desc: 'Verificacao indisponivel',
      status: 'warn',
    });
  }

  // Anti-Jailbreak — verify guardrail policy exists for injection
  try {
    const guardrails = await listGuardrailPolicies();
    const injectionPolicy = guardrails.find(
      (g) => g.type === 'prompt_injection' && g.is_enabled,
    );
    checks.push({
      id: 'jailbreak',
      title: 'Anti-Jailbreak',
      desc: injectionPolicy
        ? 'Deteccao de prompt injection ativa'
        : 'Nenhuma politica anti-injection ativa',
      status: injectionPolicy ? 'pass' : 'warn',
    });
  } catch {
    checks.push({
      id: 'jailbreak',
      title: 'Anti-Jailbreak',
      desc: 'Verificacao indisponivel',
      status: 'warn',
    });
  }

  // Audit logging — real check
  try {
    const logs = await getAuditLog({ limit: 1 });
    checks.push({
      id: 'audit',
      title: 'Audit Logging',
      desc: logs.length > 0 ? 'Acoes registradas' : 'Sem logs',
      status: logs.length > 0 ? 'pass' : 'warn',
    });
  } catch {
    checks.push({
      id: 'audit',
      title: 'Audit Logging',
      desc: 'View nao disponivel',
      status: 'warn',
    });
  }

  return checks;
}

// ──────── Rate Limiting Stats ────────

export async function getRateLimitStats() {
  try {
    const { data, error } = await fromTable('audit_log')
      .select('action')
      .gte('created_at', new Date(Date.now() - 60000).toISOString())
      .limit(100);
    if (error) throw error;
    const eps: Record<string, { total: number; blocked: number }> = {};
    ((data ?? []) as unknown[]).forEach((row) => {
      const r = row as { endpoint?: string; blocked?: boolean };
      const ep = r.endpoint ?? 'unknown';
      if (!eps[ep]) eps[ep] = { total: 0, blocked: 0 };
      eps[ep].total++;
      if (r.blocked) eps[ep].blocked++;
    });
    return [
      {
        name: 'API Requests',
        current: Object.values(eps).reduce((s, e) => s + e.total, 0),
        max: 1000,
        unit: '/min',
      },
      { name: 'LLM Calls', current: eps['llm-gateway']?.total ?? 0, max: 200, unit: '/min' },
      { name: 'File Uploads', current: eps['rag-ingest']?.total ?? 0, max: 50, unit: '/hora' },
      {
        name: 'Blocked',
        current: Object.values(eps).reduce((s, e) => s + e.blocked, 0),
        max: 100,
        unit: '/min',
      },
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
