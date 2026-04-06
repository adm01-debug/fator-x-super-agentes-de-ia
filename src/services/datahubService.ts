/**
 * Nexus Agents Studio — DataHub Service
 * Cross-database queries, entity browser, MCP exposure.
 */
import { supabase } from '@/integrations/supabase/client';

export async function queryEntity(entityType: string, filters?: Record<string, unknown>, limit = 20) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ entity: entityType, filters, limit }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`DataHub query failed (${resp.status}): ${errBody || resp.statusText}`);
  }
  return resp.json();
}

export async function getEntityDetail(entityType: string, entityId: string) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ entity: entityType, id: entityId, action: 'detail' }),
  });

  if (!resp.ok) {
    const errBody = await resp.text().catch(() => '');
    throw new Error(`Entity detail failed (${resp.status}): ${errBody || resp.statusText}`);
  }
  return resp.json();
}

export async function getDatahubStats() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action: 'stats' }),
  });

  if (!resp.ok) return { databases: 0, tables: 0, records: 0 };
  return resp.json();
}

export async function testDatahubConnections() {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'test_connections' },
  });
  if (error) throw error;
  return data;
}

export async function listDatahubEntities() {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'list_entities' },
  });
  if (error) throw error;
  return data;
}

export async function listDatahubTables() {
  const { data, error } = await supabase.functions.invoke('datahub-query', {
    body: { action: 'list_tables' },
  });
  if (error) throw error;
  return data;
}
