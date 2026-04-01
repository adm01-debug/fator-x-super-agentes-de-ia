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

// ═══ FIND & REPLACE (Substituição em massa) ═══

/**
 * Busca e substitui valores em uma coluna — como Find & Replace do Excel.
 * Usa Supabase client para fazer SELECT + UPDATE em batch.
 * Retorna quantos registros foram alterados.
 */
export async function findAndReplace(
  client: SupabaseClient,
  tableName: string,
  column: string,
  searchValue: string,
  replaceValue: string,
  options?: { caseSensitive?: boolean; exactMatch?: boolean; dryRun?: boolean }
): Promise<{ matched: number; replaced: number; error?: string; preview?: TableRow[] }> {
  try {
    // 1. Encontrar registros que contêm o valor
    let query = client.from(tableName).select('*', { count: 'exact' });

    if (options?.exactMatch) {
      if (options?.caseSensitive) {
        query = query.eq(column, searchValue);
      } else {
        query = query.ilike(column, searchValue);
      }
    } else {
      if (options?.caseSensitive) {
        query = query.like(column, `%${searchValue}%`);
      } else {
        query = query.ilike(column, `%${searchValue}%`);
      }
    }

    const { data: matchedRows, count, error: findError } = await query;
    if (findError) return { matched: 0, replaced: 0, error: findError.message };

    const matched = count ?? matchedRows?.length ?? 0;

    // 2. Se dry run, retornar preview sem alterar
    if (options?.dryRun) {
      return { matched, replaced: 0, preview: (matchedRows ?? []).slice(0, 20) };
    }

    // 3. Substituir em cada registro encontrado
    if (!matchedRows || matchedRows.length === 0) {
      return { matched: 0, replaced: 0 };
    }

    let replaced = 0;
    for (const row of matchedRows) {
      const currentValue = String(row[column] ?? '');
      let newValue: string;

      if (options?.exactMatch) {
        newValue = replaceValue;
      } else if (options?.caseSensitive) {
        newValue = currentValue.split(searchValue).join(replaceValue);
      } else {
        // Case-insensitive replace
        const regex = new RegExp(searchValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        newValue = currentValue.replace(regex, replaceValue);
      }

      if (newValue !== currentValue) {
        const idCol = Object.keys(row)[0]; // Use first column as ID (usually 'id')
        const { error: updateError } = await client
          .from(tableName)
          .update({ [column]: newValue })
          .eq(idCol, row[idCol]);

        if (!updateError) replaced++;
      }
    }

    return { matched, replaced };
  } catch (err) {
    return { matched: 0, replaced: 0, error: err instanceof Error ? err.message : 'Erro na substituição' };
  }
}

/**
 * Copia dados de uma coluna para outra (como recortar/colar entre colunas no Excel).
 * Opcionalmente limpa a coluna de origem (recortar) ou mantém (copiar).
 */
export async function copyColumnData(
  client: SupabaseClient,
  tableName: string,
  sourceColumn: string,
  targetColumn: string,
  options?: { cut?: boolean; filter?: Record<string, string>; overwriteExisting?: boolean }
): Promise<{ copied: number; error?: string }> {
  try {
    // 1. Buscar registros
    let query = client.from(tableName).select('*');
    if (options?.filter) {
      Object.entries(options.filter).forEach(([col, val]) => {
        if (val) query = query.ilike(col, `%${val}%`);
      });
    }

    const { data: rows, error: findError } = await query;
    if (findError) return { copied: 0, error: findError.message };
    if (!rows || rows.length === 0) return { copied: 0 };

    // 2. Copiar valor da coluna fonte para a coluna destino
    let copied = 0;
    for (const row of rows) {
      const sourceValue = row[sourceColumn];
      const targetValue = row[targetColumn];

      // Se não quer sobrescrever existentes e o destino já tem valor, pular
      if (!options?.overwriteExisting && targetValue !== null && targetValue !== '') continue;

      const idCol = Object.keys(row)[0];
      const updates: Record<string, unknown> = { [targetColumn]: sourceValue };

      // Se é recortar (cut), limpar a coluna fonte
      if (options?.cut) updates[sourceColumn] = null;

      const { error: updateError } = await client.from(tableName).update(updates).eq(idCol, row[idCol]);
      if (!updateError) copied++;
    }

    return { copied };
  } catch (err) {
    return { copied: 0, error: err instanceof Error ? err.message : 'Erro ao copiar dados' };
  }
}

/**
 * Transfere dados de uma tabela para outra (com mapeamento de colunas).
 * Suporta copiar ou mover (mover = copiar + deletar origem).
 */
export async function transferData(
  client: SupabaseClient,
  sourceTable: string,
  targetTable: string,
  columnMapping: Record<string, string>, // { source_col: target_col }
  options?: { filter?: Record<string, string>; deleteAfterTransfer?: boolean; limit?: number }
): Promise<{ transferred: number; error?: string }> {
  try {
    // 1. Buscar registros da tabela fonte
    let query = client.from(sourceTable).select('*');
    if (options?.filter) {
      Object.entries(options.filter).forEach(([col, val]) => {
        if (val) query = query.ilike(col, `%${val}%`);
      });
    }
    if (options?.limit) query = query.limit(options.limit);

    const { data: sourceRows, error: readError } = await query;
    if (readError) return { transferred: 0, error: readError.message };
    if (!sourceRows || sourceRows.length === 0) return { transferred: 0 };

    // 2. Mapear e inserir na tabela destino
    let transferred = 0;
    for (const row of sourceRows) {
      const newRow: Record<string, unknown> = {};
      Object.entries(columnMapping).forEach(([srcCol, tgtCol]) => {
        if (row[srcCol] !== undefined) newRow[tgtCol] = row[srcCol];
      });

      const { error: insertError } = await client.from(targetTable).insert(newRow);
      if (!insertError) {
        transferred++;
        // 3. Se é mover, deletar da origem
        if (options?.deleteAfterTransfer) {
          const idCol = Object.keys(row)[0];
          await client.from(sourceTable).delete().eq(idCol, row[idCol]);
        }
      }
    }

    return { transferred };
  } catch (err) {
    return { transferred: 0, error: err instanceof Error ? err.message : 'Erro na transferência' };
  }
}

export function generateDropTableSQL(tableName: string): string {
  return `DROP TABLE IF EXISTS public.${tableName} CASCADE;`;
}

export function generateEnableRLSSQL(tableName: string): string {
  return `ALTER TABLE public.${tableName} ENABLE ROW LEVEL SECURITY;`;
}
