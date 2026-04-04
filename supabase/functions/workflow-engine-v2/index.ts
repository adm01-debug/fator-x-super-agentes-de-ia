import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const RequestSchema = z.object({
  workflow_id: z.string().uuid(),
  input: z.string().max(10000).optional().default(''),
  resume_run_id: z.string().uuid().optional(),
});

interface GraphNode {
  id: string;
  type: 'llm_call' | 'tool_call' | 'conditional' | 'parallel' | 'hitl_gate' | 'end';
  label: string;
  config: Record<string, unknown>;
}

interface GraphEdge {
  from: string;
  to: string;
  condition?: string;
  label?: string;
}

interface WorkflowGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entry_node: string;
}

interface WorkflowState {
  [key: string]: unknown;
  _current_node: string;
  _history: string[];
  _iteration_count: Record<string, number>;
  _output: string;
  input: string;
}

const MAX_ITERATIONS = 10;
const STEP_TIMEOUT_MS = 30000;

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const raw = await req.json();
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) return jsonResponse({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors }, 400);

    const { workflow_id, input, resume_run_id } = parsed.data;

    // Load workflow
    const { data: workflow, error: wfError } = await supabase.from('workflows').select('*').eq('id', workflow_id).single();
    if (wfError || !workflow) return jsonResponse({ error: 'Workflow not found' }, 404);

    const config = (workflow.config || {}) as Record<string, unknown>;
    const graph: WorkflowGraph = {
      nodes: (config.nodes as GraphNode[]) || [],
      edges: (config.edges as GraphEdge[]) || [],
      entry_node: (config.entry_node as string) || (config.nodes as GraphNode[])?.[0]?.id || '',
    };

    // If no graph nodes, fall back to sequential steps
    if (graph.nodes.length === 0) {
      const { data: steps } = await supabase.from('workflow_steps').select('*').eq('workflow_id', workflow_id).order('step_order', { ascending: true });
      if (steps && steps.length > 0) {
        for (let i = 0; i < steps.length; i++) {
          graph.nodes.push({ id: `step_${i}`, type: 'llm_call', label: steps[i].name, config: { role: steps[i].role, agent_id: steps[i].agent_id } });
          if (i > 0) graph.edges.push({ from: `step_${i - 1}`, to: `step_${i}` });
        }
        graph.nodes.push({ id: 'end', type: 'end', label: 'End', config: {} });
        graph.edges.push({ from: `step_${steps.length - 1}`, to: 'end' });
        graph.entry_node = 'step_0';
      }
    }

    if (graph.nodes.length === 0) return jsonResponse({ error: 'No nodes in workflow' }, 400);

    // Initialize or resume state
    let state: WorkflowState;
    let runId: string;

    if (resume_run_id) {
      const { data: existingRun } = await supabase.from('workflow_runs').select('*').eq('id', resume_run_id).single();
      if (!existingRun) return jsonResponse({ error: 'Run not found' }, 404);
      const existingOutput = existingRun.output as Record<string, unknown> | null;
      state = (existingOutput?.state as WorkflowState) || { _current_node: graph.entry_node, _history: [], _iteration_count: {}, _output: '', input };
      runId = existingRun.id;
      await supabase.from('workflow_runs').update({ status: 'running' }).eq('id', runId);
    } else {
      state = { _current_node: graph.entry_node, _history: [], _iteration_count: {}, _output: '', input };
      const { data: run } = await supabase.from('workflow_runs').insert({
        workflow_id, status: 'running', total_steps: graph.nodes.length,
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
        await supabase.from('workflow_runs').update({ status: 'failed', error: `Max iterations (${MAX_ITERATIONS}) reached at node "${node.label}"`, output: { state } as unknown as Record<string, unknown> }).eq('id', runId);
        return jsonResponse({ error: `Cycle limit reached at "${node.label}"`, run_id: runId }, 400);
      }

      state._history.push(node.id);
      const stepStart = Date.now();

      try {
        if (node.type === 'llm_call') {
          const model = (node.config.model as string) || 'claude-sonnet-4-20250514';
          const systemPrompt = (node.config.system_prompt as string) || `You are "${node.label}" in a workflow. ${node.config.role || ''}`;
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), STEP_TIMEOUT_MS);

          const resp = await fetch(gatewayUrl, {
            method: 'POST', signal: controller.signal,
            headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
            body: JSON.stringify({ model, messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: (state._output as string) || state.input || '' }], temperature: (node.config.temperature as number) || 0.7, max_tokens: (node.config.max_tokens as number) || 2000 }),
          });
          clearTimeout(timeout);

          const result = await resp.json();
          state._output = result.content || '';
          state[`${node.id}_output`] = state._output;
          totalTokens += result.tokens?.total || 0;
          totalCost += result.cost_usd || 0;

        } else if (node.type === 'parallel') {
          const outEdges = graph.edges.filter(e => e.from === node.id);
          const parallelNodes = outEdges.map(e => graph.nodes.find(n => n.id === e.to)).filter(Boolean) as GraphNode[];

          const results = await Promise.allSettled(parallelNodes.map(async (pNode) => {
            if (pNode.type !== 'llm_call') return '';
            const model = (pNode.config.model as string) || 'claude-sonnet-4-20250514';
            const resp = await fetch(gatewayUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
              body: JSON.stringify({ model, messages: [{ role: 'system', content: (pNode.config.system_prompt as string) || pNode.label }, { role: 'user', content: state._output || state.input }], temperature: 0.7, max_tokens: 2000 }),
            });
            const r = await resp.json();
            totalTokens += r.tokens?.total || 0;
            totalCost += r.cost_usd || 0;
            state[`${pNode.id}_output`] = r.content || '';
            return r.content || '';
          }));

          state._output = results.map((r, i) => `[${parallelNodes[i]?.label}] ${r.status === 'fulfilled' ? r.value : 'FAILED'}`).join('\n\n');
          const convergeNode = graph.edges.find(e => parallelNodes.some(pn => graph.edges.some(pe => pe.from === pn.id && pe.to === e.to)));
          if (convergeNode) { state._current_node = convergeNode.to; stepsExecuted++; continue; }

        } else if (node.type === 'conditional') {
          const outEdges = graph.edges.filter(e => e.from === node.id);
          let nextNode: string | null = null;

          for (const edge of outEdges) {
            if (edge.condition) {
              try {
                const evalResult = new Function('state', `return ${edge.condition}`)(state);
                if (evalResult) { nextNode = edge.to; break; }
              } catch { /* condition failed */ }
            }
          }
          if (!nextNode) {
            const defaultEdge = outEdges.find(e => !e.condition) || outEdges[0];
            nextNode = defaultEdge?.to || null;
          }

          state._current_node = nextNode || '';
          stepsExecuted++;
          await supabase.from('workflow_runs').update({ current_step: stepsExecuted, output: { state: { ...state, _history: state._history.slice(-20) } } as unknown as Record<string, unknown> }).eq('id', runId);
          continue;

        } else if (node.type === 'hitl_gate') {
          await supabase.from('workflow_runs').update({
            status: 'awaiting_approval' as string, current_step: stepsExecuted,
            output: { state, pending_approval: { node_id: node.id, label: node.label, context: (state._output as string)?.substring(0, 500) } } as unknown as Record<string, unknown>,
          }).eq('id', runId);

          return jsonResponse({
            status: 'awaiting_approval', run_id: runId,
            pending_node: node.label, context: (state._output as string)?.substring(0, 200),
            message: 'Workflow paused. Call with resume_run_id to continue after approval.',
          });
        }

        stepsExecuted++;

        // Checkpoint state
        await supabase.from('workflow_runs').update({ current_step: stepsExecuted, output: { state: { ...state, _history: state._history.slice(-20) } } as unknown as Record<string, unknown> }).eq('id', runId);

      } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        await supabase.from('workflow_runs').update({ status: 'failed', error: `Node "${node.label}" failed: ${errMsg}`, output: { state } as unknown as Record<string, unknown> }).eq('id', runId);
        return jsonResponse({ error: `Node "${node.label}" failed`, details: errMsg, run_id: runId, steps_executed: stepsExecuted }, 500);
      }

      // Resolve next node via edges
      if (node.type !== 'conditional' && node.type !== 'parallel') {
        const outEdges = graph.edges.filter(e => e.from === node.id);
        if (outEdges.length === 0) break;
        let nextNode: string | null = null;
        for (const edge of outEdges) {
          if (edge.condition) {
            try { if (new Function('state', `return ${edge.condition}`)(state)) { nextNode = edge.to; break; } } catch { /* skip */ }
          }
        }
        if (!nextNode) nextNode = outEdges.find(e => !e.condition)?.to || outEdges[0]?.to || null;
        state._current_node = nextNode || '';
      }
    }

    // Complete
    await supabase.from('workflow_runs').update({
      status: 'completed', completed_at: new Date().toISOString(),
      current_step: stepsExecuted, output: { result: state._output, state: { _history: state._history } } as unknown as Record<string, unknown>,
    }).eq('id', runId);

    return jsonResponse({
      status: 'completed', run_id: runId,
      steps_executed: stepsExecuted, total_tokens: totalTokens,
      total_cost_usd: Math.round(totalCost * 1000000) / 1000000,
      output: (state._output as string)?.substring(0, 2000),
      node_outputs: Object.fromEntries(Object.entries(state).filter(([k]) => k.endsWith('_output') && !k.startsWith('_')).map(([k, v]) => [k, (v as string)?.substring(0, 500)])),
    });

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
