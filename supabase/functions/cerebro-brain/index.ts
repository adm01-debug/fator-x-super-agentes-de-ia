import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const workspaceId = member?.workspace_id;

    // ═══ ACTION: knowledge_graph — build entity relationships ═══
    if (action === 'knowledge_graph') {
      const nodes: any[] = [];
      const edges: any[] = [];

      // Agents as nodes
      const { data: agents } = await supabase.from('agents').select('id, name, avatar_emoji, model, status, tags');
      for (const a of (agents || [])) {
        nodes.push({ id: a.id, type: 'agent', label: a.name, emoji: a.avatar_emoji, status: a.status, tags: a.tags });
      }

      // Knowledge bases as nodes
      const { data: kbs } = await supabase.from('knowledge_bases').select('id, name, document_count, chunk_count, status');
      for (const kb of (kbs || [])) {
        nodes.push({ id: kb.id, type: 'knowledge_base', label: kb.name, docs: kb.document_count, chunks: kb.chunk_count, status: kb.status });
      }

      // Tools as nodes
      const { data: tools } = await supabase.from('tool_integrations').select('id, name, type, is_enabled');
      for (const t of (tools || [])) {
        nodes.push({ id: t.id, type: 'tool', label: t.name, toolType: t.type, enabled: t.is_enabled });
      }

      // Workflows as nodes
      const { data: workflows } = await supabase.from('workflows').select('id, name, status');
      for (const w of (workflows || [])) {
        nodes.push({ id: w.id, type: 'workflow', label: w.name, status: w.status });
      }

      // Edges: workflow_steps connect agents to workflows
      const { data: steps } = await supabase.from('workflow_steps').select('workflow_id, agent_id, name');
      for (const s of (steps || [])) {
        if (s.agent_id && s.workflow_id) {
          edges.push({ source: s.agent_id, target: s.workflow_id, label: s.name, type: 'participates' });
        }
      }

      // Edges: tool_policies connect agents to tools
      const { data: policies } = await supabase.from('tool_policies').select('agent_id, tool_integration_id, is_allowed');
      for (const p of (policies || [])) {
        if (p.agent_id && p.tool_integration_id) {
          edges.push({ source: p.agent_id, target: p.tool_integration_id, label: p.is_allowed ? 'uses' : 'blocked', type: 'tool_access' });
        }
      }

      return new Response(JSON.stringify({ nodes, edges }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: knowledge_health — decay detection + freshness ═══
    if (action === 'knowledge_health') {
      const now = new Date();
      const items: any[] = [];

      // Check knowledge bases freshness
      const { data: kbs } = await supabase.from('knowledge_bases').select('id, name, updated_at, document_count, chunk_count');
      for (const kb of (kbs || [])) {
        const daysSinceUpdate = Math.floor((now.getTime() - new Date(kb.updated_at).getTime()) / 86400000);
        let freshness = 'fresh';
        if (daysSinceUpdate > 30) freshness = 'stale';
        else if (daysSinceUpdate > 7) freshness = 'aging';
        items.push({ id: kb.id, type: 'knowledge_base', name: kb.name, daysSinceUpdate, freshness, docs: kb.document_count, chunks: kb.chunk_count });
      }

      // Check agents without recent activity
      const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
      const { data: agents } = await supabase.from('agents').select('id, name, updated_at, status');
      for (const a of (agents || [])) {
        const daysSinceUpdate = Math.floor((now.getTime() - new Date(a.updated_at).getTime()) / 86400000);
        let freshness = 'fresh';
        if (daysSinceUpdate > 14) freshness = 'stale';
        else if (daysSinceUpdate > 3) freshness = 'aging';
        items.push({ id: a.id, type: 'agent', name: a.name, daysSinceUpdate, freshness, status: a.status });
      }

      // Check chunks with pending embeddings
      const { count: pendingChunks } = await supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'pending');
      const { count: failedChunks } = await supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'failed');
      const { count: doneChunks } = await supabase.from('chunks').select('id', { count: 'exact', head: true }).eq('embedding_status', 'done');

      // Gaps: domains without knowledge
      const gaps: string[] = [];
      const { count: docCount } = await supabase.from('documents').select('id', { count: 'exact', head: true });
      if (!docCount || docCount === 0) gaps.push('Nenhum documento na base de conhecimento');
      if (!kbs || kbs.length === 0) gaps.push('Nenhuma base de conhecimento criada');

      const { count: toolCount } = await supabase.from('tool_integrations').select('id', { count: 'exact', head: true });
      if (!toolCount || toolCount === 0) gaps.push('Nenhuma ferramenta integrada');

      const staleItems = items.filter(i => i.freshness === 'stale');
      if (staleItems.length > 0) gaps.push(`${staleItems.length} itens desatualizados (>14 dias sem mudança)`);

      return new Response(JSON.stringify({
        items,
        chunks: { pending: pendingChunks || 0, failed: failedChunks || 0, done: doneChunks || 0 },
        gaps,
        summary: {
          total: items.length,
          fresh: items.filter(i => i.freshness === 'fresh').length,
          aging: items.filter(i => i.freshness === 'aging').length,
          stale: items.filter(i => i.freshness === 'stale').length,
        }
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: auto_extract — LLM-powered extraction from text ═══
    if (action === 'auto_extract') {
      const { text, extract_type } = body;
      if (!text) return new Response(JSON.stringify({ error: 'text required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      const extractPrompts: Record<string, string> = {
        entities: 'Extraia todas as entidades (pessoas, empresas, produtos, locais) do texto. Retorne em formato de lista com tipo e nome.',
        facts: 'Extraia todos os fatos e informações concretas do texto. Retorne como lista de afirmações objetivas.',
        rules: 'Extraia todas as regras de negócio, políticas e procedimentos do texto. Retorne como lista de regras claras.',
        contacts: 'Extraia todos os contatos (telefones, emails, endereços, nomes) do texto. Retorne de forma estruturada.',
      };

      const prompt = extractPrompts[extract_type || 'entities'] || extractPrompts.entities;

      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `Você é um especialista em extração de informações. ${prompt}` },
            { role: 'user', content: text },
          ],
          temperature: 0.2, max_tokens: 2000,
        }),
      });
      const result = await resp.json();

      return new Response(JSON.stringify({
        extracted: result.content || result.error,
        type: extract_type || 'entities',
        tokens: result.tokens,
        cost_usd: result.cost_usd,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: expert_discovery — find who knows what ═══
    if (action === 'expert_discovery') {
      const experts: any[] = [];

      // Agents as domain experts based on their config
      const { data: agents } = await supabase.from('agents').select('id, name, avatar_emoji, mission, tags, config, status');
      for (const a of (agents || [])) {
        const config = (a.config || {}) as Record<string, any>;
        const domains: string[] = [];
        if (a.tags?.length) domains.push(...a.tags);
        if (config.rag_knowledge_bases?.length) domains.push('RAG');
        if (config.tools?.length) domains.push(`${config.tools.length} ferramentas`);
        if (config.memory_types?.length) domains.push('Memória avançada');

        experts.push({
          id: a.id,
          name: a.name,
          emoji: a.avatar_emoji,
          type: 'agent',
          mission: a.mission,
          domains,
          status: a.status,
          toolCount: config.tools?.length || 0,
          hasRAG: !!(config.rag_knowledge_bases?.length),
        });
      }

      // Workspace members as human experts
      const { data: members } = await supabase.from('workspace_members').select('id, name, email, role');
      for (const m of (members || [])) {
        experts.push({
          id: m.id,
          name: m.name || m.email?.split('@')[0] || 'Membro',
          emoji: '👤',
          type: 'human',
          role: m.role,
          domains: [m.role || 'editor'],
        });
      }

      return new Response(JSON.stringify({ experts }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: brain_sandbox — test a query against different contexts ═══
    if (action === 'brain_sandbox') {
      const { query, context_mode } = body;
      if (!query) return new Response(JSON.stringify({ error: 'query required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

      let contextParts: string[] = [];

      if (context_mode === 'facts_only' || context_mode === 'full') {
        const { count: agentCount } = await supabase.from('agents').select('id', { count: 'exact', head: true });
        const { count: kbCount } = await supabase.from('knowledge_bases').select('id', { count: 'exact', head: true });
        contextParts.push(`Fatos: ${agentCount || 0} agentes, ${kbCount || 0} bases de conhecimento`);
      }

      if (context_mode === 'rag_only' || context_mode === 'full') {
        const { data: chunks } = await supabase.from('chunks').select('content').eq('embedding_status', 'done').limit(10);
        if (chunks?.length) {
          contextParts.push('RAG:\n' + chunks.map((c: any) => c.content).join('\n---\n').substring(0, 2000));
        }
      }

      if (context_mode === 'no_context') {
        contextParts = ['Sem contexto adicional. Responda apenas com seu conhecimento geral.'];
      }

      const systemPrompt = `Você é o Super Cérebro (modo sandbox). Contexto disponível:\n${contextParts.join('\n\n')}\n\nResponda a pergunta do usuário.`;

      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: query }],
          temperature: 0.3, max_tokens: 3000,
        }),
      });
      const result = await resp.json();

      return new Response(JSON.stringify({
        response: result.content || result.error,
        context_mode,
        context_size: contextParts.join('').length,
        tokens: result.tokens,
        cost_usd: result.cost_usd,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ═══ ACTION: stats — overview statistics ═══
    if (action === 'stats') {
      const [agents, kbs, chunks, traces, memories, tools, workflows] = await Promise.all([
        supabase.from('agents').select('id', { count: 'exact', head: true }),
        supabase.from('knowledge_bases').select('id', { count: 'exact', head: true }),
        supabase.from('chunks').select('id', { count: 'exact', head: true }),
        supabase.from('agent_traces').select('id', { count: 'exact', head: true }),
        supabase.from('agent_memories').select('id', { count: 'exact', head: true }),
        supabase.from('tool_integrations').select('id', { count: 'exact', head: true }),
        supabase.from('workflows').select('id', { count: 'exact', head: true }),
      ]);

      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const { count: todayTraces } = await supabase.from('agent_traces').select('id', { count: 'exact', head: true }).gte('created_at', yesterday);

      return new Response(JSON.stringify({
        agents: agents.count || 0,
        knowledge_bases: kbs.count || 0,
        chunks: chunks.count || 0,
        traces: traces.count || 0,
        memories: memories.count || 0,
        tools: tools.count || 0,
        workflows: workflows.count || 0,
        today_traces: todayTraces || 0,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
