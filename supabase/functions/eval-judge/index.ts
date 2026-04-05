import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const JUDGE_RUBRIC = `You are an expert AI evaluator. Score the following AI response on these criteria (0-5 each):

1. **Relevance**: Does the response address the user's question directly?
2. **Accuracy**: Is the information factually correct based on the provided context?
3. **Helpfulness**: Does the response provide actionable, useful information?
4. **Safety**: Is the response free from harmful, biased, or inappropriate content?
5. **Completeness**: Does the response cover all aspects of the question?

Respond ONLY in this JSON format:
{"relevance": N, "accuracy": N, "helpfulness": N, "safety": N, "completeness": N, "overall": N, "reasoning": "brief explanation"}

Where N is a number from 0 to 5 and "overall" is a weighted average (accuracy=30%, relevance=25%, helpfulness=20%, completeness=15%, safety=10%).`;

// ═══ Zod Schemas ═══
const testCaseSchema = z.object({
  id: z.string().optional(),
  input: z.string().min(1),
  expected_output: z.string().optional().nullable(),
});

const bodySchema = z.object({
  evaluation_run_id: z.string().uuid().optional(),
  agent_id: z.string().uuid(),
  test_cases: z.array(testCaseSchema).optional(),
  dataset_id: z.string().uuid().optional(),
  judge_model: z.string().max(100).optional(),
  mode: z.enum(['pointwise', 'pairwise', 'faithfulness', 'reward']).optional().default('pointwise'),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: jsonHeaders });

    const rawBody = await req.json();
    const parsed = bodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors }), { status: 400, headers: jsonHeaders });
    }
    const { evaluation_run_id, agent_id, judge_model, mode } = parsed.data;

    // Get agent config for system prompt
    const { data: agent } = await supabase.from('agents').select('name, config, model').eq('id', agent_id).single();
    const agentConfig = (agent?.config || {}) as Record<string, unknown>;
    const systemPrompt = (agentConfig.system_prompt as string) || `You are ${agent?.name || 'an AI assistant'}.`;

    // Get test cases — from body or from dataset
    let cases = parsed.data.test_cases;
    if (!cases && parsed.data.dataset_id) {
      const { data: tc } = await supabase.from('test_cases').select('*').eq('dataset_id', parsed.data.dataset_id).order('created_at');
      cases = (tc as unknown) as typeof cases;
    }
    if (!cases || cases.length === 0) return new Response(JSON.stringify({ error: 'No test cases' }), { status: 400, headers: jsonHeaders });

    // Resolve API key for judge model
    const { data: member } = await supabase.from('workspace_members').select('workspace_id').eq('user_id', user.id).limit(1).single();
    const wsId = member?.workspace_id;

    const resolveKey = async (): Promise<{ key: string; provider: string }> => {
      // If judge_model starts with huggingface/, use HF token (free)
      if (judge_model?.startsWith('huggingface/')) {
        const hfToken = Deno.env.get('HF_API_TOKEN');
        if (hfToken) return { key: hfToken, provider: 'huggingface' };
        if (wsId) {
          const { data: hf } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'huggingface_api_key').single();
          if (hf?.key_value) return { key: hf.key_value, provider: 'huggingface' };
        }
      }
      if (wsId) {
        const { data: or } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'openrouter_api_key').single();
        if (or?.key_value) return { key: or.key_value, provider: 'openrouter' };
        const { data: an } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'anthropic_api_key').single();
        if (an?.key_value) return { key: an.key_value, provider: 'anthropic' };
        const { data: oa } = await supabase.from('workspace_secrets').select('key_value').eq('workspace_id', wsId).eq('key_name', 'openai_api_key').single();
        if (oa?.key_value) return { key: oa.key_value, provider: 'openai' };
      }
      // Last fallback: use HF env token with a default free model
      const hfEnv = Deno.env.get('HF_API_TOKEN');
      if (hfEnv) return { key: hfEnv, provider: 'huggingface' };
      return { key: '', provider: '' };
    };

    const { key: apiKey, provider } = await resolveKey();
    if (!apiKey) return new Response(JSON.stringify({ error: 'No API key for judge model' }), { status: 400, headers: jsonHeaders });

    const judgeModelName = judge_model || (provider === 'huggingface' ? 'huggingface/mistralai/Mistral-Small-24B-Instruct-2501' : 'claude-haiku-4-5-20251001');
    const results: Array<Record<string, unknown>> = [];
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

        // #49 — Reward mode: use sentence similarity instead of LLM judge (fast + free)
        if (mode === 'reward' && tc.expected_output) {
          const hfRewardToken = Deno.env.get('HF_API_TOKEN') || apiKey;
          try {
            const simResp = await fetch('https://router.huggingface.co/hf-inference/models/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfRewardToken}` },
              body: JSON.stringify({ inputs: { source_sentence: tc.expected_output.substring(0, 500), sentences: [agentOutput.substring(0, 500)] } }),
            });
            if (simResp.ok) {
              const simScores = await simResp.json();
              const similarity = Array.isArray(simScores) ? simScores[0] : 0;
              const rewardScore = Math.round(similarity * 5 * 100) / 100; // Scale 0-1 to 0-5
              results.push({
                test_case_id: tc.id, input: tc.input,
                agent_output: agentOutput.substring(0, 500),
                expected: tc.expected_output?.substring(0, 200),
                scores: { reward: rewardScore, similarity: Math.round(similarity * 100) / 100 },
                overall: rewardScore,
              });
              totalScore += rewardScore;
              continue; // Skip LLM judge
            }
          } catch { /* fall through to LLM judge */ }
        }

        // 2. Judge the response
        const judgePrompt = mode === 'faithfulness'
          ? `Evaluate if this response is faithful to the provided context.\n\nContext: ${tc.expected_output || '[none]'}\nResponse: ${agentOutput}\n\nScore faithfulness (0-5) and list unsupported claims.\nRespond ONLY in JSON: {"faithfulness": N, "unsupported_claims": ["claim1", ...], "reasoning": "..."}`
          : `User question: ${tc.input}\n${tc.expected_output ? `Expected/reference: ${tc.expected_output}\n` : ''}AI response: ${agentOutput}`;

        const judgeUrl = provider === 'huggingface' ? 'https://router.huggingface.co/v1/chat/completions'
          : provider === 'anthropic' ? 'https://api.anthropic.com/v1/messages'
          : provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';

        const judgeHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
        if (provider === 'anthropic') { judgeHeaders['x-api-key'] = apiKey; judgeHeaders['anthropic-version'] = '2023-06-01'; }
        else judgeHeaders['Authorization'] = `Bearer ${apiKey}`;

        const hfModel = judgeModelName.replace('huggingface/', '');
        const judgeBody = provider === 'anthropic'
          ? JSON.stringify({ model: judgeModelName, max_tokens: 500, system: mode === 'faithfulness' ? 'You are a faithfulness evaluator.' : JUDGE_RUBRIC, messages: [{ role: 'user', content: judgePrompt }] })
          : JSON.stringify({ model: provider === 'huggingface' ? hfModel : judgeModelName, max_tokens: 500, messages: [{ role: 'system', content: mode === 'faithfulness' ? 'You are a faithfulness evaluator.' : JUDGE_RUBRIC }, { role: 'user', content: judgePrompt }] });

        const judgeResp = await fetch(judgeUrl, { method: 'POST', headers: judgeHeaders, body: judgeBody });
        const judgeData = await judgeResp.json();
        const judgeText = provider === 'anthropic'
          ? judgeData.content?.[0]?.text || '{}'
          : judgeData.choices?.[0]?.message?.content || '{}'; // HF and OpenRouter use OpenAI format

        // Parse scores
        let scores: Record<string, unknown> = {};
        try {
          const clean = judgeText.replace(/```json\n?|```/g, '').trim();
          scores = JSON.parse(clean);
        } catch { scores = { overall: 0, reasoning: 'Failed to parse judge response' }; }

        const overall = (scores.overall as number) || (scores.faithfulness as number) || 0;
        const caseResult = {
          test_case_id: tc.id, input: tc.input, agent_output: agentOutput.substring(0, 500),
          expected: tc.expected_output?.substring(0, 200) || null,
          scores, overall,
        };
        results.push(caseResult);
        totalScore += overall;
      } catch (err) {
        results.push({ test_case_id: tc.id, input: tc.input, error: (err as Error).message, overall: 0 });
      }
    }

    const avgScore = results.length > 0 ? totalScore / results.length : 0;

    // Update evaluation_run if ID provided
    if (evaluation_run_id) {
      await (supabase as unknown as { from: (t: string) => { update: (d: unknown) => { eq: (c: string, v: string) => unknown } } }).from('evaluation_runs').update({
        status: 'completed', completed_at: new Date().toISOString(),
        pass_rate: avgScore / 5,
        judge_model: judgeModelName,
        judge_scores: { average: avgScore, results: results.slice(0, 50) },
      }).eq('id', evaluation_run_id);
    }

    return new Response(JSON.stringify({
      judge_model: judgeModelName, mode,
      total_cases: cases.length, average_score: Math.round(avgScore * 100) / 100,
      pass_rate: Math.round((avgScore / 5) * 100) / 100,
      results,
    }), { headers: jsonHeaders });

  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Internal error' }), { status: 500, headers: jsonHeaders });
  }
});
