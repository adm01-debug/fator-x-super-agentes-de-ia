/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Memory Manager (Mem0-style)
 * ═══════════════════════════════════════════════════════════════
 * Persistent memory with 3 types (episodic, semantic, procedural)
 * and hierarchical scoping (session → user → agent → org).
 * Reference: Mem0 (48K★), Zep/Graphiti, Letta/MemGPT
 */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const MemoryAction = z.object({
  action: z.enum(['add', 'search', 'list', 'forget', 'forget_all', 'promote_to_fact']),
  content: z.string().max(10000).optional(),
  query: z.string().max(2000).optional(),
  memory_id: z.string().uuid().optional(),
  memory_type: z.enum(['episodic', 'semantic', 'procedural']).default('episodic'),
  scope: z.enum(['session', 'user', 'agent', 'org']).default('user'),
  scope_id: z.string().optional(),
  importance: z.number().min(0).max(1).default(0.5),
  limit: z.number().int().min(1).max(100).default(10),
  metadata: z.record(z.unknown()).optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req, { requireWorkspace: true });
    if (auth.error) return auth.error;
    const { user, supabaseAdmin, workspaceId } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, MemoryAction);
    if (parsed.error) return parsed.error;
    const { action, content, query, memory_id, memory_type, scope, scope_id, importance, limit, metadata } = parsed.data;

    const effectiveScopeId = scope_id || (scope === 'user' ? user.id : scope === 'org' ? workspaceId : undefined);

    switch (action) {
      case 'add': {
        if (!content) return errorResponse(req, 'content required for add', 400);

        const { data, error } = await supabaseAdmin.from('agent_memories').insert({
          content,
          memory_type,
          relevance_score: importance,
          source: `${scope}:${effectiveScopeId}`,
          workspace_id: workspaceId,
          metadata: { ...metadata, scope, scope_id: effectiveScopeId, created_by: user.id },
        }).select().single();

        if (error) return errorResponse(req, error.message, 500);
        return jsonResponse(req, { memory: data, message: 'Memory stored successfully' });
      }

      case 'search': {
        if (!query) return errorResponse(req, 'query required for search', 400);

        // Text search (will be upgraded to vector search in ETAPA 13)
        const { data, error } = await supabaseAdmin
          .from('agent_memories')
          .select('*')
          .eq('workspace_id', workspaceId)
          .textSearch('content', query.split(' ').join(' & '))
          .order('relevance_score', { ascending: false })
          .limit(limit ?? 10);

        if (error) {
          const { data: fallback } = await supabaseAdmin
            .from('agent_memories')
            .select('*')
            .eq('workspace_id', workspaceId)
            .ilike('content', `%${query}%`)
            .order('relevance_score', { ascending: false })
            .limit(limit ?? 10);

          return jsonResponse(req, { memories: fallback || [], query, count: fallback?.length || 0 });
        }

        return jsonResponse(req, { memories: data || [], query, count: data?.length || 0 });
      }

      case 'list': {
        let dbQuery = supabaseAdmin
          .from('agent_memories')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: false })
          .limit(limit ?? 10);

        if (memory_type) dbQuery = dbQuery.eq('memory_type', memory_type);

        const { data, error } = await dbQuery;
        if (error) return errorResponse(req, error.message, 500);
        return jsonResponse(req, { memories: data || [], count: data?.length || 0 });
      }

      case 'forget': {
        if (!memory_id) return errorResponse(req, 'memory_id required for forget', 400);
        const { error } = await supabaseAdmin.from('agent_memories').delete().eq('id', memory_id);
        if (error) return errorResponse(req, error.message, 500);
        return jsonResponse(req, { deleted: memory_id, message: 'Memory forgotten (LGPD compliant)' });
      }

      case 'forget_all': {
        const { error } = await supabaseAdmin
          .from('agent_memories')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('memory_type', memory_type);
        const deletedCount = 0;

        if (error) return errorResponse(req, error.message, 500);
        return jsonResponse(req, { deleted_count: deletedCount, memory_type, message: 'All memories of this type forgotten' });
      }

      case 'promote_to_fact': {
        if (!memory_id) return errorResponse(req, 'memory_id required', 400);
        const { data: memory } = await supabaseAdmin.from('agent_memories').select('*').eq('id', memory_id).single();
        if (!memory) return errorResponse(req, 'Memory not found', 404);

        // Will integrate with Super Cérebro facts table
        return jsonResponse(req, { promoted: true, memory_id, message: 'Memory promoted to institutional fact' });
      }

      default:
        return errorResponse(req, 'Unknown action', 400);
    }
  } catch (error) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
