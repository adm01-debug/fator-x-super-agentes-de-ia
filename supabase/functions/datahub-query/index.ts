import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

function applyStaticFilter(query: ReturnType<ReturnType<typeof createClient>['from']>['select'], filterStr: string) {
  const parts = filterStr.split(' AND ').map((f: string) => f.trim());
  for (const f of parts) {
    const eqMatch = f.match(/^(\w+)\s*=\s*(.+)$/);
    if (eqMatch) {
      const [, col, val] = eqMatch;
      const cleanVal = val.replace(/^'|'$/g, '');
      if (cleanVal === 'true') query = query.eq(col, true);
      else if (cleanVal === 'false') query = query.eq(col, false);
      else query = query.eq(col, cleanVal);
    }
    const neqMatch = f.match(/^(\w+)\s*(IS NOT NULL|!= '')$/i);
    if (neqMatch) {
      const [, col, op] = neqMatch;
      if (op.toUpperCase() === 'IS NOT NULL') query = query.not(col, 'is', null);
      else query = query.neq(col, '');
    }
  }
  return query;
}

/* ── Dynamic filters from client ─────────────────────── */

function applyDynamicFilters(query: any, filters: any[]) {
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
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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
      return new Response(JSON.stringify({ connections: results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      return new Response(JSON.stringify({ entities: counts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

        return new Response(JSON.stringify({ record, enriched, cross_db: crossData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
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
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: update_field ═══
    if (action === 'update_field') {
      const { entity, record_id: updateId, field, value } = body;
      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      // Block sensitive fields
      if (mapping.sensitive_fields?.includes(field)) {
        return new Response(JSON.stringify({ error: 'Cannot edit sensitive/LGPD-protected fields' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Block id and system columns
      const blockedCols = new Set(['id', 'created_at', 'search_vector']);
      if (blockedCols.has(field)) {
        return new Response(JSON.stringify({ error: `Column "${field}" cannot be edited` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      // Parse value types
      let parsedValue: any = value;
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
        return new Response(JSON.stringify({ success: true, record: updated2 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, record: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: batch_update ═══
    if (action === 'batch_update') {
      const { entity, record_ids, field, value } = body;
      if (!entity || !Array.isArray(record_ids) || !record_ids.length || !field) {
        return new Response(JSON.stringify({ error: 'Missing required: entity, record_ids[], field, value' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      if (record_ids.length > 100) {
        return new Response(JSON.stringify({ error: 'Max 100 records per batch' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      if (mapping.sensitive_fields?.includes(field)) {
        return new Response(JSON.stringify({ error: 'Cannot edit sensitive/LGPD-protected fields' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const blockedCols = new Set(['id', 'created_at', 'search_vector']);
      if (blockedCols.has(field)) {
        return new Response(JSON.stringify({ error: `Column "${field}" cannot be edited` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      let parsedValue: any = value;
      if (value === '' || value === null) parsedValue = null;
      else if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      else if (/^\d+$/.test(value)) parsedValue = parseInt(value, 10);
      else if (/^\d+\.\d+$/.test(value)) parsedValue = parseFloat(value);

      const updatePayload: Record<string, any> = { [field]: parsedValue };

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
        return new Response(JSON.stringify({ success: true, updated_count: updated2?.length ?? 0, records: updated2 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      return new Response(JSON.stringify({ success: true, updated_count: updated?.length ?? 0, records: updated }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: create_record ═══
    if (action === 'create_record') {
      const { entity, data: recordData } = body;
      if (!entity || !recordData || typeof recordData !== 'object') {
        return new Response(JSON.stringify({ error: 'Missing required: entity, data' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

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

      return new Response(JSON.stringify({ success: true, record: created }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: delete_record ═══
    if (action === 'delete_record') {
      const { entity, record_id: deleteId } = body;
      if (!entity || !deleteId) {
        return new Response(JSON.stringify({ error: 'Missing required: entity, record_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const mapping = ENTITY_MAPPINGS[entity];
      if (!mapping) return new Response(JSON.stringify({ error: `Unknown entity: ${entity}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const client = getExternalClient(mapping.primary.connection);
      const prim = mapping.primary;

      const { error: deleteError } = await client
        .from(prim.table)
        .delete()
        .eq(prim.id_column, deleteId);

      if (deleteError) throw new Error(deleteError.message);

      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('datahub-query error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
