/**
 * Nexus Agents Studio — DataHub Service
 * Cross-database queries, entity browser, MCP exposure.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}

async function invokeDatahub(body: Record<string, unknown>): Promise<unknown> {
  try {
    const headers = await getAuthHeaders();
    const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/datahub-query`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!resp.ok) {
      const errorText = await resp.text().catch(() => 'Unknown error');
      logger.error('DataHub request failed', { status: resp.status, body: errorText, action: body.action || body.entity });
      throw new Error(`DataHub ${body.action || body.entity || 'request'} failed: ${resp.status} - ${errorText.substring(0, 200)}`);
    }

    return resp.json();
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('DataHub')) throw err;
    logger.error('DataHub network error', { error: err instanceof Error ? err.message : String(err) });
    throw new Error(`DataHub request failed: ${err instanceof Error ? err.message : 'Network error'}`);
  }
}

export async function queryEntity(entityType: string, filters?: Record<string, unknown>, limit = 20) {
  return invokeDatahub({ entity: entityType, filters, limit });
}

export async function getEntityDetail(entityType: string, entityId: string) {
  return invokeDatahub({ entity: entityType, id: entityId, action: 'detail' });
}

export async function getDatahubStats() {
  try {
    return await invokeDatahub({ action: 'stats' });
  } catch {
    logger.warn('DataHub stats unavailable, returning defaults');
    return { databases: 0, tables: 0, records: 0 };
  }
}

export async function testDatahubConnections() {
  return invokeDatahub({ action: 'test_connections' });
}

export async function listDatahubEntities() {
  return invokeDatahub({ action: 'list_entities' });
}

export async function listDatahubTables() {
  return invokeDatahub({ action: 'list_tables' });
}
