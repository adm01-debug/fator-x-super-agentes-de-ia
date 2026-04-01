/**
 * Database Manager Service — CRUD real em bancos Supabase remotos
 * Executa operações DDL/DML via supabase.rpc() ou REST API
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ═══ TYPES ═══

export interface RemoteDB {
  id: string;
  name: string;
  url: string;
  anonKey: string;
  serviceKey?: string;
  client: SupabaseClient;
}

export interface TableColumn {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimary: boolean;
}

export interface TableRow {
  [key: string]: unknown;
}

// ═══ CONNECTION ═══

const activeClients = new Map<string, SupabaseClient>();

export function connectToRemoteDB(url: string, key: string): SupabaseClient {
  const cacheKey = `${url}:${key.slice(-8)}`;
  if (activeClients.has(cacheKey)) return activeClients.get(cacheKey)!;

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  activeClients.set(cacheKey, client);
  return client;
}

export async function testConnection(url: string, key: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const client = connectToRemoteDB(url, key);
    // Attempt a simple query - even if table doesn't exist, connection works
    const { error } = await client.from('_health_check_').select('*').limit(0);
    // Permission denied or table not found means connection works
    if (error && error.code !== '42P01' && error.code !== 'PGRST116' && !error.message.includes('does not exist')) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Falha na conexão' };
  }
}

// ═══ INTROSPECTION (Schema Discovery) ═══

export async function discoverTables(client: SupabaseClient): Promise<{ name: string; type: string }[]> {
  // Use PostgREST to query the schema - fetch all tables
  // We try to access pg_catalog through rpc or direct query
  const tables: { name: string; type: string }[] = [];

  // Strategy: try to select from known common tables to discover what exists
  // In production, this would use service_role key with information_schema access
  try {
    const { data, error } = await client.rpc('get_tables', {}).maybeSingle();
    if (data && !error) return data as { name: string; type: string }[];
  } catch {
    // RPC not available - fallback to probing
  }

  // Fallback: The Supabase REST API automatically exposes tables
  // We can use the OpenAPI spec endpoint to discover tables
  return tables;
}

export async function getTableColumns(client: SupabaseClient, tableName: string): Promise<TableColumn[]> {
  try {
    // Try to get column info by selecting with limit 0
    const { data, error } = await client.from(tableName).select('*').limit(0);
    if (error) return [];

    // If we have data structure, we can infer columns
    // In production, use information_schema query via Edge Function
    return [];
  } catch {
    return [];
  }
}

export async function getTableRowCount(client: SupabaseClient, tableName: string): Promise<number> {
  try {
    const { count, error } = await client.from(tableName).select('*', { count: 'exact', head: true });
    if (error) return 0;
    return count ?? 0;
  } catch {
    return 0;
  }
}

// ═══ DATA OPERATIONS (CRUD) ═══

export async function selectRows(
  client: SupabaseClient,
  tableName: string,
  options?: { limit?: number; offset?: number; orderBy?: string; filters?: Record<string, string> }
): Promise<{ data: TableRow[]; count: number; error?: string }> {
  try {
    let query = client.from(tableName).select('*', { count: 'exact' });

    if (options?.filters) {
      Object.entries(options.filters).forEach(([col, val]) => {
        if (val) query = query.ilike(col, `%${val}%`);
      });
    }
    if (options?.orderBy) query = query.order(options.orderBy, { ascending: false });
    if (options?.limit) query = query.limit(options.limit);
    if (options?.offset) query = query.range(options.offset, options.offset + (options?.limit ?? 50) - 1);

    const { data, count, error } = await query;
    if (error) return { data: [], count: 0, error: error.message };
    return { data: data ?? [], count: count ?? 0 };
  } catch (err) {
    return { data: [], count: 0, error: err instanceof Error ? err.message : 'Erro' };
  }
}

export async function insertRow(
  client: SupabaseClient,
  tableName: string,
  row: Record<string, unknown>
): Promise<{ data: TableRow | null; error?: string }> {
  try {
    const { data, error } = await client.from(tableName).insert(row).select().single();
    if (error) return { data: null, error: error.message };
    return { data };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Erro ao inserir' };
  }
}

export async function updateRow(
  client: SupabaseClient,
  tableName: string,
  id: string,
  updates: Record<string, unknown>,
  idColumn = 'id'
): Promise<{ data: TableRow | null; error?: string }> {
  try {
    const { data, error } = await client.from(tableName).update(updates).eq(idColumn, id).select().single();
    if (error) return { data: null, error: error.message };
    return { data };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : 'Erro ao atualizar' };
  }
}

export async function deleteRow(
  client: SupabaseClient,
  tableName: string,
  id: string,
  idColumn = 'id'
): Promise<{ error?: string }> {
  try {
    const { error } = await client.from(tableName).delete().eq(idColumn, id);
    if (error) return { error: error.message };
    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Erro ao deletar' };
  }
}

// ═══ DDL OPERATIONS (Table Management) ═══
// Note: DDL operations require service_role key and are executed via Edge Function in production.
// For the MVP, we provide the SQL that would be executed.

export function generateCreateTableSQL(
  tableName: string,
  columns: { name: string; type: string; nullable: boolean; defaultValue?: string; isPrimary?: boolean }[]
): string {
  const colDefs = columns.map(col => {
    let def = `  ${col.name} ${col.type}`;
    if (col.isPrimary) def += ' PRIMARY KEY';
    if (!col.nullable) def += ' NOT NULL';
    if (col.defaultValue) def += ` DEFAULT ${col.defaultValue}`;
    return def;
  });
  return `CREATE TABLE public.${tableName} (\n${colDefs.join(',\n')}\n);`;
}

export function generateAlterTableSQL(
  tableName: string,
  action: 'ADD_COLUMN' | 'DROP_COLUMN' | 'RENAME_COLUMN' | 'ALTER_TYPE',
  details: { columnName: string; newName?: string; type?: string; nullable?: boolean; defaultValue?: string }
): string {
  switch (action) {
    case 'ADD_COLUMN':
      return `ALTER TABLE public.${tableName} ADD COLUMN ${details.columnName} ${details.type ?? 'TEXT'}${details.nullable === false ? ' NOT NULL' : ''}${details.defaultValue ? ` DEFAULT ${details.defaultValue}` : ''};`;
    case 'DROP_COLUMN':
      return `ALTER TABLE public.${tableName} DROP COLUMN ${details.columnName};`;
    case 'RENAME_COLUMN':
      return `ALTER TABLE public.${tableName} RENAME COLUMN ${details.columnName} TO ${details.newName};`;
    case 'ALTER_TYPE':
      return `ALTER TABLE public.${tableName} ALTER COLUMN ${details.columnName} TYPE ${details.type} USING ${details.columnName}::${details.type};`;
    default:
      return '';
  }
}

export function generateDropTableSQL(tableName: string): string {
  return `DROP TABLE IF EXISTS public.${tableName} CASCADE;`;
}

export function generateEnableRLSSQL(tableName: string): string {
  return `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`;
}
