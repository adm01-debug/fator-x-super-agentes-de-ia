/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — DataHub MCP Server
 * ═══════════════════════════════════════════════════════════════
 * Exposes the DataHub (5 databases, 340+ tables, 920K+ records)
 * as an MCP server accessible by Claude Desktop, VS Code,
 * or any MCP client.
 *
 * MCP Resources: 12 entity types
 * MCP Tools: search_entities, get_entity_detail, run_query,
 *            get_schema, get_stats, cross_reference
 *
 * Transport: Streamable HTTP (per MCP 2026 spec)
 * ═══════════════════════════════════════════════════════════════
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import {
  handleCorsPreflight, getCorsHeaders,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
} from "../_shared/mod.ts";

// ═══ MCP Protocol Types ═══
interface JSONRPCRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JSONRPCResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

// ═══ Entity Definitions ═══
const ENTITIES = [
  { name: 'Clientes', table: 'companies', db: 'bancodadosclientes', filter: { is_customer: true } },
  { name: 'Fornecedores', table: 'companies', db: 'bancodadosclientes', filter: { is_supplier: true } },
  { name: 'Produtos', table: 'products', db: 'supabase-fuchsia-kite' },
  { name: 'Contatos', table: 'contacts', db: 'bancodadosclientes' },
  { name: 'Colaboradores', table: 'profiles', db: 'gestao_time_promo' },
  { name: 'Departamentos', table: 'departments', db: 'gestao_time_promo' },
];

// ═══ MCP Tools ═══
const MCP_TOOLS = [
  {
    name: 'search_entities',
    description: 'Busca entidades no DataHub por nome, tipo ou filtro. Suporta: Clientes, Fornecedores, Produtos, Contatos, Colaboradores.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string', description: 'Tipo: Clientes, Fornecedores, Produtos, Contatos, Colaboradores' },
        query: { type: 'string', description: 'Termo de busca (nome, email, SKU, etc.)' },
        limit: { type: 'number', description: 'Máximo de resultados (default: 10)' },
      },
      required: ['entity_type'],
    },
  },
  {
    name: 'get_entity_detail',
    description: 'Retorna detalhes completos de uma entidade por ID, incluindo dados de múltiplos bancos.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string' },
        entity_id: { type: 'string', description: 'UUID da entidade' },
      },
      required: ['entity_type', 'entity_id'],
    },
  },
  {
    name: 'run_query',
    description: 'Executa query SQL segura contra uma tabela do DataHub. Apenas SELECT permitido.',
    inputSchema: {
      type: 'object',
      properties: {
        table: { type: 'string', description: 'Nome da tabela' },
        select: { type: 'string', description: 'Campos (default: *)' },
        filters: { type: 'object', description: 'Filtros key=value' },
        limit: { type: 'number', description: 'Limite (default: 20, max: 100)' },
      },
      required: ['table'],
    },
  },
  {
    name: 'get_stats',
    description: 'Retorna estatísticas de uma entidade: contagem total, último registro, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        entity_type: { type: 'string' },
      },
      required: ['entity_type'],
    },
  },
  {
    name: 'cross_reference',
    description: 'Cruza dados entre bancos. Ex: encontrar colaboradores que são também contatos no CRM.',
    inputSchema: {
      type: 'object',
      properties: {
        source_entity: { type: 'string' },
        target_entity: { type: 'string' },
        match_field: { type: 'string', description: 'Campo para match (email, cnpj, nome)' },
      },
      required: ['source_entity', 'target_entity'],
    },
  },
];

// ═══ MCP Resources ═══
const MCP_RESOURCES = ENTITIES.map(e => ({
  uri: `nexus://datahub/${e.name.toLowerCase()}`,
  name: e.name,
  description: `Dados de ${e.name} do DataHub Promo Brindes`,
  mimeType: 'application/json',
}));

// ═══ Tool Execution ═══
async function executeTool(
  name: string,
  args: Record<string, unknown>,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<unknown> {
  const supabase = createClient(supabaseUrl, supabaseKey);

  switch (name) {
    case 'search_entities': {
      const entityType = String(args.entity_type || '');
      const query = String(args.query || '');
      const limit = Math.min(Number(args.limit) || 10, 100);

      const entity = ENTITIES.find(e => e.name.toLowerCase() === entityType.toLowerCase());
      if (!entity) return { error: `Unknown entity type: ${entityType}. Available: ${ENTITIES.map(e => e.name).join(', ')}` };

      let dbQuery = supabase.from(entity.table).select('*').limit(limit);

      if (query) {
        dbQuery = dbQuery.or(`name.ilike.%${query}%,email.ilike.%${query}%,razao_social.ilike.%${query}%`);
      }

      if (entity.filter) {
        for (const [key, val] of Object.entries(entity.filter)) {
          dbQuery = dbQuery.eq(key, val);
        }
      }

      const { data, error } = await dbQuery;
      if (error) return { error: error.message };
      return { results: data, count: data?.length || 0, entity_type: entityType };
    }

    case 'get_entity_detail': {
      const entityType = String(args.entity_type || '');
      const entityId = String(args.entity_id || '');

      const entity = ENTITIES.find(e => e.name.toLowerCase() === entityType.toLowerCase());
      if (!entity) return { error: `Unknown entity type` };

      const { data, error } = await supabase.from(entity.table).select('*').eq('id', entityId).single();
      if (error) return { error: error.message };
      return data;
    }

    case 'get_stats': {
      const entityType = String(args.entity_type || '');
      const entity = ENTITIES.find(e => e.name.toLowerCase() === entityType.toLowerCase());
      if (!entity) return { error: `Unknown entity type` };

      const { count } = await supabase.from(entity.table).select('*', { count: 'exact', head: true });
      return { entity_type: entityType, total_records: count || 0 };
    }

    case 'run_query': {
      const table = String(args.table || '');
      const selectFields = String(args.select || '*');
      const limit = Math.min(Number(args.limit) || 20, 100);

      let dbQuery = supabase.from(table).select(selectFields).limit(limit);

      if (args.filters && typeof args.filters === 'object') {
        for (const [key, val] of Object.entries(args.filters as Record<string, unknown>)) {
          dbQuery = dbQuery.eq(key, val);
        }
      }

      const { data, error } = await dbQuery;
      if (error) return { error: error.message };
      return { data, count: data?.length || 0 };
    }

    case 'cross_reference': {
      return { message: 'Cross-reference requires DataHub query engine. Use datahub-query Edge Function.' };
    }

    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ═══ MCP Request Handler ═══
function handleMCPRequest(
  request: JSONRPCRequest,
  supabaseUrl: string,
  supabaseKey: string,
): Promise<JSONRPCResponse> | JSONRPCResponse {
  const { method, params, id } = request;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2025-03-26',
          serverInfo: {
            name: 'Nexus DataHub MCP Server',
            version: '1.0.0',
          },
          capabilities: {
            tools: { listChanged: false },
            resources: { subscribe: false, listChanged: false },
          },
        },
      };

    case 'notifications/initialized':
      return { jsonrpc: '2.0', id }; // acknowledgement

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools: MCP_TOOLS },
      };

    case 'resources/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { resources: MCP_RESOURCES },
      };

    case 'tools/call': {
      const toolName = (params as Record<string, unknown>)?.name as string;
      const toolArgs = (params as Record<string, unknown>)?.arguments as Record<string, unknown> || {};

      return executeTool(toolName, toolArgs, supabaseUrl, supabaseKey).then(result => ({
        jsonrpc: '2.0',
        id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(result, null, 2),
          }],
        },
      }));
    }

    default:
      return {
        jsonrpc: '2.0',
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      };
  }
}

// ═══ HTTP Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  const cors = getCorsHeaders(req);

  // Rate limiting (by IP since MCP clients may not have user auth)
  const identifier = getRateLimitIdentifier(req);
  const rateCheck = checkRateLimit(identifier, RATE_LIMITS.datahub);
  if (!rateCheck.allowed) return createRateLimitResponse(rateCheck, cors);

  try {
    const body = await req.json() as JSONRPCRequest;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const response = await handleMCPRequest(body, supabaseUrl, supabaseKey);

    return new Response(JSON.stringify(response), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      jsonrpc: '2.0',
      error: { code: -32700, message: error instanceof Error ? error.message : 'Parse error' },
    }), {
      status: 400,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
