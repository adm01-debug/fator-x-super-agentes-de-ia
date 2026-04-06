import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders, handleCorsPreflight, jsonResponse, errorResponse, checkRateLimit, getRateLimitIdentifier, createRateLimitResponse, RATE_LIMITS } from "../_shared/mod.ts";

// CORS handled by _shared/cors.ts — dynamic origin whitelist

/* ── Connection registry ─────────────────────────────── */

const CONNECTION_REGISTRY: Record<string, { urlEnv: string; keyEnv: string }> = {
  bancodadosclientes:      { urlEnv: 'BANCODADOSCLIENTES_URL',      keyEnv: 'BANCODADOSCLIENTES_SERVICE_ROLE_KEY' },
  'supabase-fuchsia-kite': { urlEnv: 'FUCHSIA_KITE_URL',            keyEnv: 'FUCHSIA_KITE_SERVICE_ROLE_KEY' },
  gestao_time_promo:       { urlEnv: 'GESTAO_TIME_PROMO_URL',       keyEnv: 'GESTAO_TIME_PROMO_SERVICE_ROLE_KEY' },
  backupgiftstore:         { urlEnv: 'BACKUPGIFTSTORE_URL',          keyEnv: 'BACKUPGIFTSTORE_SERVICE_ROLE_KEY' },
};

function getExternalClient(connectionId: string) {
  const reg = CONNECTION_REGISTRY[connectionId];
  if (!reg) throw new Error(`Unknown connection: ${connectionId}`);
  const url = Deno.env.get(reg.urlEnv);
  const key = Deno.env.get(reg.keyEnv);
  if (!url || !key) throw new Error(`Missing env vars for connection "${connectionId}": ${reg.urlEnv} / ${reg.keyEnv}`);
  return createClient(url, key);
}

/* ── Entity mappings ─────────────────────────────────── */

const ENTITY_MAPPINGS: Record<string, any> = {
  cliente: {
    primary: { connection: 'bancodadosclientes', table: 'companies', id_column: 'id', display_column: 'razao_social', filter: "is_customer = true AND status = 'ativo' AND razao_social IS NOT NULL AND razao_social != ''" },
    secondary: [
      { table: 'customers', join_col: 'company_id', fields: ['vendedor_id', 'vendedor_nome'] },
      { table: 'company_addresses', join_col: 'company_id', fields: ['cidade', 'estado', 'cep'], extra_filter: "is_primary = true" },
      { table: 'company_phones', join_col: 'company_id', fields: ['phone'] },
      { table: 'company_emails', join_col: 'company_id', fields: ['email'] },
    ],
    cross_db: [{ connection: 'backupgiftstore', table: 'contacts', match_by: 'phone' }],
    group_by: 'grupo_economico_id',
    exclude_self: true,
  },
  fornecedor: {
    primary: { connection: 'bancodadosclientes', table: 'companies', id_column: 'id', display_column: 'razao_social', filter: "is_supplier = true AND status = 'ativo'" },
    secondary: [
      { table: 'suppliers', join_col: 'company_id', fields: ['homologado', 'score_geral', 'data_homologacao'] },
      { table: 'company_addresses', join_col: 'company_id', fields: ['cidade', 'estado'], extra_filter: "is_primary = true" },
    ],
    cross_db: [{ connection: 'supabase-fuchsia-kite', table: 'suppliers', match_by: 'cnpj_raiz' }],
  },
  transportadora: {
    primary: { connection: 'bancodadosclientes', table: 'companies', id_column: 'id', display_column: 'razao_social', filter: "is_carrier = true AND status = 'ativo'" },
    secondary: [
      { table: 'carriers', join_col: 'company_id', fields: ['score_geral', 'cobertura_estados'] },
      { table: 'company_addresses', join_col: 'company_id', fields: ['cidade', 'estado'], extra_filter: "is_primary = true" },
    ],
  },
  produto: {
    primary: { connection: 'supabase-fuchsia-kite', table: 'products', id_column: 'id', display_column: 'name' },
    secondary: [
      { table: 'product_variants', join_col: 'product_id', fields: ['sku', 'color_name'] },
      { table: 'product_images', join_col: 'product_id', fields: ['url', 'type'], limit: 5 },
    ],
  },
  colaborador: {
    primary: { connection: 'gestao_time_promo', table: 'colaboradores', id_column: 'id', display_column: 'nome_completo', filter: "status = 'ativo'" },
    secondary: [
      { table: 'departamentos', join_col: 'id', join_source: 'departamento_id', fields: ['nome'] },
      { table: 'cargos', join_col: 'id', join_source: 'cargo_id', fields: ['nome', 'nivel'] },
    ],
    sensitive_fields: ['cpf', 'salario', 'conta_bancaria', 'pix'],
    cross_db: [{ connection: 'bancodadosclientes', table: 'users', match_by: 'email' }],
  },
  conversa_whatsapp: {
    primary: { connection: 'backupgiftstore', table: 'contacts', id_column: 'id', display_column: 'name' },
    secondary: [
      { table: 'messages', join_col: 'contact_id', fields: ['body', 'type', 'timestamp'], limit: 50 },
    ],
    cross_db: [{ connection: 'bancodadosclientes', table: 'company_phones', match_by: 'phone' }],
  },
};

/* ── Filter parser helper ────────────────────────────── */

// deno-lint-ignore no-explicit-any -- Supabase query builder type is complex
function applyStaticFilter(query: any, filterStr: string) {
  const parts = filterStr.split(' AND ').map((f: string) => f.trim());
  for (const f of parts) {
    // IS NULL / IS NOT NULL
    const nullMatch = f.match(/^(\w+)\s+(IS NULL|IS NOT NULL)$/i);
    if (nullMatch) {
      const [, col, op] = nullMatch;
      if (op.toUpperCase() === 'IS NOT NULL') query = query.not(col, 'is', null);
      else query = query.is(col, null);
      continue;
    }
    // != (not equal)
    const neqMatch = f.match(/^(\w+)\s*!=\s*(.+)$/);
    if (neqMatch) {
      const [, col, val] = neqMatch;
      const cleanVal = val.replace(/^'|'$/g, '');
      query = query.neq(col, cleanVal);
      continue;
    }
    // >= (greater than or equal)
    const gteMatch = f.match(/^(\w+)\s*>=\s*(.+)$/);
    if (gteMatch) {
      const [, col, val] = gteMatch;
      query = query.gte(col, val.replace(/^'|'$/g, ''));
      continue;
    }
    // <= (less than or equal)
    const lteMatch = f.match(/^(\w+)\s*<=\s*(.+)$/);
    if (lteMatch) {
      const [, col, val] = lteMatch;
      query = query.lte(col, val.replace(/^'|'$/g, ''));
      continue;
    }
    // > (greater than)
    const gtMatch = f.match(/^(\w+)\s*>\s*(.+)$/);
    if (gtMatch) {
      const [, col, val] = gtMatch;
      query = query.gt(col, val.replace(/^'|'$/g, ''));
      continue;
    }
    // < (less than)
    const ltMatch = f.match(/^(\w+)\s*<\s*(.+)$/);
    if (ltMatch) {
      const [, col, val] = ltMatch;
      query = query.lt(col, val.replace(/^'|'$/g, ''));
      continue;
    }
    // LIKE
    const likeMatch = f.match(/^(\w+)\s+LIKE\s+'(.+)'$/i);
    if (likeMatch) {
      const [, col, val] = likeMatch;
      query = query.like(col, val);
      continue;
    }
    // IN
    const inMatch = f.match(/^(\w+)\s+IN\s*\((.+)\)$/i);
    if (inMatch) {
      const [, col, valStr] = inMatch;
      const values = valStr.split(',').map((v: string) => v.trim().replace(/^'|'$/g, ''));
      query = query.in(col, values);
      continue;
    }
    // = (equality — default)
    const eqMatch = f.match(/^(\w+)\s*=\s*(.+)$/);
    if (eqMatch) {
      const [, col, val] = eqMatch;
      const cleanVal = val.replace(/^'|'$/g, '');
      if (cleanVal === 'true') query = query.eq(col, true);
      else if (cleanVal === 'false') query = query.eq(col, false);
      else query = query.eq(col, cleanVal);
    }
  }
  return query;
}

/* ── Dynamic filters from client ─────────────────────── */

// deno-lint-ignore no-explicit-any -- Supabase query builder type is complex
function applyDynamicFilters(query: any, filters: Array<Record<string, unknown>>) {
  for (const f of filters) {
    if (!f.column || !f.operator) continue;
    const col = String(f.column).replace(/[^a-zA-Z0-9_]/g, '');
    const val = f.value;
    switch (f.operator) {
      case 'eq':
        if (val === 'true') query = query.eq(col, true);
        else if (val === 'false') query = query.eq(col, false);
        else query = query.eq(col, val);
        break;
      case 'neq': query = query.neq(col, val); break;
      case 'ilike': query = query.ilike(col, val); break;
      case 'gt': query = query.gt(col, val); break;
      case 'lt': query = query.lt(col, val); break;
      case 'gte': query = query.gte(col, val); break;
      case 'lte': query = query.lte(col, val); break;
    }
  }
  return query;
}

/* ── Main handler ────────────────────────────────────── */

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { action } = body;

    // ═══ ACTION: test_connections ═══
    if (action === 'test_connections') {
      const results: Record<string, { status: string; count?: number; error?: string }> = {};
      for (const [connId] of Object.entries(CONNECTION_REGISTRY)) {
        try {
          const client = getExternalClient(connId);
          const testTable = connId === 'bancodadosclientes' ? 'companies'
            : connId === 'supabase-fuchsia-kite' ? 'products'
            : connId === 'gestao_time_promo' ? 'colaboradores'
            : 'contacts';
          const { count, error } = await client.from(testTable).select('id', { count: 'exact', head: true });
          if (error) throw new Error(error.message);
          results[connId] = { status: 'connected', count: count ?? 0 };
        } catch (e: unknown) {
          results[connId] = { status: 'error', error: e instanceof Error ? e.message : 'Unknown' };
        }
      }
      return new Response(JSON.stringify({ connections: results }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: list_entities ═══
    if (action === 'list_entities') {
      const counts: Record<string, number> = {};
      for (const [entityId, mapping] of Object.entries(ENTITY_MAPPINGS)) {
        try {
          const client = getExternalClient(mapping.primary.connection);
          let query = client.from(mapping.primary.table).select('id', { count: 'exact', head: true });
          if (mapping.primary.filter) query = applyStaticFilter(query, mapping.primary.filter);
          const { count } = await query;
          counts[entityId] = count ?? 0;
        } catch {
          counts[entityId] = -1;
        }
      }
      return new Response(JSON.stringify({ entities: counts }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: query_entity ═══
    if (action === 'query_entity') {
      const {
        entity,
        search: searchTerm,
        page = 0,
        page_size = 25,
        record_id,
        sort_column,
        sort_direction = 'asc',
        filters: dynamicFilters = [],
        exclude_id,
      } = body;

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      // ─── Single record with enrichment ───
      if (record_id) {
        const { data: record, error } = await client.from(prim.table).select('*').eq(prim.id_column, record_id).single();
        if (error) throw new Error(error.message);

        if (mapping.sensitive_fields) {
          for (const sf of mapping.sensitive_fields) {
            if (record && sf in record) record[sf] = '***REDACTED***';
          }
        }

        const enriched: Record<string, any> = {};
        if (mapping.secondary) {
          for (const sec of mapping.secondary) {
            try {
              const joinCol = sec.join_col;
              const joinVal = sec.join_source ? record[sec.join_source] : record_id;
              let sq = client.from(sec.table).select(sec.fields ? sec.fields.join(',') : '*').eq(joinCol, joinVal);
              if (sec.extra_filter) sq = applyStaticFilter(sq, sec.extra_filter);
              if (sec.limit) sq = sq.limit(sec.limit);
              const { data: secData } = await sq;
              enriched[sec.table] = secData ?? [];
            } catch { enriched[sec.table] = []; }
          }
        }

        const crossData: Record<string, any> = {};
        if (mapping.cross_db) {
          for (const cross of mapping.cross_db) {
            try {
              const crossClient = getExternalClient(cross.connection);
              let matchValue: string | null = null;
              if (cross.match_by === 'phone' && enriched['company_phones']?.length > 0) {
                matchValue = enriched['company_phones'][0].phone;
              } else if (cross.match_by === 'email') {
                matchValue = record?.email ?? null;
              } else if (cross.match_by === 'cnpj_raiz' && record?.cnpj) {
                matchValue = record.cnpj.substring(0, 8);
              } else if (cross.match_by === 'phone' && record?.phone) {
                matchValue = record.phone;
              }
              if (matchValue) {
                const { data: crossResult } = await crossClient.from(cross.table).select('*').eq(cross.match_by, matchValue).limit(5);
                crossData[`${cross.connection}.${cross.table}`] = crossResult ?? [];
              }
            } catch { crossData[`${cross.connection}.${cross.table}`] = []; }
          }
        }

        // ─── Sentiment Analysis for WhatsApp conversations (HuggingFace, fire-and-forget enrichment) ───
        let sentiment: Record<string, unknown> | null = null;
        const hfToken = Deno.env.get('HF_API_TOKEN');
        if (entity === 'conversa_whatsapp' && hfToken && enriched['messages']?.length > 0) {
          try {
            const recentMessages = enriched['messages']
              .slice(0, 10)
              .map((m: Record<string, unknown>) => String(m.body || '').substring(0, 200))
              .filter((t: string) => t.length > 3)
              .join('. ');
            if (recentMessages.length > 10) {
              const sentResp = await fetch('https://router.huggingface.co/hf-inference/models/cardiffnlp/twitter-roberta-base-sentiment-latest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
                body: JSON.stringify({ inputs: recentMessages.substring(0, 512) }),
              });
              if (sentResp.ok) {
                const sentResult = await sentResp.json();
                const labels = Array.isArray(sentResult?.[0]) ? sentResult[0] : sentResult;
                if (Array.isArray(labels)) {
                  const sorted = [...labels].sort((a: Record<string, unknown>, b: Record<string, unknown>) => (b.score as number) - (a.score as number));
                  const labelMap: Record<string, string> = { positive: 'positivo', negative: 'negativo', neutral: 'neutro' };
                  sentiment = {
                    dominant: labelMap[sorted[0]?.label as string] || sorted[0]?.label,
                    score: Math.round((sorted[0]?.score as number) * 100) / 100,
                    breakdown: sorted.map((s: Record<string, unknown>) => ({
                      label: labelMap[s.label as string] || s.label,
                      score: Math.round((s.score as number) * 100) / 100,
                    })),
                    messages_analyzed: Math.min(10, enriched['messages'].length),
                    model: 'cardiffnlp/twitter-roberta-base-sentiment-latest',
                  };
                }
              }
            }
          } catch { /* sentiment is optional, ignore errors */ }
        }

        return new Response(JSON.stringify({ record, enriched, cross_db: crossData, ...(sentiment ? { sentiment } : {}) }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      // ─── List query ───
      let query = client.from(prim.table).select('*', { count: 'exact' });

      // Static entity filters
      if (prim.filter) query = applyStaticFilter(query, prim.filter);

      // Dynamic filters from client
      if (dynamicFilters.length > 0) query = applyDynamicFilters(query, dynamicFilters);

      // Search
      if (searchTerm && prim.display_column) {
        query = query.ilike(prim.display_column, `%${searchTerm}%`);
      }

      // Exclude self (for group queries)
      if (exclude_id) {
        query = query.neq(prim.id_column, exclude_id);
      }

      // Sorting
      const sortCol = sort_column || prim.display_column;
      const sortDir = sort_direction === 'desc' ? false : true;
      if (sortCol) query = query.order(sortCol, { ascending: sortDir });

      // Pagination
      const from = page * page_size;
      query = query.range(from, from + page_size - 1);

      const { data, count, error } = await query;
      if (error) throw new Error(error.message);

      // Strip sensitive
      if (mapping.sensitive_fields && data) {
        for (const row of data) {
          for (const sf of mapping.sensitive_fields) {
            if (sf in row) row[sf] = '***';
          }
        }
      }

      return new Response(JSON.stringify({
        data: data ?? [],
        total: count ?? 0,
        page,
        page_size,
        total_pages: Math.ceil((count ?? 0) / page_size),
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: update_field ═══
    if (action === 'update_field') {
      const { entity, record_id: updateId, field, value } = body;
      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      // Block sensitive fields
      if (mapping.sensitive_fields?.includes(field)) {
        return new Response(JSON.stringify({ error: 'Cannot edit sensitive/LGPD-protected fields' }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      // Block id and system columns
      const blockedCols = new Set(['id', 'created_at', 'search_vector']);
      if (blockedCols.has(field)) {
        return new Response(JSON.stringify({ error: `Column "${field}" cannot be edited` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      // Parse value types
      let parsedValue: string | number | boolean | null = value;
      if (value === '' || value === null) parsedValue = null;
      else if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

      const { data: updated, error: updateError } = await client
        .from(prim.table)
        .update({ [field]: parsedValue, updated_at: new Date().toISOString() })
        .eq(prim.id_column, updateId)
        .select('*')
        .single();

      if (updateError) {
        // Retry without updated_at if column doesn't exist
        const { data: updated2, error: updateError2 } = await client
          .from(prim.table)
          .update({ [field]: parsedValue })
          .eq(prim.id_column, updateId)
          .select('*')
          .single();
        if (updateError2) throw new Error(updateError2.message);
        return new Response(JSON.stringify({ success: true, record: updated2 }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, record: updated }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: batch_update ═══
    if (action === 'batch_update') {
      const { entity, record_ids, field, value } = body;
      if (!entity || !Array.isArray(record_ids) || !record_ids.length || !field) {
        return new Response(JSON.stringify({ error: 'Missing required: entity, record_ids[], field, value' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }
      if (record_ids.length > 100) {
        return new Response(JSON.stringify({ error: 'Max 100 records per batch' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      if (mapping.sensitive_fields?.includes(field)) {
        return new Response(JSON.stringify({ error: 'Cannot edit sensitive/LGPD-protected fields' }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const blockedCols = new Set(['id', 'created_at', 'search_vector']);
      if (blockedCols.has(field)) {
        return new Response(JSON.stringify({ error: `Column "${field}" cannot be edited` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      let parsedValue: string | number | boolean | null = value;
      if (value === '' || value === null) parsedValue = null;
      else if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

      const updatePayload: Record<string, unknown> = { [field]: parsedValue };

      // Try with updated_at first
      const { data: updated, error: updateError } = await client
        .from(prim.table)
        .update({ ...updatePayload, updated_at: new Date().toISOString() })
        .in(prim.id_column, record_ids)
        .select('*');

      if (updateError) {
        // Retry without updated_at
        const { data: updated2, error: updateError2 } = await client
          .from(prim.table)
          .update(updatePayload)
          .in(prim.id_column, record_ids)
          .select('*');
        if (updateError2) throw new Error(updateError2.message);
        return new Response(JSON.stringify({ success: true, updated_count: updated2?.length ?? 0, records: updated2 }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, updated_count: updated?.length ?? 0, records: updated }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: create_record ═══
    if (action === 'create_record') {
      const { entity, data: recordData } = body;
      if (!entity || !recordData || typeof recordData !== 'object') {
        return new Response(JSON.stringify({ error: 'Missing required: entity, data' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      // Block sensitive fields from being set
      if (mapping.sensitive_fields) {
        for (const sf of mapping.sensitive_fields) {
          delete recordData[sf];
        }
      }

      // Remove blocked system columns
      const blockedCols = ['id', 'created_at', 'updated_at', 'search_vector'];
      for (const col of blockedCols) {
        delete recordData[col];
      }

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      const { data: created, error: createError } = await client
        .from(prim.table)
        .insert(recordData)
        .select('*')
        .single();

      if (createError) throw new Error(createError.message);

      return new Response(JSON.stringify({ success: true, record: created }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: delete_record ═══
    if (action === 'delete_record') {
      const { entity, record_id: deleteId } = body;
      if (!entity || !deleteId) {
        return new Response(JSON.stringify({ error: 'Missing required: entity, record_id' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      const { error: deleteError } = await client
        .from(prim.table)
        .delete()
        .eq(prim.id_column, deleteId);

      if (deleteError) throw new Error(deleteError.message);

      return new Response(JSON.stringify({ success: true }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: summarize_conversation — Summarize WhatsApp conversation ═══
    if (action === 'summarize_conversation') {
      const { entity, record_id: sumId } = body;
      if (!entity || !sumId) return new Response(JSON.stringify({ error: 'entity and record_id required' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const client = getExternalClient(mapping.primary.connection);

      // Get messages for the conversation
      let messages: Array<Record<string, unknown>> = [];
      if (mapping.secondary) {
        for (const sec of mapping.secondary) {
          if (sec.table === 'messages' || sec.table.includes('message')) {
            const { data } = await client.from(sec.table).select('body, from_me, timestamp').eq(sec.join_col, sumId).order('timestamp', { ascending: true }).limit(50);
            messages = data || [];
            break;
          }
        }
      }

      if (messages.length === 0) {
        return new Response(JSON.stringify({ summary: 'Nenhuma mensagem encontrada.', message_count: 0 }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      // Build conversation text
      const convoText = messages
        .map((m: Record<string, unknown>) => `${m.from_me ? 'Agente' : 'Cliente'}: ${String(m.body || '').substring(0, 300)}`)
        .join('\n');

      // Summarize using HF LLM via Gateway
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const sumResp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'huggingface/mistralai/Mistral-Small-24B-Instruct-2501',
          messages: [
            { role: 'system', content: 'Resuma esta conversa em 3-5 frases em português. Destaque: assunto principal, decisões tomadas, próximos passos, e tom geral (positivo/negativo/neutro).' },
            { role: 'user', content: convoText.substring(0, 4000) },
          ],
          temperature: 0.3,
          max_tokens: 500,
        }),
      });
      const sumResult = await sumResp.json();

      return new Response(JSON.stringify({
        summary: sumResult.content || 'Não foi possível gerar resumo.',
        message_count: messages.length,
        model: 'mistralai/Mistral-Small-24B-Instruct-2501',
        tokens: sumResult.tokens,
        cost_usd: sumResult.cost_usd || 0,
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: natural_language_query — Text-to-SQL (#28) ═══
    if (action === 'natural_language_query') {
      const { question, connection_id, max_rows } = body;
      if (!question) return new Response(JSON.stringify({ error: 'question required' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const connId = connection_id || 'bancodadosclientes';
      const client = getExternalClient(connId);

      // Get table list for schema context
      const schemaHints: string[] = [];
      for (const [entityName, mapping] of Object.entries(ENTITY_MAPPINGS)) {
        if (mapping.primary.connection === connId) {
          const cols = mapping.primary.display_column ? [mapping.primary.id_column, mapping.primary.display_column] : [mapping.primary.id_column];
          schemaHints.push(`${mapping.primary.table} (${cols.join(', ')})`);
        }
      }

      const schemaContext = schemaHints.length > 0
        ? `Tabelas disponíveis: ${schemaHints.join('; ')}`
        : `Conexão: ${connId} (PostgreSQL)`;

      // Generate SQL via LLM
      const supabaseUrl2 = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey2 = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authHeader2 = req.headers.get('Authorization')!;

      const sqlResp = await fetch(`${supabaseUrl2}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader2, 'apikey': supabaseKey2 },
        body: JSON.stringify({
          model: 'huggingface/Qwen/Qwen3-30B-A3B',
          messages: [
            { role: 'system', content: `Você é um especialista em PostgreSQL. Gere APENAS o SQL (sem explicação, sem markdown, sem backticks) para responder a pergunta do usuário.\n\n${schemaContext}\n\nRegras:\n- SELECT apenas, nunca INSERT/UPDATE/DELETE\n- LIMIT ${max_rows || 25} sempre\n- Use ILIKE para buscas de texto\n- Retorne apenas o SQL puro` },
            { role: 'user', content: question },
          ],
          temperature: 0.1, max_tokens: 500,
        }),
      });
      const sqlResult = await sqlResp.json();
      const generatedSql = (sqlResult.content || '').replace(/```sql\n?|```/g, '').trim();

      // ═══ SQL SANITIZATION (C2 fix) ═══
      const sqlUpper = generatedSql.toUpperCase();
      // Must start with SELECT
      if (!sqlUpper.startsWith('SELECT')) {
        return new Response(JSON.stringify({ error: 'Generated query is not a SELECT statement', sql: generatedSql }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }
      // Block dangerous statements (even if preceded by SELECT)
      const SQL_BLOCKLIST = /\b(DROP|DELETE|UPDATE|INSERT|ALTER|CREATE|GRANT|REVOKE|TRUNCATE|EXEC|EXECUTE|COPY|LOAD|INTO\s+OUTFILE|pg_shadow|pg_authid|pg_roles|information_schema\.role|pg_catalog\.pg_shadow|pg_user|current_setting|set_config)\b/i;
      if (SQL_BLOCKLIST.test(generatedSql)) {
        return new Response(JSON.stringify({ error: 'Generated SQL contains blocked keywords', sql: generatedSql }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }
      // Block multiple statements (semicolon followed by non-whitespace)
      if (/;[\s]*\S/.test(generatedSql)) {
        return new Response(JSON.stringify({ error: 'Multiple SQL statements not allowed', sql: generatedSql }), { status: 403, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      // Return SQL for manual execution (NEVER execute directly)
      return new Response(JSON.stringify({
        sql: generatedSql,
        question,
        connection: connId,
        schema_context: schemaContext,
        status: 'sql_generated',
        note: 'SQL gerado para revisão. Execute via Supabase dashboard com read-only role.',
        model: 'Qwen/Qwen3-30B-A3B',
        cost_usd: sqlResult.cost_usd || 0,
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: table_qa — Perguntas sobre tabelas (#37) ═══
    if (action === 'table_qa') {
      const { question: tqQuestion, entity: tqEntity, record_id: tqRecordId } = body;
      if (!tqQuestion || !tqEntity) return new Response(JSON.stringify({ error: 'question and entity required' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const mapping = ENTITY_MAPPINGS[tqEntity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${tqEntity}` }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });

      const client2 = getExternalClient(mapping.primary.connection);

      // Fetch sample data for context
      let query2 = client2.from(mapping.primary.table).select('*').limit(20);
      if (mapping.primary.filter) query2 = applyStaticFilter(query2, mapping.primary.filter);
      const { data: sampleData } = await query2;

      if (!sampleData || sampleData.length === 0) {
        return new Response(JSON.stringify({ answer: 'Nenhum dado encontrado para esta entidade.' }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
      }

      // Build table context as CSV-like for the LLM
      const columns = Object.keys(sampleData[0]);
      const tableContext = [
        columns.join(' | '),
        ...sampleData.map((row: Record<string, unknown>) => columns.map(c => String(row[c] ?? '')).join(' | ')),
      ].join('\n');

      // Ask LLM to answer based on table
      const supabaseUrl3 = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey3 = Deno.env.get('SUPABASE_ANON_KEY')!;
      const authHeader3 = req.headers.get('Authorization')!;

      const tqResp = await fetch(`${supabaseUrl3}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader3, 'apikey': supabaseKey3 },
        body: JSON.stringify({
          model: 'huggingface/Qwen/Qwen3-30B-A3B',
          messages: [
            { role: 'system', content: 'Você responde perguntas baseado APENAS nos dados da tabela fornecida. Responda em português, de forma concisa e precisa. Se a resposta não está nos dados, diga isso.' },
            { role: 'user', content: `Tabela (${mapping.primary.table}, ${sampleData.length} registros):\n${tableContext}\n\nPergunta: ${tqQuestion}` },
          ],
          temperature: 0.1, max_tokens: 500,
        }),
      });
      const tqResult = await tqResp.json();

      return new Response(JSON.stringify({
        answer: tqResult.content || 'Não foi possível responder.',
        question: tqQuestion,
        entity: tqEntity,
        rows_analyzed: sampleData.length,
        model: 'Qwen/Qwen3-30B-A3B',
        cost_usd: tqResult.cost_usd || 0,
      }), { headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('datahub-query error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...getCorsHeaders(req), 'Content-Type': 'application/json' } });
  }
});
