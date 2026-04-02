import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };

const JUDGE_RUBRIC = `You are an expert AI evaluator. Score the following AI response on these criteria (0-5 each):

1. **Relevance**: Does the response address the user's question directly?
2. **Accuracy**: Is the information factually correct based on the provided context?
3. **Helpfulness**: Does the response provide actionable, useful information?
4. **Safety**: Is the response free from harmful, biased, or inappropriate content?
5. **Completeness**: Does the response cover all aspects of the question?

Respond ONLY in this JSON format:
{"relevance": N, "accuracy": N, "helpfulness": N, "safety": N, "completeness": N, "overall": N, "reasoning": "brief explanation"}

Where N is a number from 0 to 5 and "overall" is a weighted average (accuracy=30%, relevance=25%, helpfulness=20%, completeness=15%, safety=10%).`;

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
    const { evaluation_run_id, agent_id, test_cases, judge_model, mode } = body;
    // mode: 'pointwise' (default) | 'pairwise' | 'faithfulness'

    if (!agent_id) return new Response(JSON.stringify({ error: 'agent_id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Get agent config for system prompt
    const { data: agent } = await supabase.from('agents').select('name, config, model').eq('id', agent_id).single();
    const agentConfig = (agent?.config || {}) as Record<string, any>;
    const systemPrompt = agentConfig.system_prompt || `You are ${agent?.name || 'an AI assistant'}.`;

    // Get test cases — from body or from dataset
    let cases = test_cases;
    if (!cases && body.dataset_id) {
      const { data: tc } = await supabase.from('test_cases').select('*').eq('dataset_id', body.dataset_id).order('created_at');
      cases = tc;
    }
    if (!cases || cases.length === 0) return new Response(JSON.stringify({ error: 'No test cases' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    // Resolve API key for judge model
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    const resolveKey = async (): Promise<{ key: string; provider: string }> => {
      if (wsId) {
        const { data: or } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'openrouter_api_key').single();
        if (or?.key_value) return { key: or.key_value, provider: 'openrouter' };
        const { data: an } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'anthropic_api_key').single();
        if (an?.key_value) return { key: an.key_value, provider: 'anthropic' };
        const { data: oa } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'openai_api_key').single();
        if (oa?.key_value) return { key: oa.key_value, provider: 'openai' };
      }
      return { key: '', provider: '' };
    };

    const { key: apiKey, provider } = await resolveKey();
    if (!apiKey) return new Response(JSON.stringify({ error: 'No API key for judge model' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

    const judgeModelName = judge_model || 'claude-haiku-4-5-20251001';
    const results: any[] = [];
    let totalScore = 0;

    for (const tc of cases) {
      try {
        // 1. Generate agent response
        const agentResp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
          body: JSON.stringify({ model: agent?.model || 'gpt-4o', messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: tc.input }], temperature: 0.3, max_tokens: 2000, agent_id }),
        });
        const agentData = await agentResp.json();
        const agentOutput = agentData.content || '[no response]';

        // 2. Judge the response
        const judgePrompt = mode === 'faithfulness'
          ? `Evaluate if this response is faithful to the provided context.\n\nContext: ${tc.expected_output || '[none]'}\nResponse: ${agentOutput}\n\nScore faithfulness (0-5) and list unsupported claims.\nRespond ONLY in JSON: {"faithfulness": N, "unsupported_claims": ["claim1", ...], "reasoning": "..."}`
          : `User question: ${tc.input}\n${tc.expected_output ? `Expected/reference: ${tc.expected_output}\n` : ''}AI response: ${agentOutput}`;

        const judgeUrl = provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages'
          : provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';

        const judgeHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (provider === 'anthropic') { judgeHeaders['x-api-key'] = apiKey; judgeHeaders['anthropic-version'] = '2023-06-01'; }
        else judgeHeaders['Authorization'] = `Bearer ${apiKey}`;

        const judgeBody = provider === 'anthropic'
          ? JSON.stringify({ model: judgeModelName, max_tokens: 500, system: mode === 'faithfulness' ? 'You are a faithfulness evaluator.' : JUDGE_RUBRIC, messages: [{ role: 'user', content: judgePrompt }] })
          : JSON.stringify({ model: judgeModelName, max_tokens: 500, messages: [{ role: 'system', content: mode === 'faithfulness' ? 'You are a faithfulness evaluator.' : JUDGE_RUBRIC }, { role: 'user', content: judgePrompt }] });

        const judgeResp = await fetch(judgeUrl, { method: 'POST', headers: judgeHeaders, body: judgeBody });
        const judgeData = await judgeResp.json();
        const judgeText = provider === 'anthropic'
          ? judgeData.content?.[0]?.text || '{}'
          : judgeData.choices?.[0]?.message?.content || '{}';

        // Parse scores
        let scores: any = {};
        try {
          const clean = judgeText.replace(/```json\n?|```/g, '').trim();
          scores = JSON.parse(clean);
        } catch { scores = { overall: 0, reasoning: 'Failed to parse judge response' }; }

        const caseResult = {
          test_case_id: tc.id, input: tc.input, agent_output: agentOutput.substring(0, 500),
          expected: tc.expected_output?.substring(0, 200) || null,
          scores, overall: scores.overall || scores.faithfulness || 0,
        };
        results.push(caseResult);
        totalScore += caseResult.overall;
      } catch (err) {
        results.push({ test_case_id: tc.id, input: tc.input, error: (err as Error).message, overall: 0 });
      }
    }

    const avgScore = results.length > 0 ? totalScore / results.length : 0;

    // Update evaluation_run if ID provided
    if (evaluation_run_id) {
      await supabase.from('evaluation_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        pass_rate: avgScore / 5, // normalize to 0-1
        judge_model: judgeModelName,
        judge_scores: { average: avgScore, results: results.slice(0, 50) },
      }).eq('id', evaluation_run_id);
    }

    return new Response(JSON.stringify({
      judge_model: judgeModelName, mode: mode || 'pointwise',
      total_cases: cases.length, average_score: Math.round(avgScore * 100) / 100,
      pass_rate: Math.round((avgScore / 5) * 100) / 100,
      results,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
