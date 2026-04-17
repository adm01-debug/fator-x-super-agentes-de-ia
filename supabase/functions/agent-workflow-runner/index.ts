import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { startEdgeTrace } from '../_shared/otel.ts';
import { maybeInjectFault, applyFault } from '../_shared/chaos.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, traceparent',
};

interface WFNode { id: string; type: string; data: Record<string, any> }
interface WFEdge { source: string; target: string }

function topoSort(nodes: WFNode[], edges: WFEdge[]): WFNode[] {
  const indeg = new Map<string, number>();
  const adj = new Map<string, string[]>();
  nodes.forEach((n) => { indeg.set(n.id, 0); adj.set(n.id, []); });
  edges.forEach((e) => {
    adj.get(e.source)?.push(e.target);
    indeg.set(e.target, (indeg.get(e.target) || 0) + 1);
  });
  const queue: string[] = [];
  indeg.forEach((d, id) => { if (d === 0) queue.push(id); });
  const order: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    order.push(id);
    for (const next of adj.get(id) || []) {
      indeg.set(next, (indeg.get(next) || 0) - 1);
      if (indeg.get(next) === 0) queue.push(next);
    }
  }
  const map = new Map(nodes.map((n) => [n.id, n]));
  return order.map((id) => map.get(id)!).filter(Boolean);
}

async function executeNode(node: WFNode, ctx: Record<string, any>, supa: any, lovableKey: string): Promise<any> {
  switch (node.type) {
    case 'trigger':
      return ctx.__input;
    case 'agent': {
      const agentId = node.data?.agent_id;
      if (!agentId) return { error: 'agent_id ausente' };
      const { data: agent } = await supa.from('agents').select('*').eq('id', agentId).single();
      if (!agent) return { error: 'agent não encontrado' };
      const lastInput = Object.values(ctx).filter((v) => v !== undefined).pop() ?? ctx.__input;
      const messages = [
        { role: 'system', content: agent.config?.system_prompt || `Você é ${agent.name}.` },
        { role: 'user', content: typeof lastInput === 'string' ? lastInput : JSON.stringify(lastInput) },
      ];
      const r = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${lovableKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: agent.model || 'google/gemini-2.5-flash', messages }),
      });
      const j = await r.json();
      return j.choices?.[0]?.message?.content ?? '';
    }
    case 'tool':
      return { tool: node.data?.tool_name, params: node.data?.params, executed: true };
    case 'condition': {
      const expr = node.data?.expression || 'true';
      try { return { branch: !!new Function('ctx', `return (${expr})`)(ctx) }; }
      catch { return { branch: false }; }
    }
    case 'transform': {
      const code = node.data?.code || 'return input;';
      try {
        const lastInput = Object.values(ctx).pop();
        return new Function('input', 'ctx', code)(lastInput, ctx);
      } catch (e: any) { return { error: e.message }; }
    }
    case 'output':
      return Object.values(ctx).pop();
    default:
      return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  // ═══ OTel root trace (Sprint 26)
  const trace = startEdgeTrace(req, { rootName: 'agent-workflow-runner.handle' });
  const rootSpan = trace.startSpan('agent-workflow-runner.handle', 'server');
  rootSpan.setAttribute('http.method', req.method);

  try {
    const auth = req.headers.get('Authorization');
    if (!auth) { rootSpan.setStatus('error', 'unauthorized'); trace.endSpan(rootSpan, 'error'); trace.end('error'); return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders }); }

    const supa = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: { user } } = await trace.withSpan('auth.verify', 'auth', async () => userClient.auth.getUser());
    if (!user) { rootSpan.setStatus('error', 'unauthorized'); trace.endSpan(rootSpan, 'error'); trace.end('error'); return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders }); }

    const { workflow_id, input } = await req.json();
    rootSpan.setAttribute('workflow.id', workflow_id);

    // ═══ CHAOS ENGINEERING — fault injection (Sprint 28) ═══
    const chaosFault = await maybeInjectFault('agent-workflow-runner', supa);
    if (chaosFault) {
      await trace.withSpan('chaos.inject', 'tool', async (span) => {
        span.setAttribute('chaos.fault_type', chaosFault.fault_type);
        span.setAttribute('chaos.experiment_id', chaosFault.id);
        if (chaosFault.fault_type === 'latency') span.setAttribute('chaos.latency_ms', chaosFault.latency_ms);
        await applyFault(chaosFault);
      });
    }
    const { data: wf, error: wfErr } = await trace.withSpan('db.workflow_load', 'db', async () => supa.from('agent_workflows').select('*').eq('id', workflow_id).single());
    if (wfErr || !wf) { rootSpan.setStatus('error', 'workflow_not_found'); trace.endSpan(rootSpan, 'error'); trace.end('error'); return new Response(JSON.stringify({ error: 'Workflow não encontrado' }), { status: 404, headers: corsHeaders }); }

    const { data: run } = await supa.from('agent_workflow_runs').insert({
      workflow_id, status: 'running', input, created_by: user.id,
    }).select().single();

    const lovableKey = Deno.env.get('LOVABLE_API_KEY')!;
    const ordered = topoSort(wf.nodes || [], wf.edges || []);
    rootSpan.setAttribute('workflow.node_count', ordered.length);
    const ctx: Record<string, any> = { __input: input };
    const trace2: any[] = [];

    try {
      for (const node of ordered) {
        const t0 = Date.now();
        const out = await trace.withSpan(`node.${node.type}`, 'tool', async (span) => {
          span.setAttribute('node.id', node.id);
          span.setAttribute('node.type', node.type);
          if (node.data?.agent_id) span.setAttribute('agent.id', node.data.agent_id);
          return executeNode(node, ctx, supa, lovableKey);
        });
        ctx[node.id] = out;
        trace2.push({ node_id: node.id, type: node.type, output: out, latency_ms: Date.now() - t0 });
      }
      const finalOutput = ordered.length ? ctx[ordered[ordered.length - 1].id] : null;
      await supa.from('agent_workflow_runs').update({
        status: 'completed', output: finalOutput, trace: trace2, completed_at: new Date().toISOString(),
      }).eq('id', run.id);
      trace.endSpan(rootSpan, 'ok');
      trace.end('ok');
      return new Response(JSON.stringify({ run_id: run.id, output: finalOutput, trace: trace2, trace_id: trace.traceId }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-trace-id': trace.traceId },
      });
    } catch (e: any) {
      await supa.from('agent_workflow_runs').update({
        status: 'failed', error_message: e.message, trace: trace2, completed_at: new Date().toISOString(),
      }).eq('id', run.id);
      throw e;
    }
  } catch (e: any) {
    rootSpan.setStatus('error', e.message);
    trace.endSpan(rootSpan, 'error');
    trace.end('error');
    return new Response(JSON.stringify({ error: e.message, trace_id: trace.traceId }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'x-trace-id': trace.traceId } });
  }
});
