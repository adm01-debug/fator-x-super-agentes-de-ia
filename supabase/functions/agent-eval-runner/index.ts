// Eval Suite runner — executa dataset contra agente + LLM-as-judge
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EvalItem {
  input: string;
  expected_output: string;
  criteria?: string[];
}

const LOVABLE_AI_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

async function callAgent(systemPrompt: string, userInput: string, model: string, apiKey: string) {
  const t0 = Date.now();
  const resp = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        ...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []),
        { role: 'user', content: userInput },
      ],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || `Agent call failed (${resp.status})`);
  const text = data?.choices?.[0]?.message?.content ?? '';
  const usage = data?.usage ?? {};
  return {
    text: String(text),
    latency_ms: Date.now() - t0,
    tokens_in: usage.prompt_tokens ?? 0,
    tokens_out: usage.completion_tokens ?? 0,
  };
}

async function judgeResult(expected: string, actual: string, criteria: string[], apiKey: string) {
  const judgePrompt = `Você é um avaliador rigoroso. Compare a resposta REAL com a ESPERADA.

ESPERADA:
${expected}

REAL:
${actual}

${criteria.length > 0 ? `CRITÉRIOS:\n${criteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : ''}

Responda APENAS um JSON válido (sem markdown, sem \`\`\`):
{"score": 0.0-1.0, "passed": true|false, "reasoning": "explicação curta em português"}

Use score >= 0.7 para passed=true.`;

  const resp = await fetch(LOVABLE_AI_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'google/gemini-2.5-flash-lite',
      messages: [{ role: 'user', content: judgePrompt }],
    }),
  });
  const data = await resp.json();
  if (!resp.ok) throw new Error(data?.error?.message || 'Judge failed');
  let raw = String(data?.choices?.[0]?.message?.content ?? '{}').trim();
  raw = raw.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
  try {
    const parsed = JSON.parse(raw);
    return {
      score: Number(parsed.score ?? 0),
      passed: Boolean(parsed.passed),
      reasoning: String(parsed.reasoning ?? ''),
    };
  } catch {
    return { score: 0, passed: false, reasoning: `Judge parse error: ${raw.slice(0, 200)}` };
  }
}

function estimateCost(model: string, tokensIn: number, tokensOut: number): number {
  const pricing: Record<string, [number, number]> = {
    'google/gemini-2.5-flash': [0.075, 0.3],
    'google/gemini-2.5-flash-lite': [0.0375, 0.15],
    'google/gemini-2.5-pro': [1.25, 5.0],
    'google/gemini-3-flash-preview': [0.1, 0.4],
    'openai/gpt-5': [2.5, 10.0],
    'openai/gpt-5-mini': [0.25, 1.0],
    'openai/gpt-5-nano': [0.05, 0.2],
  };
  const [inP, outP] = pricing[model] ?? [0.1, 0.4];
  return (tokensIn / 1_000_000) * inP + (tokensOut / 1_000_000) * outP;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!apiKey) throw new Error('LOVABLE_API_KEY não configurada');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Sem autenticação');

    // user-scoped client to validate auth
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) throw new Error('Auth inválida');
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { dataset_id, agent_id } = body as { dataset_id: string; agent_id: string };
    if (!dataset_id || !agent_id) throw new Error('dataset_id e agent_id obrigatórios');

    const { data: dataset, error: dsErr } = await admin
      .from('agent_eval_datasets')
      .select('*')
      .eq('id', dataset_id)
      .single();
    if (dsErr || !dataset) throw new Error('Dataset não encontrado');

    const { data: agent, error: agErr } = await admin
      .from('agents')
      .select('id, model, config, workspace_id')
      .eq('id', agent_id)
      .single();
    if (agErr || !agent) throw new Error('Agente não encontrado');

    const items = (dataset.items as EvalItem[]) ?? [];
    const model = agent.model || 'google/gemini-2.5-flash';
    const systemPrompt = (agent.config as Record<string, unknown>)?.system_prompt as string ?? '';

    const { data: run, error: runErr } = await admin
      .from('agent_eval_runs')
      .insert({
        workspace_id: dataset.workspace_id,
        dataset_id,
        agent_id,
        status: 'running',
        total_items: items.length,
        model,
        started_at: new Date().toISOString(),
        created_by: userId,
      })
      .select()
      .single();
    if (runErr || !run) throw new Error('Falha ao criar run');

    // Run async — process and return run_id immediately
    (async () => {
      let passed = 0;
      let failed = 0;
      let totalScore = 0;
      let totalLatency = 0;
      let totalCost = 0;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        try {
          const agentResp = await callAgent(systemPrompt, item.input, model, apiKey);
          const cost = estimateCost(model, agentResp.tokens_in, agentResp.tokens_out);
          const judge = await judgeResult(item.expected_output, agentResp.text, item.criteria ?? [], apiKey);

          totalScore += judge.score;
          totalLatency += agentResp.latency_ms;
          totalCost += cost;
          if (judge.passed) passed++;
          else failed++;

          await admin.from('agent_eval_results').insert({
            run_id: run.id,
            item_index: i,
            input: item.input,
            expected: item.expected_output,
            actual: agentResp.text,
            passed: judge.passed,
            score: judge.score,
            latency_ms: agentResp.latency_ms,
            cost_usd: cost,
            judge_reasoning: judge.reasoning,
          });
        } catch (e) {
          failed++;
          await admin.from('agent_eval_results').insert({
            run_id: run.id,
            item_index: i,
            input: item.input,
            expected: item.expected_output,
            actual: null,
            passed: false,
            score: 0,
            error: e instanceof Error ? e.message : String(e),
          });
        }
      }

      await admin
        .from('agent_eval_runs')
        .update({
          status: 'completed',
          passed,
          failed,
          avg_score: items.length > 0 ? totalScore / items.length : 0,
          avg_latency_ms: items.length > 0 ? Math.round(totalLatency / items.length) : 0,
          total_cost_usd: totalCost,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);
    })().catch(async (e) => {
      await admin
        .from('agent_eval_runs')
        .update({ status: 'failed', error_message: e instanceof Error ? e.message : String(e), completed_at: new Date().toISOString() })
        .eq('id', run.id);
    });

    return new Response(JSON.stringify({ run_id: run.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
