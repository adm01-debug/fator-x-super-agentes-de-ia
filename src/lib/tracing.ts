/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Tracing (T19 rewrite)
 * ═══════════════════════════════════════════════════════════════
 * Race-safe, OpenTelemetry-aligned tracing for agent executions.
 *
 * Why this rewrite (vs previous singleton):
 *   The old NexusTracer kept `currentTrace` as instance state, so two
 *   parallel agent executions overwrote each other's spans — silent data
 *   corruption in production. This module replaces that with per-call
 *   trace contexts (no shared mutable state) and a registry of in-flight
 *   traces keyed by trace_id.
 *
 * Features:
 *   - Per-call TraceContext (no race conditions on parallel runs)
 *   - Nested spans with parent_span_id (proper tree structure)
 *   - Auto-timed spans via Span.end() (no manual durationMs math)
 *   - Fire-and-forget Langfuse export (never blocks the caller)
 *   - OTel GenAI semantic conventions: gen_ai.* attributes
 *   - Backward-compatible withTrace() API
 *   - getActiveTrace(traceId) for log enrichment from anywhere
 *
 * Reference: OpenTelemetry GenAI SemConv v1.37+, Langfuse, AgentOps
 */

import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export type SpanKind =
  | 'llm'
  | 'tool'
  | 'rag'
  | 'guardrail'
  | 'memory'
  | 'workflow'
  | 'http'
  | 'db'
  | 'custom';

export type SpanStatus = 'unset' | 'ok' | 'error';

export interface SpanAttributes {
  // OTel GenAI conventions
  'gen_ai.system'?: string;
  'gen_ai.request.model'?: string;
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  // Cost tracking
  'cost.usd'?: number;
  // Free-form
  [key: string]: unknown;
}

export interface SpanData {
  span_id: string;
  parent_span_id: string | null;
  trace_id: string;
  name: string;
  kind: SpanKind;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  status: SpanStatus;
  status_message?: string;
  input?: unknown;
  output?: unknown;
  attributes: SpanAttributes;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export interface TraceData {
  trace_id: string;
  agent_id?: string;
  session_id?: string;
  user_id?: string;
  workflow_id?: string;
  start_time: number;
  end_time: number | null;
  status: 'running' | 'ok' | 'error';
  spans: SpanData[];
}

export interface TraceOptions {
  agentId?: string;
  sessionId?: string;
  userId?: string;
  workflowId?: string;
  rootName?: string;
}

// Backward-compat alias for the previous TraceSpan shape
export interface LegacySpanInput {
  name: string;
  type: SpanKind;
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

// ═══════════════════════════════════════════════════════════════
// In-flight trace registry (race-safe; no global mutable "current")
// ═══════════════════════════════════════════════════════════════

const activeTraces = new Map<string, TraceContext>();

/**
 * Public lookup: get the in-flight trace by id from anywhere in the app.
 * Useful for enriching logs with the active trace_id.
 */
export function getActiveTrace(traceId: string): TraceContext | undefined {
  return activeTraces.get(traceId);
}

export function listActiveTraces(): string[] {
  return Array.from(activeTraces.keys());
}

// ═══════════════════════════════════════════════════════════════
// Span — represents one operation; auto-times via end()
// ═══════════════════════════════════════════════════════════════

export class Span {
  private data: SpanData;
  private ended = false;

  constructor(
    name: string,
    kind: SpanKind,
    traceId: string,
    parentSpanId: string | null
  ) {
    this.data = {
      span_id: cryptoRandomId(),
      parent_span_id: parentSpanId,
      trace_id: traceId,
      name,
      kind,
      start_time: Date.now(),
      end_time: null,
      duration_ms: null,
      status: 'unset',
      attributes: {},
      events: [],
    };
  }

  setAttribute(key: string, value: unknown): this {
    this.data.attributes[key] = value;
    return this;
  }

  setAttributes(attrs: SpanAttributes): this {
    Object.assign(this.data.attributes, attrs);
    return this;
  }

  setInput(input: unknown): this {
    this.data.input = input;
    return this;
  }

  setOutput(output: unknown): this {
    this.data.output = output;
    return this;
  }

  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.data.events.push({ name, timestamp: Date.now(), attributes });
    return this;
  }

  setStatus(status: SpanStatus, message?: string): this {
    this.data.status = status;
    if (message) this.data.status_message = message;
    return this;
  }

  end(status: SpanStatus = 'ok'): SpanData {
    if (this.ended) return this.data;
    this.ended = true;
    this.data.end_time = Date.now();
    this.data.duration_ms = this.data.end_time - this.data.start_time;
    if (this.data.status === 'unset') this.data.status = status;
    return this.data;
  }

  get id(): string {
    return this.data.span_id;
  }

  get traceId(): string {
    return this.data.trace_id;
  }

  snapshot(): SpanData {
    return { ...this.data };
  }
}

// ═══════════════════════════════════════════════════════════════
// TraceContext — per-call container; ZERO shared mutable state
// ═══════════════════════════════════════════════════════════════

export class TraceContext {
  readonly traceId: string;
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly workflowId?: string;
  readonly startTime: number;

  private spans: Span[] = [];
  private spanStack: string[] = []; // for nested span tracking
  private status: 'running' | 'ok' | 'error' = 'running';
  private endTime: number | null = null;

  constructor(options: TraceOptions) {
    this.traceId = cryptoRandomId();
    this.agentId = options.agentId;
    this.sessionId = options.sessionId;
    this.userId = options.userId;
    this.workflowId = options.workflowId;
    this.startTime = Date.now();
    activeTraces.set(this.traceId, this);
  }

  /**
   * Start a new span. If a parent is currently open (last in stack),
   * it becomes parent_span_id automatically.
   */
  startSpan(name: string, kind: SpanKind = 'custom'): Span {
    const parentSpanId = this.spanStack[this.spanStack.length - 1] ?? null;
    const span = new Span(name, kind, this.traceId, parentSpanId);
    this.spans.push(span);
    this.spanStack.push(span.id);
    return span;
  }

  /**
   * End a specific span and pop it from the parent stack if it's on top.
   */
  endSpan(span: Span, status: SpanStatus = 'ok'): void {
    span.end(status);
    const idx = this.spanStack.lastIndexOf(span.id);
    if (idx >= 0) this.spanStack.splice(idx, 1);
  }

  /**
   * Convenience: wrap an async function in a span. Auto-ends with
   * 'ok' on success, 'error' (with message) on throw.
   */
  async withSpan<T>(
    name: string,
    kind: SpanKind,
    fn: (span: Span) => Promise<T>
  ): Promise<T> {
    const span = this.startSpan(name, kind);
    try {
      const result = await fn(span);
      this.endSpan(span, 'ok');
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      span.setStatus('error', msg);
      this.endSpan(span, 'error');
      throw err;
    }
  }

  /**
   * Backward-compat: accept the previous addSpan({ name, type, ... })
   * shape and convert it into a finalized span.
   */
  addLegacySpan(input: LegacySpanInput): void {
    const span = new Span(input.name, input.type, this.traceId, null);
    if (input.model) span.setAttribute('gen_ai.request.model', input.model);
    if (input.inputTokens != null) span.setAttribute('gen_ai.usage.input_tokens', input.inputTokens);
    if (input.outputTokens != null) span.setAttribute('gen_ai.usage.output_tokens', input.outputTokens);
    if (input.costUsd != null) span.setAttribute('cost.usd', input.costUsd);
    if (input.input) span.setInput(input.input);
    if (input.output) span.setOutput(input.output);
    if (input.metadata) {
      for (const [k, v] of Object.entries(input.metadata)) {
        span.setAttribute(k, v);
      }
    }
    if (input.durationMs != null) {
      span.setAttribute('legacy.duration_ms', input.durationMs);
    }
    span.end(input.status === 'error' ? 'error' : 'ok');
    this.spans.push(span);
  }

  end(status: 'ok' | 'error' = 'ok'): TraceData {
    this.status = status;
    this.endTime = Date.now();
    activeTraces.delete(this.traceId);

    const traceData: TraceData = {
      trace_id: this.traceId,
      agent_id: this.agentId,
      session_id: this.sessionId,
      user_id: this.userId,
      workflow_id: this.workflowId,
      start_time: this.startTime,
      end_time: this.endTime,
      status: this.status,
      spans: this.spans.map((s) => s.snapshot()),
    };

    // Fire-and-forget exports — never block the caller
    void exportToSupabase(traceData);
    void exportToLangfuse(traceData);
    void exportUsageRecord(traceData);

    return traceData;
  }

  // Read-only views

  get spanCount(): number {
    return this.spans.length;
  }

  get totalTokens(): number {
    return this.spans.reduce((sum, s) => {
      const a = s.snapshot().attributes;
      return (
        sum +
        Number(a['gen_ai.usage.input_tokens'] ?? 0) +
        Number(a['gen_ai.usage.output_tokens'] ?? 0)
      );
    }, 0);
  }

  get totalCostUsd(): number {
    return this.spans.reduce(
      (sum, s) => sum + Number(s.snapshot().attributes['cost.usd'] ?? 0),
      0
    );
  }

  snapshot(): TraceData {
    return {
      trace_id: this.traceId,
      agent_id: this.agentId,
      session_id: this.sessionId,
      user_id: this.userId,
      workflow_id: this.workflowId,
      start_time: this.startTime,
      end_time: this.endTime,
      status: this.status,
      spans: this.spans.map((s) => s.snapshot()),
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// Exporters (fire-and-forget — never await from caller)
// ═══════════════════════════════════════════════════════════════

async function exportToSupabase(trace: TraceData): Promise<void> {
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

let langfuseConfig: { url: string; publicKey: string } | null = null;

export function configureLangfuse(url: string, publicKey: string): void {
  langfuseConfig = { url, publicKey };
}

async function exportToLangfuse(trace: TraceData): Promise<void> {
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

async function exportUsageRecord(trace: TraceData): Promise<void> {
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

// ═══════════════════════════════════════════════════════════════
// Top-level helpers
// ═══════════════════════════════════════════════════════════════

/**
 * Start a new trace and return its context. Caller is responsible for
 * calling `ctx.end()` when done. Prefer `withTrace()` for auto-cleanup.
 */
export function startTrace(options: TraceOptions = {}): TraceContext {
  return new TraceContext(options);
}

/**
 * Wrap an async function in a trace. Auto-ends with 'ok' on success,
 * 'error' on throw. Backward-compatible with the previous signature.
 *
 * Old API: withTrace(name, fn(addSpan), options)
 * New API: ctx is now the second argument of fn — addSpan is still
 * provided for backward compatibility.
 */
export async function withTrace<T>(
  name: string,
  fn: (
    addSpan: (span: LegacySpanInput) => void,
    ctx: TraceContext
  ) => Promise<T>,
  options: TraceOptions = {}
): Promise<T> {
  const ctx = startTrace({ ...options, rootName: name });
  try {
    const result = await fn((legacySpan) => ctx.addLegacySpan(legacySpan), ctx);
    ctx.end('ok');
    return result;
  } catch (err) {
    ctx.end('error');
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Backward-compat singleton facade (no shared state — delegates per call)
// ═══════════════════════════════════════════════════════════════

let legacyCurrent: TraceContext | null = null;

/**
 * @deprecated Use `withTrace()` or `startTrace()` directly. The singleton
 * `tracer` exists only for backward compatibility with code that called
 * `tracer.startTrace()` / `tracer.endTrace()`. It is NOT race-safe under
 * parallel use — each call still mutates a shared `legacyCurrent`.
 */
export const tracer = {
  startTrace(options: TraceOptions = {}): string {
    legacyCurrent = startTrace(options);
    return legacyCurrent.traceId;
  },
  addSpan(span: LegacySpanInput): void {
    legacyCurrent?.addLegacySpan(span);
  },
  async endTrace(status: 'success' | 'error' = 'success'): Promise<void> {
    if (!legacyCurrent) return;
    legacyCurrent.end(status === 'error' ? 'error' : 'ok');
    legacyCurrent = null;
  },
  configureLangfuse(url: string, publicKey: string): void {
    configureLangfuse(url, publicKey);
  },
};

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function cryptoRandomId(): string {
  // Prefer Web Crypto when available; fall back to Math.random for
  // environments without crypto (e.g. some test runners).
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
