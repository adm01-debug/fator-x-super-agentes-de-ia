/**
 * Nexus Agents Studio — Tracing (T19 rewrite)
 * Race-safe, OpenTelemetry-aligned tracing for agent executions.
 * Types and exporters split into sub-modules for maintainability.
 */

// Re-export all types
export type {
  SpanKind, SpanStatus, SpanAttributes, SpanData,
  TraceData, TraceOptions, LegacySpanInput,
} from './tracing/tracingTypes';

import type {
  SpanKind, SpanStatus, SpanAttributes, SpanData,
  TraceData, TraceOptions, LegacySpanInput,
} from './tracing/tracingTypes';

export { configureLangfuse } from './tracing/tracingExporters';
import { exportToSupabase, exportToLangfuse, exportUsageRecord } from './tracing/tracingExporters';

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function cryptoRandomId(): string {
  return crypto.randomUUID().replace(/-/g, '');
}

// ═══════════════════════════════════════════════════════════════
// In-flight trace registry
// ═══════════════════════════════════════════════════════════════

const activeTraces = new Map<string, TraceContext>();

export function getActiveTrace(traceId: string): TraceContext | undefined {
  return activeTraces.get(traceId);
}

export function listActiveTraces(): string[] {
  return Array.from(activeTraces.keys());
}

// ═══════════════════════════════════════════════════════════════
// Span
// ═══════════════════════════════════════════════════════════════

export class Span {
  private data: SpanData;
  private ended = false;

  constructor(name: string, kind: SpanKind, traceId: string, parentSpanId: string | null) {
    this.data = { span_id: cryptoRandomId(), parent_span_id: parentSpanId, trace_id: traceId, name, kind, start_time: Date.now(), end_time: null, duration_ms: null, status: 'unset', attributes: {}, events: [] };
  }

  setAttribute(key: string, value: unknown): this { this.data.attributes[key] = value; return this; }
  setAttributes(attrs: SpanAttributes): this { Object.assign(this.data.attributes, attrs); return this; }
  setInput(input: unknown): this { this.data.input = input; return this; }
  setOutput(output: unknown): this { this.data.output = output; return this; }
  addEvent(name: string, attributes?: Record<string, unknown>): this { this.data.events.push({ name, timestamp: Date.now(), attributes }); return this; }
  setStatus(status: SpanStatus, message?: string): this { this.data.status = status; if (message) this.data.status_message = message; return this; }

  end(status: SpanStatus = 'ok'): SpanData {
    if (this.ended) return this.data;
    this.ended = true;
    this.data.end_time = Date.now();
    this.data.duration_ms = this.data.end_time - this.data.start_time;
    if (this.data.status === 'unset') this.data.status = status;
    return this.data;
  }

  get id(): string { return this.data.span_id; }
  get traceId(): string { return this.data.trace_id; }
  snapshot(): SpanData { return { ...this.data }; }
}

// ═══════════════════════════════════════════════════════════════
// TraceContext
// ═══════════════════════════════════════════════════════════════

export class TraceContext {
  readonly traceId: string;
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly userId?: string;
  readonly workflowId?: string;
  readonly startTime: number;
  private spans: Span[] = [];
  private spanStack: string[] = [];
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

  startSpan(name: string, kind: SpanKind = 'custom'): Span {
    const parentSpanId = this.spanStack[this.spanStack.length - 1] ?? null;
    const span = new Span(name, kind, this.traceId, parentSpanId);
    this.spans.push(span);
    this.spanStack.push(span.id);
    return span;
  }

  endSpan(span: Span, status: SpanStatus = 'ok'): void {
    span.end(status);
    const idx = this.spanStack.lastIndexOf(span.id);
    if (idx >= 0) this.spanStack.splice(idx, 1);
  }

  async withSpan<T>(name: string, kind: SpanKind, fn: (span: Span) => Promise<T>): Promise<T> {
    const span = this.startSpan(name, kind);
    try { const result = await fn(span); this.endSpan(span, 'ok'); return result; }
    catch (err) { const msg = err instanceof Error ? err.message : String(err); span.setStatus('error', msg); this.endSpan(span, 'error'); throw err; }
  }

  addLegacySpan(input: LegacySpanInput): void {
    const span = new Span(input.name, input.type, this.traceId, null);
    if (input.model) span.setAttribute('gen_ai.request.model', input.model);
    if (input.inputTokens != null) span.setAttribute('gen_ai.usage.input_tokens', input.inputTokens);
    if (input.outputTokens != null) span.setAttribute('gen_ai.usage.output_tokens', input.outputTokens);
    if (input.costUsd != null) span.setAttribute('cost.usd', input.costUsd);
    if (input.input) span.setInput(input.input);
    if (input.output) span.setOutput(input.output);
    if (input.metadata) for (const [k, v] of Object.entries(input.metadata)) span.setAttribute(k, v);
    if (input.durationMs != null) span.setAttribute('legacy.duration_ms', input.durationMs);
    span.end(input.status === 'error' ? 'error' : 'ok');
    this.spans.push(span);
  }

  end(status: 'ok' | 'error' = 'ok'): TraceData {
    this.status = status;
    this.endTime = Date.now();
    activeTraces.delete(this.traceId);
    const traceData: TraceData = { trace_id: this.traceId, agent_id: this.agentId, session_id: this.sessionId, user_id: this.userId, workflow_id: this.workflowId, start_time: this.startTime, end_time: this.endTime, status: this.status, spans: this.spans.map((s) => s.snapshot()) };
    void exportToSupabase(traceData);
    void exportToLangfuse(traceData);
    void exportUsageRecord(traceData);
    return traceData;
  }

  get spanCount(): number { return this.spans.length; }
  get totalTokens(): number { return this.spans.reduce((sum, s) => { const a = s.snapshot().attributes; return sum + Number(a['gen_ai.usage.input_tokens'] ?? 0) + Number(a['gen_ai.usage.output_tokens'] ?? 0); }, 0); }
  get totalCostUsd(): number { return this.spans.reduce((sum, s) => sum + Number(s.snapshot().attributes['cost.usd'] ?? 0), 0); }
  snapshot(): TraceData { return { trace_id: this.traceId, agent_id: this.agentId, session_id: this.sessionId, user_id: this.userId, workflow_id: this.workflowId, start_time: this.startTime, end_time: this.endTime, status: this.status, spans: this.spans.map((s) => s.snapshot()) }; }
}

// ═══════════════════════════════════════════════════════════════
// Top-level helpers
// ═══════════════════════════════════════════════════════════════

export function startTrace(options: TraceOptions = {}): TraceContext {
  return new TraceContext(options);
}

export async function withTrace<T>(
  name: string,
  fn: (addSpan: (span: LegacySpanInput) => void, ctx: TraceContext) => Promise<T>,
  options: TraceOptions = {}
): Promise<T> {
  const ctx = startTrace({ ...options, rootName: name });
  try { const result = await fn((legacySpan) => ctx.addLegacySpan(legacySpan), ctx); ctx.end('ok'); return result; }
  catch (err) { ctx.end('error'); throw err; }
}

// ═══════════════════════════════════════════════════════════════
// Backward-compat singleton facade
// ═══════════════════════════════════════════════════════════════

let legacyCurrent: TraceContext | null = null;

/** @deprecated Use withTrace() or startTrace() directly. */
export const tracer = {
  startTrace(options: TraceOptions = {}): string { legacyCurrent = startTrace(options); return legacyCurrent.traceId; },
  addSpan(input: LegacySpanInput): void { legacyCurrent?.addLegacySpan(input); },
  endTrace(): TraceData | null { if (!legacyCurrent) return null; const data = legacyCurrent.end('ok'); legacyCurrent = null; return data; },
};
