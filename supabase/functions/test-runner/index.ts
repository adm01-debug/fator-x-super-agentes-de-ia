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
    const { agent_id, dataset_id, evaluation_run_id } = body;

    // Load agent
    const { data: agent } = await supabase.from('agents').select('*').eq('id', agent_id).single();
    if (!agent) return new Response(JSON.stringify({ error: 'Agent not found' }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Load test cases
    const { data: testCases } = await supabase.from('test_cases').select('*').eq('dataset_id', dataset_id);
    if (!testCases || testCases.length === 0) return new Response(JSON.stringify({ error: 'No test cases found' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const config = (agent.config || {}) as Record<string, any>;
    const systemPrompt = config.system_prompt || `You are ${agent.name}. ${agent.mission || ''}`;
    const model = agent.model || 'claude-sonnet-4.6';
    const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;

    const results: Array<{ test_case_id: string; input: string; expected: string; actual: string; passed: boolean; latency_ms: number; tokens: number }> = [];

    for (const tc of testCases) {
      const start = Date.now();
      try {
        const resp = await fetch(gatewayUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
          body: JSON.stringify({
            model, agent_id,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: tc.input },
            ],
            temperature: 0.3, max_tokens: 2000,
          }),
        });
        const llmResult = await resp.json();
        const actual = llmResult.content || llmResult.error || '';
        const latencyMs = Date.now() - start;

        // Simple pass check: expected output is contained in actual (case-insensitive)
        const passed = tc.expected_output
          ? actual.toLowerCase().includes(tc.expected_output.toLowerCase().substring(0, 100))
          : true; // No expected = always pass (manual review)

        results.push({
          test_case_id: tc.id, input: tc.input,
          expected: tc.expected_output || '', actual,
          passed, latency_ms: latencyMs,
          tokens: llmResult.tokens?.total || 0,
        });
      } catch (e: any) {
        results.push({ test_case_id: tc.id, input: tc.input, expected: tc.expected_output || '', actual: `ERROR: ${e.message}`, passed: false, latency_ms: Date.now() - start, tokens: 0 });
      }
    }

    const passRate = results.filter(r => r.passed).length / results.length;
    const avgLatency = results.reduce((s, r) => s + r.latency_ms, 0) / results.length;
    const totalTokens = results.reduce((s, r) => s + r.tokens, 0);

    // Update evaluation run
    if (evaluation_run_id) {
      await supabase.from('evaluation_runs').update({
        status: 'completed', test_cases: results.length, pass_rate: passRate,
        results: { items: results, avg_latency_ms: avgLatency, total_tokens: totalTokens },
        completed_at: new Date().toISOString(),
      }).eq('id', evaluation_run_id);
    }

    return new Response(JSON.stringify({
      total: results.length, passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length, pass_rate: passRate,
      avg_latency_ms: Math.round(avgLatency), total_tokens: totalTokens, results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
