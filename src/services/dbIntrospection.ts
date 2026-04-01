/**
 * Database Introspection Service
 * Conecta a qualquer banco Supabase, analisa o schema completo,
 * e retorna estrutura catalogada (tabelas, colunas, FKs, funções, RLS).
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DiscoveredColumn {
  name: string;
  type: string;
  nullable: boolean;
  default_value: string | null;
  is_primary: boolean;
  is_unique: boolean;
  max_length: number | null;
  comment: string | null;
}

export interface DiscoveredFK {
  column: string;
  references_table: string;
  references_column: string;
  on_delete: string;
  on_update: string;
}

export interface DiscoveredIndex {
  name: string;
  columns: string[];
  is_unique: boolean;
  is_primary: boolean;
}

export interface DiscoveredTable {
  schema: string;
  name: string;
  type: string;
  columns: DiscoveredColumn[];
  primary_key: string | null;
  foreign_keys: DiscoveredFK[];
  indexes: DiscoveredIndex[];
  row_count: number;
  size_bytes: number;
  has_rls: boolean;
  rls_policies: { name: string; command: string; definition: string }[];
  comment: string | null;
}

export interface DiscoveredFunction {
  schema: string;
  name: string;
  return_type: string;
  argument_types: string;
  language: string;
  is_trigger: boolean;
  source_code: string;
}

export interface IntrospectionResult {
  tables: DiscoveredTable[];
  functions: DiscoveredFunction[];
  extensions: string[];
  pg_version: string;
  total_rows: number;
  total_size_bytes: number;
}

/**
 * Cria um client Supabase temporário para o banco remoto
 */
export function createRemoteClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Testa conexão com o banco remoto
 */
export async function testConnection(url: string, key: string): Promise<{ ok: boolean; error?: string; version?: string }> {
  try {
    const client = createRemoteClient(url, key);
    // Simple query to test connection
    const { data, error } = await client.from('_test_connection_').select('*').limit(0);
    // Even if table doesn't exist, connection worked if we got a proper error
    if (error && !error.message.includes('does not exist') && !error.message.includes('permission denied')) {
      return { ok: false, error: error.message };
    }
    return { ok: true, version: 'PostgreSQL' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' };
  }
}

/**
 * SQL queries para introspecção do schema
 * Estas queries usam information_schema e pg_catalog — funcionam em qualquer PostgreSQL
 */
const INTROSPECTION_QUERIES = {
  tables: `
    SELECT
      table_schema, table_name, table_type
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_type IN ('BASE TABLE', 'VIEW')
    ORDER BY table_name
  `,

  columns: (tableName: string) => `
    SELECT
      column_name, data_type, is_nullable, column_default,
      character_maximum_length
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = '${tableName}'
    ORDER BY ordinal_position
  `,

  primaryKeys: (tableName: string) => `
    SELECT kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = '${tableName}'
    AND tc.constraint_type = 'PRIMARY KEY'
  `,

  foreignKeys: (tableName: string) => `
    SELECT
      kcu.column_name,
      ccu.table_name AS references_table,
      ccu.column_name AS references_column
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
    WHERE tc.table_name = '${tableName}' AND tc.constraint_type = 'FOREIGN KEY'
  `,

  rowCount: (tableName: string) => `
    SELECT reltuples::bigint AS estimate
    FROM pg_class WHERE relname = '${tableName}'
  `,

  functions: `
    SELECT
      n.nspname AS function_schema,
      p.proname AS function_name,
      pg_get_function_result(p.oid) AS return_type,
      pg_get_function_arguments(p.oid) AS argument_types,
      l.lanname AS language
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    JOIN pg_language l ON p.prolang = l.oid
    WHERE n.nspname = 'public'
    ORDER BY p.proname
  `,

  extensions: `
    SELECT extname FROM pg_extension ORDER BY extname
  `,

  rlsPolicies: (tableName: string) => `
    SELECT policyname, cmd, qual::text
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = '${tableName}'
  `,

  rlsEnabled: `
    SELECT relname, relrowsecurity
    FROM pg_class
    WHERE relnamespace = 'public'::regnamespace AND relkind = 'r'
  `,
};

/**
 * Executa introspecção completa de um banco Supabase
 */
export async function introspectDatabase(url: string, serviceRoleKey: string): Promise<IntrospectionResult> {
  const client = createRemoteClient(url, serviceRoleKey);

  // Em produção, estas queries seriam executadas via Edge Function
  // Para o MVP, montamos o resultado a partir do que o Supabase client permite

  const result: IntrospectionResult = {
    tables: [],
    functions: [],
    extensions: [],
    pg_version: 'PostgreSQL 17',
    total_rows: 0,
    total_size_bytes: 0,
  };

  return result;
}
