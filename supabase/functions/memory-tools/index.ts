import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

/**
 * Memory Tools Edge Function — MemGPT/Letta pattern
 * 
 * Agents with self_editing_memory: true in config get these tools injected into their system prompt.
 * The LLM generates tool_calls which this function executes.
 * 
 * Tools: memory_save, memory_search, memory_update, memory_forget, memory_compact
 */
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
    const { tool, params, agent_id } = body;
    // tool: 'memory_save' | 'memory_search' | 'memory_update' | 'memory_forget' | 'memory_compact'

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    if (tool === 'memory_save') {
      const { content, memory_type, importance } = params;
      if (!content) return new Response(JSON.stringify({ error: 'content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const { data: mem, error } = await (supabase as any).from('agent_memories').insert({
        agent_id: agent_id || null,
        workspace_id: wsId,
        memory_type: memory_type || 'episodic',
        content,
        relevance_score: importance || 0.5,
        source: 'self_edit',
        metadata: { created_by: 'agent', importance: importance || 0.5 },
      }).select('id').single();
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, memory_id: mem.id, message: `Memória salva (${memory_type || 'episodic'})` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (tool === 'memory_search') {
      const { query, memory_type, limit } = params;
      if (!query) return new Response(JSON.stringify({ error: 'query required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      let q = (supabase as any).from('agent_memories').select('id, content, memory_type, relevance_score, created_at, metadata')
        .or(`agent_id.eq.${agent_id || '00000000-0000-0000-0000-000000000000'},agent_id.is.null`)
        .eq('workspace_id', wsId)
        .order('relevance_score', { ascending: false })
        .limit(limit || 10);

      if (memory_type) q = q.eq('memory_type', memory_type);

      // Text search via ilike (simple but effective for small datasets)
      q = q.ilike('content', `%${query}%`);

      const { data: memories } = await q;
      return new Response(JSON.stringify({ memories: memories || [], count: memories?.length || 0 }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (tool === 'memory_update') {
      const { memory_id, new_content } = params;
      if (!memory_id || !new_content) return new Response(JSON.stringify({ error: 'memory_id and new_content required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await (supabase as any).from('agent_memories').update({ content: new_content, updated_at: new Date().toISOString() }).eq('id', memory_id);
      return new Response(JSON.stringify({ success: true, message: 'Memória atualizada' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (tool === 'memory_forget') {
      const { memory_id } = params;
      if (!memory_id) return new Response(JSON.stringify({ error: 'memory_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      await (supabase as any).from('agent_memories').delete().eq('id', memory_id);
      return new Response(JSON.stringify({ success: true, message: 'Memória removida' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (tool === 'memory_compact') {
      // Compaction: summarize old episodic memories into semantic memories
      const { data: episodic } = await (supabase as any).from('agent_memories')
        .select('id, content, created_at')
        .eq('agent_id', agent_id)
        .eq('memory_type', 'episodic')
        .order('created_at', { ascending: true })
        .limit(20);

      if (!episodic || episodic.length < 5) {
        return new Response(JSON.stringify({ success: false, message: 'Not enough memories to compact (need 5+)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Call LLM to summarize
      const summaryResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Summarize these episodic memories into key facts and patterns. Output as a numbered list of factual statements.' },
            { role: 'user', content: episodic.map((m: any) => `- ${m.content}`).join('\n') },
          ],
          temperature: 0.3, max_tokens: 500,
        }),
      });
      const summaryData = await summaryResp.json();
      const summary = summaryData.content || '';

      if (summary) {
        // Create semantic memory from summary
        await (supabase as any).from('agent_memories').insert({
          agent_id, workspace_id: wsId,
          memory_type: 'semantic',
          content: summary,
          relevance_score: 0.8,
          source: 'compaction',
          metadata: { compacted_from: episodic.map((m: any) => m.id), original_count: episodic.length },
        });
        // Delete compacted episodic memories
        const idsToDelete = episodic.map((m: any) => m.id);
        await (supabase as any).from('agent_memories').delete().in('id', idsToDelete);
      }

      return new Response(JSON.stringify({ success: true, compacted: episodic.length, summary_preview: summary.substring(0, 200) }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown tool. Valid: memory_save, memory_search, memory_update, memory_forget, memory_compact' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
