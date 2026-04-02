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
    const supabaseKey = Deno.env.get('SUPABASE_PUBLISHABLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const body = await req.json();
    const { workflow_id, input } = body;

    // Load workflow + steps
    const { data: workflow } = await supabase.from('workflows').select('*').eq('id', workflow_id).single();
    if (!workflow) return new Response(JSON.stringify({ error: 'Workflow not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const { data: steps } = await supabase.from('workflow_steps').select('*, agents(id, name, model, config)').eq('workflow_id', workflow_id).order('step_order', { ascending: true });
    if (!steps || steps.length === 0) return new Response(JSON.stringify({ error: 'No steps found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Create run
    const { data: run } = await supabase.from('workflow_runs').insert({
      workflow_id, input, status: 'running', total_steps: steps.length,
    }).select().single();

    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
    let previousOutput = typeof input === 'string' ? input : JSON.stringify(input);
    let totalTokens = 0;
    let totalCost = 0;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const agent = (step as any).agents;
      const agentConfig = (agent?.config || {}) as Record<string, any>;
      const model = agent?.model || 'claude-sonnet-4.6';
      const systemPrompt = agentConfig.system_prompt || `You are step "${step.name}" in a workflow. Role: ${step.role}.`;

      // Create step run
      const { data: stepRun } = await supabase.from('workflow_step_runs').insert({
        workflow_run_id: run!.id, workflow_step_id: step.id,
        step_order: i, status: 'running', input: { context: previousOutput },
        started_at: new Date().toISOString(),
      }).select().single();

      try {
        const stepStart = Date.now();
        const controller = new AbortController();
        const stepTimeout = setTimeout(() => controller.abort(), 30000); // 30s per step
        const resp = await fetch(gatewayUrl, {
          method: 'POST',
          signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
          body: JSON.stringify({
            model, agent_id: agent?.id,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Context from previous step:\n${previousOutput}\n\nExecute your role as "${step.name}".` },
            ],
            temperature: 0.7, max_tokens: 3000,
          }),
        });
        clearTimeout(stepTimeout);
        const result = await resp.json();
        const latencyMs = Date.now() - stepStart;

        previousOutput = result.content || result.error || '';
        const tokens = result.tokens?.total || 0;
        const cost = result.cost_usd || 0;
        totalTokens += tokens;
        totalCost += cost;

        await supabase.from('workflow_step_runs').update({
          status: result.error ? 'failed' : 'completed',
          output: { content: previousOutput }, error: result.error || null,
          tokens_used: tokens, cost_usd: cost, latency_ms: latencyMs,
          completed_at: new Date().toISOString(),
        }).eq('id', stepRun!.id);

        await supabase.from('workflow_runs').update({ current_step: i + 1 }).eq('id', run!.id);

        if (result.error) {
          await supabase.from('workflow_runs').update({ status: 'failed', error: result.error, completed_at: new Date().toISOString(), total_tokens: totalTokens, total_cost_usd: totalCost }).eq('id', run!.id);
          return new Response(JSON.stringify({ run_id: run!.id, status: 'failed', failed_at_step: i, error: result.error }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }
      } catch (e: any) {
        await supabase.from('workflow_step_runs').update({ status: 'failed', error: e.message, completed_at: new Date().toISOString() }).eq('id', stepRun!.id);
        await supabase.from('workflow_runs').update({ status: 'failed', error: e.message, completed_at: new Date().toISOString() }).eq('id', run!.id);
        throw e;
      }
    }

    // Complete
    await supabase.from('workflow_runs').update({
      status: 'completed', output: { final: previousOutput },
      completed_at: new Date().toISOString(), total_tokens: totalTokens, total_cost_usd: totalCost,
    }).eq('id', run!.id);

    return new Response(JSON.stringify({
      run_id: run!.id, status: 'completed',
      steps_executed: steps.length, total_tokens: totalTokens,
      total_cost_usd: totalCost, final_output: previousOutput,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
