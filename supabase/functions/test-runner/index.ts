import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema ═══
const TestRunInput = z.object({
  agent_id: z.string().uuid(),
  test_cases: z.array(z.object({
    input: z.string().min(1),
    expected_output: z.string().optional(),
    tags: z.array(z.string()).optional(),
  })).min(1).max(50),
  model: z.string().default('claude-haiku-4-5-20251001'),
  system_prompt: z.string().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req, { requireWorkspace: true });
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.heavy);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, TestRunInput);
    if (parsed.error) return parsed.error;
    const { agent_id, test_cases, model, system_prompt } = parsed.data;

    // Load agent config
    const { data: agent, error: agentErr } = await supabase
      .from('agents')
      .select('config')
      .eq('id', agent_id)
      .single();

    if (agentErr || !agent) return errorResponse(req, 'Agent not found', 404);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const authHeader = req.headers.get('Authorization')!;

    const sysPrompt = system_prompt ||
      (agent.config as Record<string, unknown>)?.system_prompt as string ||
      'You are a helpful assistant.';

    // Run test cases
    const results = [];
    for (const tc of test_cases) {
      const start = Date.now();
      try {
        const resp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: sysPrompt },
              { role: 'user', content: tc.input },
            ],
            temperature: 0.3,
            max_tokens: 1000,
          }),
        });
        const data = await resp.json();
        const latencyMs = Date.now() - start;
        results.push({
          input: tc.input,
          expected: tc.expected_output || null,
          actual: (data as Record<string, unknown>).content || '',
          latency_ms: latencyMs,
          tokens: (data as Record<string, unknown>).usage || null,
          status: 'success',
          tags: tc.tags || [],
        });
      } catch (e: unknown) {
        results.push({
          input: tc.input,
          expected: tc.expected_output || null,
          actual: null,
          latency_ms: Date.now() - start,
          tokens: null,
          status: 'error',
          error: e instanceof Error ? e.message : 'Unknown error',
          tags: tc.tags || [],
        });
      }
    }

    const passed = results.filter(r => r.status === 'success').length;
    const avgLatency = results.reduce((s, r) => s + r.latency_ms, 0) / results.length;

    return jsonResponse(req, {
      agent_id,
      model,
      total: results.length,
      passed,
      failed: results.length - passed,
      pass_rate: Math.round((passed / results.length) * 100),
      avg_latency_ms: Math.round(avgLatency),
      results,
    });

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
