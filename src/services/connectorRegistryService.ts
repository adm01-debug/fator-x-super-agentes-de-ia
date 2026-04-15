/**
 * Nexus Agents Studio — Connector Registry Service
 */

import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

export type {
  ConnectorCategory, ConnectorStatus, ConnectorAuthType,
  ConnectorOperation, ConnectorDefinition, ConnectorInstance, ConnectorHealth,
} from './types/connectorRegistryTypes';

import type {
  ConnectorCategory, ConnectorStatus, ConnectorAuthType,
  ConnectorDefinition, ConnectorInstance, ConnectorHealth,
} from './types/connectorRegistryTypes';

/* ── Registry CRUD ── */

export async function listConnectors(filters?: { category?: ConnectorCategory; status?: ConnectorStatus; auth_type?: ConnectorAuthType; search?: string; has_webhooks?: boolean }): Promise<ConnectorDefinition[]> {
  let query = fromTable('connector_registry').select('*').order('name', { ascending: true });
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.auth_type) query = query.eq('auth_type', filters.auth_type);
  if (filters?.has_webhooks) query = query.eq('supports_webhooks', true);
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ConnectorDefinition[];
}

export async function getConnector(id: string): Promise<ConnectorDefinition | null> {
  const { data, error } = await fromTable('connector_registry').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as ConnectorDefinition | null;
}

export async function getConnectorBySlug(slug: string): Promise<ConnectorDefinition | null> {
  const { data, error } = await fromTable('connector_registry').select('*').eq('slug', slug).maybeSingle();
  if (error) throw error;
  return data as ConnectorDefinition | null;
}

/* ── Instance Management ── */

export async function connectService(connectorId: string, name: string, credentialId?: string, config?: Record<string, unknown>): Promise<ConnectorInstance> {
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await fromTable('connector_instances').insert({ connector_id: connectorId, name, credential_id: credentialId ?? null, config: config ?? {}, status: 'connected', created_by: userData?.user?.id ?? null }).select().single();
  if (error) throw error;
  return data as ConnectorInstance;
}

export async function disconnectService(instanceId: string): Promise<void> {
  const { error } = await fromTable('connector_instances').delete().eq('id', instanceId);
  if (error) throw error;
}

export async function listInstances(connectorId?: string): Promise<ConnectorInstance[]> {
  let query = fromTable('connector_instances').select('*').order('created_at', { ascending: false });
  if (connectorId) query = query.eq('connector_id', connectorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as ConnectorInstance[];
}

export async function updateInstanceStatus(instanceId: string, status: ConnectorStatus, healthResult?: Record<string, unknown>): Promise<void> {
  const { error } = await fromTable('connector_instances').update({ status, last_health_check: new Date().toISOString(), health_check_result: healthResult ?? null, updated_at: new Date().toISOString() }).eq('id', instanceId);
  if (error) throw error;
}

export async function recordUsage(instanceId: string): Promise<void> {
  const { data: existing } = await fromTable('connector_instances').select('usage_count').eq('id', instanceId).single();
  await fromTable('connector_instances').update({ usage_count: (existing?.usage_count ?? 0) + 1, last_used_at: new Date().toISOString() }).eq('id', instanceId);
}

/* ── Health Checks ── */

export async function checkAllHealth(): Promise<ConnectorHealth[]> {
  const instances = await listInstances();
  const results: ConnectorHealth[] = [];
  for (const instance of instances) {
    const connector = await getConnector(instance.connector_id);
    if (!connector) continue;
    const health: ConnectorHealth = { connector_id: connector.id, name: `${connector.name} (${instance.name})`, status: 'unknown', response_time_ms: null, last_check: new Date().toISOString(), error: null, uptime_pct: 100 };
    if (connector.health_check_endpoint) {
      const start = Date.now();
      try { const resp = await fetch(connector.base_url + connector.health_check_endpoint, { method: 'GET', signal: AbortSignal.timeout(5000) }); health.response_time_ms = Date.now() - start; health.status = resp.ok ? 'healthy' : 'degraded'; }
      catch (e) { health.response_time_ms = Date.now() - start; health.status = 'down'; health.error = e instanceof Error ? e.message : String(e); }
    } else { health.status = instance.status === 'connected' ? 'healthy' : 'unknown'; }
    await updateInstanceStatus(instance.id, health.status === 'healthy' ? 'connected' : 'error', { response_time_ms: health.response_time_ms, status: health.status });
    results.push(health);
  }
  return results;
}

/* ── Presets & Stats ── */

export { BUILTIN_CONNECTORS } from './presets/connectorPresets';

export async function getConnectorStats(): Promise<{ total_connectors: number; connected: number; available: number; error_count: number; total_usage: number }> {
  const connectors = await listConnectors();
  const instances = await listInstances();
  return {
    total_connectors: connectors.length,
    connected: instances.filter((i) => i.status === 'connected').length,
    available: connectors.filter((c) => c.status === 'available').length,
    error_count: instances.filter((i) => i.status === 'error').length,
    total_usage: instances.reduce((s, i) => s + i.usage_count, 0),
  };
}
