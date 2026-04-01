/**
 * Identity Resolution Engine — Cross-database entity matching
 * Resolves "who is who" across multiple Supabase databases using:
 * - Email exact match
 * - CNPJ raiz (first 8 digits) match
 * - Phone normalization match
 * - Fuzzy name matching
 */
import { type SupabaseClient } from '@supabase/supabase-js';
import { connectToRemoteDB } from './dbManager';
import { normalizeCnpj, cnpjRaiz, normalizePhone, normalizeEmail } from '@/lib/normalize';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface IdentityMatch {
  entityType: string;
  sourceDb: string;
  sourceTable: string;
  sourceId: string;
  targetDb: string;
  targetTable: string;
  targetId: string;
  matchMethod: 'email' | 'cnpj_raiz' | 'phone' | 'fuzzy_name';
  matchValue: string;
  confidence: number;
}

export interface ResolutionResult {
  resolved: IdentityMatch[];
  pending: IdentityMatch[];
  irreconcilable: number;
  totalCompared: number;
  executionTimeMs: number;
}

export interface DatabaseConnection {
  name: string;
  url: string;
  key: string;
}

// ═══ CROSS-DATABASE MATCHING ═══

/**
 * Run identity resolution between two connected databases.
 * Fetches records from both, normalizes keys, and matches.
 */
export async function resolveIdentities(
  sourceDb: DatabaseConnection,
  targetDb: DatabaseConnection,
  options: {
    sourceTable: string;
    targetTable: string;
    matchColumns: {
      email?: { source: string; target: string };
      cnpj?: { source: string; target: string };
      phone?: { source: string; target: string };
      name?: { source: string; target: string };
    };
    limit?: number;
    onProgress?: (message: string) => void;
  }
): Promise<ResolutionResult> {
  const startTime = Date.now();
  const resolved: IdentityMatch[] = [];
  const pending: IdentityMatch[] = [];
  let irreconcilable = 0;
  const limit = options.limit ?? 500;

  const srcClient = connectToRemoteDB(sourceDb.url, sourceDb.key);
  const tgtClient = connectToRemoteDB(targetDb.url, targetDb.key);

  options.onProgress?.(`Carregando ${limit} registros de ${sourceDb.name}.${options.sourceTable}...`);

  // Fetch source records
  const srcColumns = Object.values(options.matchColumns)
    .filter(Boolean)
    .map(c => c!.source)
    .join(', ') + ', id';

  const { data: sourceRows, error: srcError } = await srcClient
    .from(options.sourceTable)
    .select('*')
    .limit(limit);

  if (srcError || !sourceRows) {
    logger.error(`Failed to fetch source: ${srcError?.message}`, srcError, 'identityResolution');
    return { resolved: [], pending: [], irreconcilable: 0, totalCompared: 0, executionTimeMs: Date.now() - startTime };
  }

  options.onProgress?.(`Carregando registros de ${targetDb.name}.${options.targetTable}...`);

  const { data: targetRows, error: tgtError } = await tgtClient
    .from(options.targetTable)
    .select('*')
    .limit(limit * 2); // Fetch more targets for better matching

  if (tgtError || !targetRows) {
    logger.error(`Failed to fetch target: ${tgtError?.message}`, tgtError, 'identityResolution');
    return { resolved: [], pending: [], irreconcilable: 0, totalCompared: sourceRows.length, executionTimeMs: Date.now() - startTime };
  }

  options.onProgress?.(`Comparando ${sourceRows.length} × ${targetRows.length} registros...`);

  // Build target indexes for fast lookup
  const targetByEmail = new Map<string, typeof targetRows[0][]>();
  const targetByCnpj = new Map<string, typeof targetRows[0][]>();
  const targetByPhone = new Map<string, typeof targetRows[0][]>();

  for (const row of targetRows) {
    if (options.matchColumns.email) {
      const email = normalizeEmail(String(row[options.matchColumns.email.target] ?? ''));
      if (email) {
        if (!targetByEmail.has(email)) targetByEmail.set(email, []);
        targetByEmail.get(email)!.push(row);
      }
    }
    if (options.matchColumns.cnpj) {
      const cnpj = cnpjRaiz(String(row[options.matchColumns.cnpj.target] ?? ''));
      if (cnpj && cnpj.length >= 8) {
        if (!targetByCnpj.has(cnpj)) targetByCnpj.set(cnpj, []);
        targetByCnpj.get(cnpj)!.push(row);
      }
    }
    if (options.matchColumns.phone) {
      const phone = normalizePhone(String(row[options.matchColumns.phone.target] ?? ''));
      if (phone && phone.length >= 10) {
        if (!targetByPhone.has(phone)) targetByPhone.set(phone, []);
        targetByPhone.get(phone)!.push(row);
      }
    }
  }

  // Match each source record
  for (const srcRow of sourceRows) {
    const srcId = String(srcRow.id ?? srcRow[Object.keys(srcRow)[0]]);
    let matched = false;

    // 1. Email match (highest confidence)
    if (options.matchColumns.email) {
      const email = normalizeEmail(String(srcRow[options.matchColumns.email.source] ?? ''));
      if (email && targetByEmail.has(email)) {
        const matches = targetByEmail.get(email)!;
        for (const tgt of matches) {
          resolved.push({
            entityType: options.sourceTable,
            sourceDb: sourceDb.name,
            sourceTable: options.sourceTable,
            sourceId: srcId,
            targetDb: targetDb.name,
            targetTable: options.targetTable,
            targetId: String(tgt.id ?? tgt[Object.keys(tgt)[0]]),
            matchMethod: 'email',
            matchValue: email,
            confidence: 98,
          });
          matched = true;
        }
      }
    }

    // 2. CNPJ raiz match (high confidence)
    if (!matched && options.matchColumns.cnpj) {
      const cnpj = cnpjRaiz(String(srcRow[options.matchColumns.cnpj.source] ?? ''));
      if (cnpj && cnpj.length >= 8 && targetByCnpj.has(cnpj)) {
        const matches = targetByCnpj.get(cnpj)!;
        for (const tgt of matches) {
          resolved.push({
            entityType: options.sourceTable,
            sourceDb: sourceDb.name,
            sourceTable: options.sourceTable,
            sourceId: srcId,
            targetDb: targetDb.name,
            targetTable: options.targetTable,
            targetId: String(tgt.id ?? tgt[Object.keys(tgt)[0]]),
            matchMethod: 'cnpj_raiz',
            matchValue: cnpj,
            confidence: 95,
          });
          matched = true;
        }
      }
    }

    // 3. Phone match (medium confidence)
    if (!matched && options.matchColumns.phone) {
      const phone = normalizePhone(String(srcRow[options.matchColumns.phone.source] ?? ''));
      if (phone && phone.length >= 10 && targetByPhone.has(phone)) {
        const matches = targetByPhone.get(phone)!;
        for (const tgt of matches) {
          pending.push({
            entityType: options.sourceTable,
            sourceDb: sourceDb.name,
            sourceTable: options.sourceTable,
            sourceId: srcId,
            targetDb: targetDb.name,
            targetTable: options.targetTable,
            targetId: String(tgt.id ?? tgt[Object.keys(tgt)[0]]),
            matchMethod: 'phone',
            matchValue: phone,
            confidence: 75,
          });
          matched = true;
        }
      }
    }

    if (!matched) irreconcilable++;
  }

  const executionTimeMs = Date.now() - startTime;
  logger.info(`Identity resolution: ${resolved.length} resolved, ${pending.length} pending, ${irreconcilable} irreconcilable (${executionTimeMs}ms)`, 'identityResolution');

  options.onProgress?.(`Concluído: ${resolved.length} resolvidos, ${pending.length} pendentes, ${irreconcilable} irreconciliáveis`);

  return {
    resolved,
    pending,
    irreconcilable,
    totalCompared: sourceRows.length,
    executionTimeMs,
  };
}

/**
 * Quick identity check: does this entity exist in the target database?
 */
export async function quickLookup(
  targetClient: SupabaseClient,
  table: string,
  column: string,
  value: string,
  normalizer?: (v: string) => string
): Promise<{ found: boolean; count: number; firstId?: string }> {
  const normalized = normalizer ? normalizer(value) : value;
  const { data, count, error } = await targetClient
    .from(table)
    .select('id', { count: 'exact' })
    .ilike(column, normalized)
    .limit(1);

  if (error) return { found: false, count: 0 };
  return {
    found: (count ?? 0) > 0,
    count: count ?? 0,
    firstId: data?.[0]?.id ? String(data[0].id) : undefined,
  };
}
