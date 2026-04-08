/**
 * Nexus Agents Studio — LLM Gateway Service
 * Centralized access to Edge Functions, with race-safe tracing.
 *
 * Every invoke* wrapper goes through tracedInvoke() which:
 *  - Starts a TraceContext per call (no shared state)
 *  - Records input/output, duration, status, cost (if available)
 *  - Sets OTel GenAI semantic conventions on the span
 *  - Fire-and-forget exports trace to Supabase + Langfuse + usage_records
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import { startTrace, type SpanKind } from '@/lib/tracing';

/**
 * Wraps a Supabase Edge Function invoke with a complete trace.
 * Returns the function result on success, throws on error.
 */
async function tracedInvoke<T = unknown>(
  functionName: string,
  body: unknown,
  options: {
    spanKind?: SpanKind;
    agentId?: string;
    sessionId?: string;
    workflowId?: string;
    extractCostUsd?: (data: unknown) => number | undefined;
    extractTokens?: (data: unknown) => { input?: number; output?: number } | undefined;
    extractModel?: (body: unknown) => string | undefined;
  } = {}
): Promise<T> {
  const ctx = startTrace({
    agentId: options.agentId,
    sessionId: options.sessionId,
    workflowId: options.workflowId,
  });

  const span = ctx.startSpan(`edge.${functionName}`, options.spanKind ?? 'http');
  span.setAttribute('http.url', `supabase/functions/${functionName}`);
  span.setAttribute('gen_ai.system', 'nexus');
  const model = options.extractModel?.(body);
  if (model) span.setAttribute('gen_ai.request.model', model);
  span.setInput(body);

  try {
    const { data, error } = await supabase.functions.invoke(functionName, { body: body as Record<string, unknown> });
    if (error) {
      span.setStatus('error', error.message);
      ctx.endSpan(span, 'error');
      ctx.end('error');
      logger.error(`${functionName} failed`, { error: error.message, trace_id: ctx.traceId });
      throw error;
    }

    // Capture cost / tokens if extractors provided
    const cost = options.extractCostUsd?.(data);
    if (cost != null) span.setAttribute('cost.usd', cost);
    const tokens = options.extractTokens?.(data);
    if (tokens?.input != null) span.setAttribute('gen_ai.usage.input_tokens', tokens.input);
    if (tokens?.output != null) span.setAttribute('gen_ai.usage.output_tokens', tokens.output);

    span.setOutput(data);
    ctx.endSpan(span, 'ok');
    ctx.end('ok');
    return data as T;
  } catch (err) {
    if (span.snapshot().status !== 'error') {
      span.setStatus('error', err instanceof Error ? err.message : String(err));
      ctx.endSpan(span, 'error');
      ctx.end('error');
    }
    throw err;
  }
}

// ═══ Public API ═══

export async function invokeLLMGateway(body: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature?: number;
  max_tokens?: number;
}) {
  return tracedInvoke('llm-gateway', body, {
    spanKind: 'llm',
    extractModel: (b) => (b as { model: string }).model,
    extractCostUsd: (d) => (d as { cost_usd?: number })?.cost_usd,
    extractTokens: (d) => {
      const r = d as { usage?: { input_tokens?: number; output_tokens?: number } };
      return r?.usage ? { input: r.usage.input_tokens, output: r.usage.output_tokens } : undefined;
    },
  });
}

export async function invokeGuardrailsEngine(body: Record<string, unknown>) {
  return tracedInvoke('guardrails-engine', body, { spanKind: 'guardrail' });
}

export async function invokeOracleResearch(body: Record<string, unknown>) {
  return tracedInvoke('oracle-research', body, {
    spanKind: 'llm',
    extractCostUsd: (d) => (d as { metrics?: { total_cost_usd?: number } })?.metrics?.total_cost_usd,
    extractTokens: (d) => {
      const m = (d as { metrics?: { total_tokens?: number } })?.metrics;
      return m?.total_tokens ? { input: m.total_tokens, output: 0 } : undefined;
    },
  });
}

export async function invokeA2AServer(body: Record<string, unknown>) {
  return tracedInvoke('a2a-server', body, { spanKind: 'http' });
}

export async function invokeBitrix24OAuth(body: Record<string, unknown>) {
  return tracedInvoke('bitrix24-oauth', body, { spanKind: 'http' });
}

export async function invokeBitrix24Api(body: Record<string, unknown>) {
  return tracedInvoke('bitrix24-api', body, { spanKind: 'http' });
}

export async function invokeTestRunner(body: Record<string, unknown>) {
  return tracedInvoke('test-runner', body, { spanKind: 'tool' });
}

/**
 * Generic traced invoke for callers that need to instrument arbitrary
 * Edge Functions without adding a wrapper here. Public so workflowStore,
 * oracleStore etc. can route through the same tracer.
 */
export async function invokeTracedFunction<T = unknown>(
  functionName: string,
  body: unknown,
  options?: Parameters<typeof tracedInvoke>[2]
): Promise<T> {
  return tracedInvoke<T>(functionName, body, options);
}

export async function saveWorkspaceSecret(wsId: string, keyName: string, value: string, isUpdate: boolean) {
  try {
    if (isUpdate) {
      const { error } = await supabase.from('workspace_secrets').update({ key_value: value, updated_at: new Date().toISOString() })
        .eq('workspace_id', wsId).eq('key_name', keyName);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('workspace_secrets').insert({ workspace_id: wsId, key_name: keyName, key_value: value });
      if (error) throw error;
    }
  } catch (err) {
    logger.error('saveWorkspaceSecret failed', { keyName, error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}

export async function getMaskedSecrets(wsId: string) {
  const { data, error } = await supabase.rpc('get_masked_secrets', { p_workspace_id: wsId });
  if (error) { logger.error('getMaskedSecrets failed', { error: error.message }); throw error; }
  return data ?? [];
}
