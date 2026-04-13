/**
 * Tracing — Exporters (fire-and-forget)
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';
import type { TraceData } from './tracingTypes';

let langfuseConfig: { url: string; publicKey: string } | null = null;

export function configureLangfuse(url: string, publicKey: string): void {
  langfuseConfig = { url, publicKey };
}

export async function exportToSupabase(trace: TraceData): Promise<void> {
  try {
    const insertData = {
      event_type: 'trace_complete',
      data: {
        trace_id: trace.trace_id,
        agent_id: trace.agent_id,
        session_id: trace.session_id,
        workflow_id: trace.workflow_id,
        duration_ms: (trace.end_time ?? trace.start_time) - trace.start_time,
        status: trace.status,
        span_count: trace.spans.length,
        spans: trace.spans,
      },
    };
    await (supabase.from('trace_events').insert as Function)(insertData);
  } catch (err: unknown) {
    logger.error('Trace export to Supabase failed', {
      trace_id: trace.trace_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function exportToLangfuse(trace: TraceData): Promise<void> {
  if (!langfuseConfig) return;
  try {
    await fetch(`${langfuseConfig.url}/api/public/ingestion`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(`${langfuseConfig.publicKey}:`)}`,
      },
      body: JSON.stringify({
        batch: [
          {
            id: trace.trace_id,
            type: 'trace-create',
            timestamp: new Date(trace.start_time).toISOString(),
            body: {
              id: trace.trace_id,
              name: `agent-${trace.agent_id ?? 'unknown'}`,
              metadata: {
                span_count: trace.spans.length,
                workflow_id: trace.workflow_id,
              },
              input: trace.spans[0]?.input,
              output: trace.spans[trace.spans.length - 1]?.output,
            },
          },
        ],
      }),
    });
  } catch (err) {
    logger.error('Trace export to Langfuse failed', {
      trace_id: trace.trace_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

export async function exportUsageRecord(trace: TraceData): Promise<void> {
  const totalCost = trace.spans.reduce(
    (s, sp) => s + Number(sp.attributes['cost.usd'] ?? 0),
    0
  );
  if (totalCost <= 0) return;
  const totalTokens = trace.spans.reduce(
    (s, sp) =>
      s +
      Number(sp.attributes['gen_ai.usage.input_tokens'] ?? 0) +
      Number(sp.attributes['gen_ai.usage.output_tokens'] ?? 0),
    0
  );
  try {
    await (supabase.from('usage_records').insert as Function)({
      agent_id: trace.agent_id,
      record_type: 'llm_call',
      cost_usd: totalCost,
      tokens: totalTokens,
      metadata: { trace_id: trace.trace_id },
    });
  } catch (err) {
    logger.error('Usage record export failed', {
      trace_id: trace.trace_id,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
