import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

/**
 * Workflow Engine v2 — Graph-Based Orchestration
 * 
 * Supports: sequential, conditional branching, parallel execution, cycles (with max iterations),
 * checkpointing (resume from failure), and human-in-the-loop approval gates.
 * 
 * Graph format (stored as JSONB in workflows.config):
 * {
 *   nodes: [{ id, type, label, config }],
 *   edges: [{ from, to, condition? }],
 *   entry_node: "node_id"
 * }
 * 
 * Node types: 'llm_call', 'tool_call', 'conditional', 'parallel', 'hitl_gate', 'end'
 */

interface GraphNode {
  id: string;
  type: 'llm_call' | 'tool_call' | 'conditional' | 'parallel' | 'hitl_gate' | 'end';
  label: string;
  config: Record<string, any>;
}

interface GraphEdge {
  from: string;
  to: string;
  condition?: string; // JS expression evaluated against state, e.g. "state.sentiment === 'negative'"
  label?: string;
}

interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entry_node: string;
}

interface WorkflowState {
  [key: string]: any;
  _current_node: string;
  _history: string[];
  _iteration_count: Record<string, number>;
  _output: string;
}

const MAX_ITERATIONS = 10; // prevent infinite loops
const STEP_TIMEOUT_MS = 30000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { workflow_id, input, resume_run_id } = body;

    // Load workflow
    const { data: workflow } = await (supabase as any).from('workflows').select('*').eq('id', workflow_id).single();
    if (!workflow) return new Response(JSON.stringify({ error: 'Workflow not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const config = workflow.config as Record<string, any>;
    const graph: WorkflowGraph = {
      nodes: config.nodes || [],
      edges: config.edges || [],
      entry_node: config.entry_node || config.nodes?.[0]?.id || '',
    };

    // If no graph nodes, fall back to sequential steps
    if (graph.nodes.length === 0) {
      const { data: steps } = await (supabase as any).from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order', { ascending: true });
      if (steps && steps.length > 0) {
        // Convert sequential steps to graph format
        for (let i = 0; i < steps.length; i++) {
          graph.nodes.push({ id: `step_${i}`, type: 'llm_call', label: steps[i].name, config: { role: steps[i].role, agent_id: steps[i].agent_id } });
          if (i > 0) graph.edges.push({ from: `step_${i - 1}`, to: `step_${i}` });
        }
        graph.nodes.push({ id: 'end', type: 'end', label: 'End', config: {} });
        graph.edges.push({ from: `step_${steps.length - 1}`, to: 'end' });
        graph.entry_node = 'step_0';
      }
    }

    if (graph.nodes.length === 0) return new Response(JSON.stringify({ error: 'No nodes in workflow' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Initialize or resume state
    let state: WorkflowState;
    let runId: string;

    if (resume_run_id) {
      const { data: existingRun } = await (supabase as any).from('workflow_runs').select('*').eq('id', resume_run_id).single();
      if (!existingRun) return new Response(JSON.stringify({ error: 'Run not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      state = (existingRun.output as any)?.state || { _current_node: graph.entry_node, _history: [], _iteration_count: {}, _output: '', input };
      runId = existingRun.id;
      await (supabase as any).from('workflow_runs').update({ status: 'running' }).eq('id', runId);
    } else {
      state = { _current_node: graph.entry_node, _history: [], _iteration_count: {}, _output: '', input };
      const { data: run } = await (supabase as any).from('workflow_runs').insert({
        workflow_id, input: { text: input }, status: 'running', total_steps: graph.nodes.length,
      }).select('id').single();
      runId = run?.id || '';
    }

    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    let totalTokens = 0, totalCost = 0, stepsExecuted = 0;

    // ═══ GRAPH EXECUTION LOOP ═══
    while (state._current_node && state._current_node !== '') {
      const node = graph.nodes.find(n => n.id === state._current_node);
      if (!node || node.type === 'end') break;

      // Cycle detection
      const iterKey = node.id;
      state._iteration_count[iterKey] = (state._iteration_count[iterKey] || 0) + 1;
      if (state._iteration_count[iterKey] > MAX_ITERATIONS) {
        await (supabase as any).from('workflow_runs').update({ status: 'failed', error: `Max iterations (${MAX_ITERATIONS}) reached at node "${node.label}"`, output: { state } }).eq('id', runId);
        return new Response(JSON.stringify({ error: `Cycle limit reached at "${node.label}"`, run_id: runId }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      state._history.push(node.id);
      const stepStart = Date.now();

      try {
        // ═══ EXECUTE NODE ═══
        if (node.type === 'llm_call') {
          const model = node.config.model || workflow.model || 'claude-sonnet-4-20250514';
          const systemPrompt = node.config.system_prompt || `You are "${node.label}" in a workflow. ${node.config.role || ''}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);

          const resp = await fetch(gatewayUrl, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: state._output || state.input || '' }], temperature: node.config.temperature || 0.7, max_tokens: node.config.max_tokens || 2000 }),
          });
          clearTimeout(timeout);

          const result = await resp.json();
          state._output = result.content || '';
          state[`${node.id}_output`] = state._output;
          totalTokens += result.tokens?.total || 0;
          totalCost += result.cost_usd || 0;

        } else if (node.type === 'parallel') {
          // Execute all outgoing edges in parallel
          const outEdges = graph.edges.filter(e => e.from === node.id);
          const parallelNodes = outEdges.map(e => graph.nodes.find(n => n.id === e.to)).filter(Boolean) as GraphNode[];

          const results = await Promise.allSettled(parallelNodes.map(async (pNode) => {
            if (pNode.type !== 'llm_call') return '';
            const model = pNode.config.model || 'claude-sonnet-4-20250514';
            const resp = await fetch(gatewayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
              body: JSON.stringify({ model, messages: [{ role: 'system', content: pNode.config.system_prompt || pNode.label }, { role: 'user', content: state._output || state.input }], temperature: 0.7, max_tokens: 2000 }),
            });
            const r = await resp.json();
            totalTokens += r.tokens?.total || 0;
            totalCost += r.cost_usd || 0;
            state[`${pNode.id}_output`] = r.content || '';
            return r.content || '';
          }));

          state._output = results.map((r, i) => `[${parallelNodes[i]?.label}] ${r.status === 'fulfilled' ? r.value : 'FAILED'}`).join('\n\n');
          // Skip normal edge resolution for parallel — outputs already set
          const convergeNode = graph.edges.find(e => parallelNodes.some(pn => graph.edges.some(pe => pe.from === pn.id && pe.to === e.to)));
          if (convergeNode) { state._current_node = convergeNode.to; stepsExecuted++; continue; }

        } else if (node.type === 'conditional') {
          // Evaluate conditions on outgoing edges
          const outEdges = graph.edges.filter(e => e.from === node.id);
          let nextNode: string | null = null;

          for (const edge of outEdges) {
            if (edge.condition) {
              try {
                const evalResult = new Function('state', `return ${edge.condition}`)(state);
                if (evalResult) { nextNode = edge.to; break; }
              } catch { /* condition failed, try next */ }
            }
          }
          // Default: first edge without condition, or first edge
          if (!nextNode) {
            const defaultEdge = outEdges.find(e => !e.condition) || outEdges[0];
            nextNode = defaultEdge?.to || null;
          }

          state._current_node = nextNode || '';
          stepsExecuted++;

          // Checkpoint
          await (supabase as any).from('workflow_runs').update({ current_step: stepsExecuted, output: { state: { ...state, _history: state._history.slice(-20) } } }).eq('id', runId);
          continue;

        } else if (node.type === 'hitl_gate') {
          // Pause execution, wait for human approval
          await (supabase as any).from('workflow_runs').update({
            status: 'awaiting_approval', current_step: stepsExecuted,
            output: { state, pending_approval: { node_id: node.id, label: node.label, context: state._output?.substring(0, 500) } },
          }).eq('id', runId);

          return new Response(JSON.stringify({
            status: 'awaiting_approval', run_id: runId,
            pending_node: node.label, context: state._output?.substring(0, 200),
            message: 'Workflow paused. Call with resume_run_id to continue after approval.',
          }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        stepsExecuted++;

        // Record step run
        await (supabase as any).from('workflow_step_runs').insert({
          workflow_run_id: runId, step_order: stepsExecuted,
          status: 'completed', input: { context: (state._output || '').substring(0, 500) },
          output: { result: state[`${node.id}_output`]?.substring(0, 1000) || '' },
          latency_ms: Date.now() - stepStart,
        }).catch(() => {});

        // Checkpoint state
        await (supabase as any).from('workflow_runs').update({ current_step: stepsExecuted, output: { state: { ...state, _history: state._history.slice(-20) } } }).eq('id', runId);

      } catch (err) {
        await (supabase as any).from('workflow_step_runs').insert({
          workflow_run_id: runId, step_order: stepsExecuted,
          status: 'failed', error: (err as Error).message, latency_ms: Date.now() - stepStart,
        }).catch(() => {});
        await (supabase as any).from('workflow_runs').update({ status: 'failed', error: `Node "${node.label}" failed: ${(err as Error).message}`, output: { state } }).eq('id', runId);
        return new Response(JSON.stringify({ error: `Node "${node.label}" failed`, details: (err as Error).message, run_id: runId, steps_executed: stepsExecuted }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // ═══ RESOLVE NEXT NODE via edges ═══
      if (node.type !== 'conditional' && node.type !== 'parallel') {
        const outEdges = graph.edges.filter(e => e.from === node.id);
        if (outEdges.length === 0) break; // No outgoing edges = end
        // If conditional edges exist, evaluate
        let nextNode: string | null = null;
        for (const edge of outEdges) {
          if (edge.condition) {
            try { if (new Function('state', `return ${edge.condition}`)(state)) { nextNode = edge.to; break; } } catch {}
          }
        }
        if (!nextNode) nextNode = outEdges.find(e => !e.condition)?.to || outEdges[0]?.to || null;
        state._current_node = nextNode || '';
      }
    }

    // ═══ COMPLETE ═══
    await (supabase as any).from('workflow_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      total_tokens: totalTokens, total_cost_usd: totalCost,
      current_step: stepsExecuted, output: { result: state._output, state: { _history: state._history } },
    }).eq('id', runId);

    return new Response(JSON.stringify({
      status: 'completed', run_id: runId,
      steps_executed: stepsExecuted, total_tokens: totalTokens,
      total_cost_usd: Math.round(totalCost * 1000000) / 1000000,
      output: state._output?.substring(0, 2000),
      node_outputs: Object.fromEntries(Object.entries(state).filter(([k]) => k.endsWith('_output') && !k.startsWith('_')).map(([k, v]) => [k, (v as string)?.substring(0, 500)])),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
