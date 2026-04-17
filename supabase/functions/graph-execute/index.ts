// Multi-Agent Graph Executor (LangGraph-style BFS)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MAX_NODES = 15;
const LOVABLE_KEY = Deno.env.get('LOVABLE_API_KEY')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

interface GraphNode { id: string; agent_id?: string | null; role?: string; label?: string; position?: { x: number; y: number } }
interface GraphEdge { from: string; to: string; condition?: string }

async function callLLM(systemPrompt: string, userInput: string): Promise<{ text: string; latency: number; cost_cents: number }> {
  const start = Date.now();
  const res = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${LOVABLE_KEY}` },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userInput },
      ],
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error ${res.status}: ${text}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content ?? '';
  const tokens = (data.usage?.total_tokens ?? 0);
  return { text, latency: Date.now() - start, cost_cents: Math.ceil(tokens * 0.0002) };
}

async function chooseNextNode(currentOutput: string, candidates: { node: GraphNode; condition?: string }[]): Promise<string> {
  if (candidates.length === 0) return '';
  if (candidates.length === 1) return candidates[0].node.id;
  const prompt = `Based on the previous agent output, decide which path to take next. Reply ONLY with the chosen node id.\n\nPrevious output: ${currentOutput.slice(0, 800)}\n\nOptions:\n${candidates.map(c => `- ${c.node.id} (${c.node.label || c.node.role || 'node'})${c.condition ? ': ' + c.condition : ''}`).join('\n')}`;
  const { text } = await callLLM('You are a routing decision engine. Reply with exactly one node id from the list.', prompt);
  const cleaned = text.trim().replace(/[`"']/g, '').split(/\s|\n/)[0];
  return candidates.find(c => c.node.id === cleaned)?.node.id ?? candidates[0].node.id;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const auth = req.headers.get('Authorization');
    if (!auth) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
    const userClient = createClient(SUPABASE_URL, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData?.user;
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { graph_id, input } = await req.json();
    if (!graph_id || typeof input !== 'string') {
      return new Response(JSON.stringify({ error: 'graph_id and input required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: graph, error: ge } = await supabase.from('agent_graphs').select('*').eq('id', graph_id).single();
    if (ge || !graph) return new Response(JSON.stringify({ error: 'Graph not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const nodes: GraphNode[] = graph.nodes || [];
    const edges: GraphEdge[] = graph.edges || [];
    const entryId: string = graph.entry_node_id || nodes[0]?.id;
    if (!entryId) return new Response(JSON.stringify({ error: 'Graph has no entry node' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Create execution record
    const { data: exec, error: ee } = await supabase.from('graph_executions').insert({
      graph_id, user_id: user.id, workspace_id: graph.workspace_id, input, status: 'running', current_node_id: entryId,
    }).select().single();
    if (ee || !exec) throw new Error('Failed to create execution: ' + ee?.message);

    // Pre-fetch agents
    const agentIds = [...new Set(nodes.map(n => n.agent_id).filter(Boolean))] as string[];
    const { data: agents } = agentIds.length
      ? await supabase.from('agents').select('id, name, persona, mission').in('id', agentIds)
      : { data: [] };
    const agentMap = new Map((agents || []).map(a => [a.id, a]));

    const trace: any[] = [];
    let totalCost = 0;
    let currentNodeId = entryId;
    let currentInput = input;
    let finalOutput = '';
    let stepCount = 0;

    while (currentNodeId && stepCount < MAX_NODES) {
      stepCount++;
      const node = nodes.find(n => n.id === currentNodeId);
      if (!node) break;
      const agent = node.agent_id ? agentMap.get(node.agent_id) : null;
      const systemPrompt = agent
        ? `You are ${agent.name}. ${agent.persona || ''}\nMission: ${agent.mission || ''}\nRole in workflow: ${node.role || node.label || 'agent'}`
        : `You are an agent in a multi-agent workflow. Role: ${node.role || node.label || 'process input'}`;

      const { text, latency, cost_cents } = await callLLM(systemPrompt, currentInput);
      totalCost += cost_cents;
      trace.push({
        node_id: node.id,
        agent_id: node.agent_id ?? null,
        agent_name: agent?.name ?? node.label ?? node.id,
        input: currentInput.slice(0, 2000),
        output: text,
        latency_ms: latency,
        cost_cents,
        ts: new Date().toISOString(),
      });

      // Persist incremental progress
      await supabase.from('graph_executions').update({
        trace, current_node_id: currentNodeId, total_cost_cents: totalCost,
      }).eq('id', exec.id);

      // Find next node(s)
      const outgoing = edges.filter(e => e.from === currentNodeId);
      if (outgoing.length === 0) {
        finalOutput = text;
        break;
      }
      const candidates = outgoing.map(e => ({ node: nodes.find(n => n.id === e.to)!, condition: e.condition })).filter(c => c.node);
      currentNodeId = await chooseNextNode(text, candidates);
      currentInput = text;
    }

    if (!finalOutput) finalOutput = trace[trace.length - 1]?.output || '';
    await supabase.from('graph_executions').update({
      status: 'completed', final_output: finalOutput, ended_at: new Date().toISOString(), trace, total_cost_cents: totalCost,
    }).eq('id', exec.id);

    return new Response(JSON.stringify({ execution_id: exec.id, final_output: finalOutput, steps: trace.length, total_cost_cents: totalCost }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('graph-execute error:', e);
    return new Response(JSON.stringify({ error: String(e?.message || e) }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
