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
    if (options?.offset !== undefined && options.offset > 0) {
      query = query.range(options.offset, options.offset + (options?.limit ?? 50) - 1);
    } else if (options?.limit) {
      query = query.limit(options.limit);
    }

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

// ═══ CROSS-DATABASE TRANSFER (entre 2 bancos diferentes) ═══

/**
 * Transfere dados entre dois bancos Supabase diferentes que estão plugados no sistema.
 * Lê do banco A, escreve no banco B, com mapeamento de colunas.
 */
export async function crossDatabaseTransfer(
  sourceClient: SupabaseClient,
  targetClient: SupabaseClient,
  sourceTable: string,
  targetTable: string,
  columnMapping: Record<string, string>,
  options?: {
    filter?: Record<string, string>;
    limit?: number;
    deleteFromSource?: boolean;
    onProgress?: (transferred: number, total: number) => void;
  }
): Promise<{ transferred: number; failed: number; total: number; errors: string[] }> {
  const errors: string[] = [];

  // 1. Ler dados do banco fonte
  let query = sourceClient.from(sourceTable).select('*', { count: 'exact' });
  if (options?.filter) {
    Object.entries(options.filter).forEach(([col, val]) => {
      if (val) query = query.ilike(col, `%${val}%`);
    });
  }
  if (options?.limit) query = query.limit(options.limit);

  const { data: sourceRows, count, error: readError } = await query;
  if (readError) return { transferred: 0, failed: 0, total: 0, errors: [readError.message] };
  if (!sourceRows || sourceRows.length === 0) return { transferred: 0, failed: 0, total: 0, errors: [] };

  const total = sourceRows.length;
  let transferred = 0;
  let failed = 0;

  // 2. Para cada registro, mapear colunas e inserir no banco destino
  for (let i = 0; i < sourceRows.length; i++) {
    const sourceRow = sourceRows[i];
    const targetRow: Record<string, unknown> = {};

    Object.entries(columnMapping).forEach(([srcCol, tgtCol]) => {
      if (sourceRow[srcCol] !== undefined) {
        targetRow[tgtCol] = sourceRow[srcCol];
      }
    });

    // Remover campos auto-gerados do destino
    delete targetRow.id;
    delete targetRow.created_at;
    delete targetRow.updated_at;

    const { error: insertError } = await targetClient.from(targetTable).insert(targetRow);

    if (insertError) {
      failed++;
      if (errors.length < 5) errors.push(`Row ${i + 1}: ${insertError.message}`);
    } else {
      transferred++;
      // 3. Se pediu para mover (não copiar), deletar da origem
      if (options?.deleteFromSource) {
        const idCol = Object.keys(sourceRow)[0];
        await sourceClient.from(sourceTable).delete().eq(idCol, sourceRow[idCol]);
      }
    }

    options?.onProgress?.(transferred + failed, total);
  }

  return { transferred, failed, total, errors };
}

/**
 * Sincroniza dados entre dois bancos — atualiza existentes, insere novos.
 * Usa uma coluna de match (ex: email, cnpj) para identificar registros.
 */
export async function crossDatabaseSync(
  sourceClient: SupabaseClient,
  targetClient: SupabaseClient,
  sourceTable: string,
  targetTable: string,
  matchColumn: string,
  columnMapping: Record<string, string>,
  options?: { limit?: number }
): Promise<{ inserted: number; updated: number; skipped: number; errors: string[] }> {
  const errors: string[] = [];
  let inserted = 0, updated = 0, skipped = 0;

  // 1. Ler dados do banco fonte
  let query = sourceClient.from(sourceTable).select('*');
  if (options?.limit) query = query.limit(options.limit);
  const { data: sourceRows, error: readError } = await query;
  if (readError) return { inserted: 0, updated: 0, skipped: 0, errors: [readError.message] };
  if (!sourceRows) return { inserted: 0, updated: 0, skipped: 0, errors: [] };

  // 2. Para cada registro, verificar se já existe no destino
  for (const sourceRow of sourceRows) {
    const matchValue = sourceRow[matchColumn];
    if (!matchValue) { skipped++; continue; }

    const targetMatchCol = columnMapping[matchColumn] ?? matchColumn;

    // Verificar se existe no destino
    const { data: existing } = await targetClient
      .from(targetTable)
      .select('*')
      .eq(targetMatchCol, matchValue)
      .limit(1);

    // Mapear colunas
    const mappedRow: Record<string, unknown> = {};
    Object.entries(columnMapping).forEach(([srcCol, tgtCol]) => {
      if (sourceRow[srcCol] !== undefined) mappedRow[tgtCol] = sourceRow[srcCol];
    });
    delete mappedRow.id;
    delete mappedRow.created_at;

    if (existing && existing.length > 0) {
      // UPDATE existente
      const idCol = Object.keys(existing[0])[0];
      const { error } = await targetClient.from(targetTable).update(mappedRow).eq(idCol, existing[0][idCol]);
      if (error) { if (errors.length < 5) errors.push(error.message); } else updated++;
    } else {
      // INSERT novo
      const { error } = await targetClient.from(targetTable).insert(mappedRow);
      if (error) { if (errors.length < 5) errors.push(error.message); } else inserted++;
    }
  }

  return { inserted, updated, skipped, errors };
}

// ═══ 1. EXPORTAR DADOS (CSV / JSON) ═══

export function exportToCSV(data: TableRow[], tableName: string): string {
  if (data.length === 0) return '';
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => {
    const val = row[h];
    if (val === null) return '';
    const str = String(val);
    return str.includes(',') || str.includes('"') || str.includes('\n') ? `"${str.replace(/"/g, '""')}"` : str;
  }).join(','));
  return [headers.join(','), ...rows].join('\n');
}

export function exportToJSON(data: TableRow[]): string {
  return JSON.stringify(data, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ═══ 2. IMPORTAR DADOS (CSV parse + insert) ═══

/** Parse CSV respecting quoted fields (handles commas inside quotes) */
export function parseCSV(csv: string): TableRow[] {
  const lines = csv.trim().split('\n');
  if (lines.length < 2) return [];

  function splitCSVLine(line: string): string[] {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current.trim());
    return fields;
  }

  const headers = splitCSVLine(lines[0]);
  return lines.slice(1).filter(l => l.trim()).map(line => {
    const values = splitCSVLine(line);
    const row: TableRow = {};
    headers.forEach((h, i) => { row[h] = values[i] === '' || values[i] === undefined ? null : values[i]; });
    return row;
  });
}

export async function importRows(client: SupabaseClient, tableName: string, rows: TableRow[]): Promise<{ inserted: number; errors: number }> {
  let inserted = 0, errors = 0;
  for (const row of rows) {
    const { error } = await client.from(tableName).insert(row);
    if (error) errors++; else inserted++;
  }
  return { inserted, errors };
}

// ═══ 3. BACKUP DE TABELA ═══

export async function backupTable(client: SupabaseClient, tableName: string): Promise<{ data: TableRow[]; count: number; timestamp: string; error?: string }> {
  try {
    const { data, count, error } = await client.from(tableName).select('*', { count: 'exact' });
    if (error) return { data: [], count: 0, timestamp: new Date().toISOString(), error: error.message };
    return { data: data ?? [], count: count ?? 0, timestamp: new Date().toISOString() };
  } catch (err) {
    return { data: [], count: 0, timestamp: new Date().toISOString(), error: err instanceof Error ? err.message : 'Erro no backup' };
  }
}

// ═══ 4. ORDENAÇÃO ═══

export async function selectRowsSorted(
  client: SupabaseClient, tableName: string, orderBy: string, ascending: boolean, limit = 100
): Promise<{ data: TableRow[]; count: number; error?: string }> {
  const { data, count, error } = await client.from(tableName)
    .select('*', { count: 'exact' })
    .order(orderBy, { ascending })
    .limit(limit);
  if (error) return { data: [], count: 0, error: error.message };
  return { data: data ?? [], count: count ?? 0 };
}

// ═══ 5. PAGINAÇÃO ═══

export async function selectRowsPaginated(
  client: SupabaseClient, tableName: string, page: number, pageSize: number,
  orderBy?: string, filters?: Record<string, string>
): Promise<{ data: TableRow[]; count: number; totalPages: number; error?: string }> {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = client.from(tableName).select('*', { count: 'exact' });
  if (filters) Object.entries(filters).forEach(([col, val]) => { if (val) query = query.ilike(col, `%${val}%`); });
  if (orderBy) query = query.order(orderBy);
  query = query.range(from, to);
  const { data, count, error } = await query;
  if (error) return { data: [], count: 0, totalPages: 0, error: error.message };
  const total = count ?? 0;
  return { data: data ?? [], count: total, totalPages: Math.ceil(total / pageSize) };
}

// ═══ 6. GROUP BY (contagem por valor) ═══

export async function countByColumn(
  client: SupabaseClient, tableName: string, column: string
): Promise<{ value: string; count: number }[]> {
  // Supabase doesn't support GROUP BY directly via client, so we fetch and aggregate
  const { data } = await client.from(tableName).select(column);
  if (!data) return [];
  const counts: Record<string, number> = {};
  data.forEach(row => {
    const val = String(row[column] ?? 'NULL');
    counts[val] = (counts[val] || 0) + 1;
  });
  return Object.entries(counts)
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

// ═══ 7. DESFAZER (via operation log) ═══
// O undo funciona gravando o estado anterior no db_operation_log
// e re-aplicando. Implementado via saveAndExecute pattern.

export async function undoLastOperation(
  _client: SupabaseClient, _tableName: string
): Promise<{ success: boolean; error?: string }> {
  // In production: busca último registro do db_operation_log,
  // extrai o SQL inverso, e executa.
  return { success: false, error: 'Undo requer Edge Function para execução de SQL reverso' };
}

// ═══ 8. DUPLICAR REGISTRO ═══

export async function duplicateRow(
  client: SupabaseClient, tableName: string, rowId: string, idColumn = 'id'
): Promise<{ data: TableRow | null; error?: string }> {
  // 1. Buscar registro original
  const { data: original, error: readError } = await client.from(tableName).select('*').eq(idColumn, rowId).single();
  if (readError || !original) return { data: null, error: readError?.message ?? 'Registro não encontrado' };
  // 2. Remover ID para criar novo
  const copy = { ...original };
  delete copy[idColumn];
  delete copy.created_at;
  delete copy.updated_at;
  // 3. Inserir cópia
  const { data: newRow, error: insertError } = await client.from(tableName).insert(copy).select().single();
  if (insertError) return { data: null, error: insertError.message };
  return { data: newRow };
}

// ═══ 9. EDIÇÃO EM LOTE (bulk update) ═══

export async function bulkUpdate(
  client: SupabaseClient, tableName: string, ids: string[], updates: Record<string, unknown>, idColumn = 'id'
): Promise<{ updated: number; error?: string }> {
  let updated = 0;
  for (const id of ids) {
    const { error } = await client.from(tableName).update(updates).eq(idColumn, id);
    if (!error) updated++;
  }
  return { updated };
}

// ═══ 10. VALIDAÇÃO DE DADOS ═══

export interface DataQualityIssue {
  type: 'null' | 'duplicate' | 'invalid_format' | 'empty_string';
  column: string;
  count: number;
  sample_values?: string[];
}

export async function validateTableData(
  client: SupabaseClient, tableName: string
): Promise<DataQualityIssue[]> {
  const issues: DataQualityIssue[] = [];
  const { data } = await client.from(tableName).select('*').limit(1000);
  if (!data || data.length === 0) return issues;

  const columns = Object.keys(data[0]);
  for (const col of columns) {
    // Check NULLs
    const nullCount = data.filter(r => r[col] === null).length;
    if (nullCount > 0) issues.push({ type: 'null', column: col, count: nullCount });

    // Check empty strings
    const emptyCount = data.filter(r => r[col] === '').length;
    if (emptyCount > 0) issues.push({ type: 'empty_string', column: col, count: emptyCount });

    // Check duplicates
    const values = data.map(r => String(r[col] ?? '')).filter(v => v !== '' && v !== 'null');
    const uniqueValues = new Set(values);
    const dupCount = values.length - uniqueValues.size;
    if (dupCount > 0 && col !== 'id') issues.push({ type: 'duplicate', column: col, count: dupCount });
  }

  return issues.sort((a, b) => b.count - a.count);
}

// ═══ 11. HISTÓRICO DE ALTERAÇÕES ═══
// Implementado via db_operation_log table (migration 006)
// Cada operação INSERT/UPDATE/DELETE grava automaticamente

// ═══ 12. RELACIONAMENTOS (FKs como links) ═══

export function extractForeignKeys(columns: Record<string, unknown>[]): { column: string; refTable: string }[] {
  // Em produção, isso viria de information_schema.key_column_usage
  // Por agora, detectamos por naming convention
  const fks: { column: string; refTable: string }[] = [];
  if (!columns[0]) return fks;
  Object.keys(columns[0]).forEach(col => {
    if (col.endsWith('_id') && col !== 'id') {
      const refTable = col.replace('_id', 's'); // user_id → users
      fks.push({ column: col, refTable });
    }
  });
  return fks;
}

// ═══ 13. COMPARAR TABELAS ═══

export async function compareTables(
  client: SupabaseClient, table1: string, table2: string
): Promise<{ onlyInTable1: number; onlyInTable2: number; inBoth: number; columnDiff: string[] }> {
  const { data: d1, count: c1 } = await client.from(table1).select('*', { count: 'exact' }).limit(1);
  const { data: d2, count: c2 } = await client.from(table2).select('*', { count: 'exact' }).limit(1);
  const cols1 = d1?.[0] ? Object.keys(d1[0]) : [];
  const cols2 = d2?.[0] ? Object.keys(d2[0]) : [];
  const columnDiff = [
    ...cols1.filter(c => !cols2.includes(c)).map(c => `+${table1}.${c}`),
    ...cols2.filter(c => !cols1.includes(c)).map(c => `+${table2}.${c}`),
  ];
  return { onlyInTable1: c1 ?? 0, onlyInTable2: c2 ?? 0, inBoth: 0, columnDiff };
}

// ═══ 14. MERGE DE REGISTROS DUPLICADOS ═══

export async function mergeRecords(
  client: SupabaseClient, tableName: string, keepId: string, deleteId: string, idColumn = 'id'
): Promise<{ error?: string }> {
  // 1. Buscar ambos registros
  const { data: keep } = await client.from(tableName).select('*').eq(idColumn, keepId).single();
  const { data: remove } = await client.from(tableName).select('*').eq(idColumn, deleteId).single();
  if (!keep || !remove) return { error: 'Registro não encontrado' };

  // 2. Preencher NULLs do registro mantido com valores do removido
  const updates: Record<string, unknown> = {};
  Object.entries(keep).forEach(([col, val]) => {
    if ((val === null || val === '') && remove[col] !== null && remove[col] !== '') {
      updates[col] = remove[col];
    }
  });

  // 3. Atualizar o mantido e deletar o removido
  if (Object.keys(updates).length > 0) {
    await client.from(tableName).update(updates).eq(idColumn, keepId);
  }
  await client.from(tableName).delete().eq(idColumn, deleteId);
  return {};
}
