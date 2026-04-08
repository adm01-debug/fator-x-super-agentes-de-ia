import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";
import { handleCorsPreflight, jsonResponse, errorResponse } from "../_shared/mod.ts";

// ═══ Zod Schemas ═══
const toolEnum = z.enum(['memory_save', 'memory_search', 'memory_update', 'memory_forget', 'memory_compact']);
const memoryTypeEnum = z.enum(['short_term', 'episodic', 'semantic', 'user_profile', 'team', 'external']);

const saveParams = z.object({ content: z.string().min(1).max(10000), memory_type: memoryTypeEnum.optional().default('episodic'), importance: z.number().min(0).max(1).optional().default(0.5) });
const searchParams = z.object({ query: z.string().min(1).max(1000), memory_type: memoryTypeEnum.optional(), limit: z.number().int().min(1).max(100).optional().default(10) });
const updateParams = z.object({ memory_id: z.string().uuid(), new_content: z.string().min(1).max(10000) });
const forgetParams = z.object({ memory_id: z.string().uuid() });
const compactParams = z.object({ memory_type: memoryTypeEnum.optional() });

const bodySchema = z.object({
  tool: toolEnum,
  params: z.record(z.unknown()),
  agent_id: z.string().uuid().optional(),
});

/**
 * Memory Tools Edge Function — MemGPT/Letta pattern
 * Tools: memory_save, memory_search, memory_update, memory_forget, memory_compact
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return errorResponse(req, 'Unauthorized', 401);

    // Validate top-level body
    const rawBody = await req.json();
    const bodyResult = bodySchema.safeParse(rawBody);
    if (!bodyResult.success) {
      return errorResponse(req, 'Invalid request', 400, { details: bodyResult.error.flatten().fieldErrors });
    }
    const { tool, params, agent_id } = bodyResult.data;

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    if (tool === 'memory_save') {
      const parsed = saveParams.safeParse(params);
      if (!parsed.success) return errorResponse(req, 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      const { content, memory_type, importance } = parsed.data;

      const { data: mem, error } = await (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories').insert({
        agent_id: agent_id || null,
        workspace_id: wsId,
        memory_type,
        content,
        relevance_score: importance,
        source: 'self_edit',
        metadata: { created_by: 'agent', importance },
      }).select('id').single() as { data: { id: string } | null; error: { message: string } | null };
      if (error) throw new Error(error.message);

      return jsonResponse(req, { success: true, memory_id: mem?.id, message: `Memória salva (${memory_type})` });
    }

    if (tool === 'memory_search') {
      const parsed = searchParams.safeParse(params);
      if (!parsed.success) return errorResponse(req, 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      const { query, memory_type, limit } = parsed.data;

      let q = (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories').select('id, content, memory_type, relevance_score, created_at, metadata')
        .or(`agent_id.eq.${agent_id || '00000000-0000-0000-0000-000000000000'},agent_id.is.null`)
        .eq('workspace_id', wsId)
        .order('relevance_score', { ascending: false })
        .limit(limit) as unknown as { eq: (k: string, v: string) => unknown; ilike: (k: string, v: string) => unknown };

      if (memory_type) q = q.eq('memory_type', memory_type) as typeof q;
      q = q.ilike('content', `%${query}%`) as typeof q;

      const { data: memories } = await (q as unknown as Promise<{ data: unknown[] | null }>);
      return jsonResponse(req, { memories: memories || [], count: (memories as unknown[])?.length || 0 });
    }

    if (tool === 'memory_update') {
      const parsed = updateParams.safeParse(params);
      if (!parsed.success) return errorResponse(req, 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });
      const { memory_id, new_content } = parsed.data;

      await (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories').update({ content: new_content, updated_at: new Date().toISOString() }).eq('id', memory_id);
      return jsonResponse(req, { success: true, message: 'Memória atualizada' });
    }

    if (tool === 'memory_forget') {
      const parsed = forgetParams.safeParse(params);
      if (!parsed.success) return errorResponse(req, 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });

      await (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories').delete().eq('id', parsed.data.memory_id);
      return jsonResponse(req, { success: true, message: 'Memória removida' });
    }

    if (tool === 'memory_compact') {
      const parsed = compactParams.safeParse(params);
      if (!parsed.success) return errorResponse(req, 'Validation failed', 400, { details: parsed.error.flatten().fieldErrors });

      const { data: episodic } = await (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories')
        .select('id, content, created_at')
        .eq('agent_id', agent_id)
        .eq('memory_type', 'episodic')
        .order('created_at', { ascending: true })
        .limit(20) as unknown as { data: Array<{ id: string; content: string; created_at: string }> | null };

      if (!episodic || episodic.length < 5) {
        return jsonResponse(req, { success: false, message: 'Not enough memories to compact (need 5+)' });
      }

      const summaryResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize these episodic memories into key facts and patterns. Output as a numbered list of factual statements.' },
            { role: 'user', content: episodic.map((m: { content: string }) => `- ${m.content}`).join('\n') },
          ],
          temperature: 0.3, max_tokens: 500,
        }),
      });
      const summaryData = await summaryResp.json();
      const summary = summaryData.content || '';

      if (summary) {
        await (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories').insert({
          agent_id, workspace_id: wsId,
          memory_type: 'semantic',
          content: summary,
          relevance_score: 0.8,
          source: 'compaction',
          metadata: { compacted_from: episodic.map((m: { id: string }) => m.id), original_count: episodic.length },
        });
        const idsToDelete = episodic.map((m: { id: string }) => m.id);
        await (supabase as unknown as { from: (t: string) => unknown }).from('agent_memories').delete().in('id', idsToDelete);
      }

      return jsonResponse(req, { success: true, compacted: episodic.length, summary_preview: summary.substring(0, 200) });
    }

    return errorResponse(req, 'Unknown tool. Valid: memory_save, memory_search, memory_update, memory_forget, memory_compact', 400);

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
