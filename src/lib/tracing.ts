/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Tracing Helper
 * ═══════════════════════════════════════════════════════════════
 * Sends traces to Langfuse (or any OTel-compatible backend).
 * Follows OpenTelemetry GenAI Semantic Conventions v1.37+.
 * Reference: Langfuse (10K★), Arize Phoenix, AgentOps
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

interface TraceSpan {
  name: string;
  type: 'llm' | 'tool' | 'rag' | 'guardrail' | 'memory' | 'custom';
  model?: string;
  input?: string;
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  status?: 'success' | 'error';
  metadata?: Record<string, unknown>;
}

interface Trace {
  id: string;
  agentId?: string;
  sessionId?: string;
  userId?: string;
  spans: TraceSpan[];
  startTime: number;
  totalDurationMs?: number;
  totalTokens?: number;
  totalCost?: number;
  status: 'running' | 'success' | 'error';
}

class NexusTracer {
  private currentTrace: Trace | null = null;
  private langfuseUrl: string | null = null;
  private langfusePublicKey: string | null = null;

  constructor() {
    // Will be configured via settings
    this.langfuseUrl = null;
    this.langfusePublicKey = null;
  }

  /**
   * Start a new trace for an agent execution.
   */
  startTrace(options: { agentId?: string; sessionId?: string; userId?: string }): string {
    const traceId = crypto.randomUUID();
    this.currentTrace = {
      id: traceId,
      agentId: options.agentId,
      sessionId: options.sessionId,
      userId: options.userId,
      spans: [],
      startTime: Date.now(),
      status: 'running',
    };
    return traceId;
  }

  /**
   * Add a span to the current trace.
   * Follows OTel GenAI SemConv attributes:
   *   gen_ai.system, gen_ai.request.model, gen_ai.usage.input_tokens, etc.
   */
  addSpan(span: TraceSpan): void {
    if (!this.currentTrace) return;
    this.currentTrace.spans.push({
      ...span,
      durationMs: span.durationMs || 0,
    });
  }

  /**
   * End the current trace and persist to Supabase + Langfuse.
   */
  async endTrace(status: 'success' | 'error' = 'success'): Promise<void> {
    if (!this.currentTrace) return;

    this.currentTrace.status = status;
    this.currentTrace.totalDurationMs = Date.now() - this.currentTrace.startTime;
    this.currentTrace.totalTokens = this.currentTrace.spans.reduce(
      (s, span) => s + (span.inputTokens || 0) + (span.outputTokens || 0), 0
    );
    this.currentTrace.totalCost = this.currentTrace.spans.reduce(
      (s, span) => s + (span.costUsd || 0), 0
    );

    // Persist to Supabase trace_events
    try {
      await supabase.from('trace_events').insert({
        trace_id: this.currentTrace.id,
        agent_id: this.currentTrace.agentId,
        session_id: this.currentTrace.sessionId,
        event_type: 'trace_complete',
        duration_ms: this.currentTrace.totalDurationMs,
        token_count: this.currentTrace.totalTokens,
        cost_usd: this.currentTrace.totalCost,
        status: this.currentTrace.status,
        metadata: {
          spans: this.currentTrace.spans,
          span_count: this.currentTrace.spans.length,
        },
      });
    } catch (err: unknown) {
      logger.error('Failed to persist trace:', { error: err instanceof Error ? err.message : String(err) });
    }

    // Send to Langfuse (if configured)
    if (this.langfuseUrl && this.langfusePublicKey) {
      try {
        await fetch(`${this.langfuseUrl}/api/public/ingestion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${btoa(`${this.langfusePublicKey}:`)}`,
          },
          body: JSON.stringify({
            batch: [{
              id: this.currentTrace.id,
              type: 'trace-create',
              timestamp: new Date(this.currentTrace.startTime).toISOString(),
              body: {
                id: this.currentTrace.id,
                name: `agent-${this.currentTrace.agentId || 'unknown'}`,
                metadata: { spans: this.currentTrace.spans.length },
                input: this.currentTrace.spans[0]?.input,
                output: this.currentTrace.spans[this.currentTrace.spans.length - 1]?.output,
              },
            }],
          }),
        });
      } catch { /* Langfuse send is best-effort */ }
    }

    // Also persist to usage_records for billing
    if (this.currentTrace.totalCost && this.currentTrace.totalCost > 0) {
      await supabase.from('usage_records').insert({
        agent_id: this.currentTrace.agentId,
        usage_type: 'llm_call',
        cost_usd: this.currentTrace.totalCost,
        token_count: this.currentTrace.totalTokens,
        metadata: { trace_id: this.currentTrace.id },
      }).catch(() => {});
    }

    this.currentTrace = null;
  }

  /**
   * Configure Langfuse endpoint.
   */
  configureLangfuse(url: string, publicKey: string): void {
    this.langfuseUrl = url;
    this.langfusePublicKey = publicKey;
  }
}

/** Singleton tracer instance */
export const tracer = new NexusTracer();

/** Convenience function for quick tracing */
export async function withTrace<T>(
  name: string,
  fn: (addSpan: (span: TraceSpan) => void) => Promise<T>,
  options: { agentId?: string; sessionId?: string; userId?: string } = {}
): Promise<T> {
  tracer.startTrace(options);
  try {
    const result = await fn((span) => tracer.addSpan(span));
    await tracer.endTrace('success');
    return result;
  } catch (err) {
    await tracer.endTrace('error');
    throw err;
  }
}
