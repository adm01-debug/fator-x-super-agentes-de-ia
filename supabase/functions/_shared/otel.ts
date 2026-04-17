/**
 * Sprint 26 — OpenTelemetry-compatible tracer for Edge Functions.
 *
 * Mini-tracer that mirrors the client `src/lib/tracing.ts` schema and
 * exports to the same Supabase tables (`traces`, `spans`). Accepts W3C
 * Trace Context (`traceparent` header) for cross-tier correlation
 * (client → edge → DB) so a single trace ID surfaces the full waterfall.
 *
 * Usage:
 *   const ctx = startEdgeTrace(req, { rootName: 'llm-gateway.handle', userId });
 *   await ctx.withSpan('auth.verify', 'auth', async (span) => { ... });
 *   ctx.end('ok');
 *
 * Design constraints:
 *  - No deps beyond Deno std + supabase-js (already loaded by callers)
 *  - Fire-and-forget exports (never blocks the response path)
 *  - Fail-closed-on-tracing: any tracer error must NOT throw to the handler
 *  - Honours `traceparent` per W3C spec: 00-{32-hex traceId}-{16-hex spanId}-{2-hex flags}
 */
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export type SpanKind =
  | "server"
  | "client"
  | "llm"
  | "tool"
  | "auth"
  | "guardrail"
  | "db"
  | "http"
  | "custom";

export type SpanStatus = "unset" | "ok" | "error";

interface SpanRecord {
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
  attributes: Record<string, unknown>;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
  input?: unknown;
  output?: unknown;
}

interface TraceRecord {
  trace_id: string;
  parent_trace_id?: string | null;
  root_name: string;
  user_id?: string;
  agent_id?: string;
  session_id?: string;
  workflow_id?: string;
  start_time: number;
  end_time: number | null;
  status: "running" | "ok" | "error";
  spans: SpanRecord[];
  source: "edge";
}

// ───────────────────────────────────────────────────────────────
// W3C Trace Context parsing
// ───────────────────────────────────────────────────────────────

function parseTraceparent(header: string | null): { traceId: string; parentSpanId: string } | null {
  if (!header) return null;
  // Format: 00-{32 hex traceId}-{16 hex spanId}-{2 hex flags}
  const parts = header.trim().split("-");
  if (parts.length !== 4) return null;
  const [version, traceId, spanId, flags] = parts;
  if (version !== "00" || traceId.length !== 32 || spanId.length !== 16 || flags.length !== 2) return null;
  if (!/^[0-9a-f]+$/i.test(traceId) || !/^[0-9a-f]+$/i.test(spanId)) return null;
  return { traceId: traceId.toLowerCase(), parentSpanId: spanId.toLowerCase() };
}

function newId(bytes: 16 | 8): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// ───────────────────────────────────────────────────────────────
// Span
// ───────────────────────────────────────────────────────────────

export class EdgeSpan {
  private rec: SpanRecord;
  private ended = false;

  constructor(name: string, kind: SpanKind, traceId: string, parentSpanId: string | null) {
    this.rec = {
      span_id: newId(8),
      parent_span_id: parentSpanId,
      trace_id: traceId,
      name,
      kind,
      start_time: Date.now(),
      end_time: null,
      duration_ms: null,
      status: "unset",
      attributes: {},
      events: [],
    };
  }

  setAttribute(key: string, value: unknown): this {
    this.rec.attributes[key] = value;
    return this;
  }

  setAttributes(attrs: Record<string, unknown>): this {
    Object.assign(this.rec.attributes, attrs);
    return this;
  }

  setInput(input: unknown): this { this.rec.input = input; return this; }
  setOutput(output: unknown): this { this.rec.output = output; return this; }
  addEvent(name: string, attributes?: Record<string, unknown>): this {
    this.rec.events.push({ name, timestamp: Date.now(), attributes });
    return this;
  }
  setStatus(status: SpanStatus, message?: string): this {
    this.rec.status = status;
    if (message) this.rec.status_message = message;
    return this;
  }

  end(status: SpanStatus = "ok"): SpanRecord {
    if (this.ended) return this.rec;
    this.ended = true;
    this.rec.end_time = Date.now();
    this.rec.duration_ms = this.rec.end_time - this.rec.start_time;
    if (this.rec.status === "unset") this.rec.status = status;
    return this.rec;
  }

  get id(): string { return this.rec.span_id; }
  snapshot(): SpanRecord { return { ...this.rec }; }
}

// ───────────────────────────────────────────────────────────────
// Trace context
// ───────────────────────────────────────────────────────────────

export interface EdgeTraceOptions {
  rootName: string;
  userId?: string;
  agentId?: string;
  sessionId?: string;
  workflowId?: string;
}

export class EdgeTraceContext {
  readonly traceId: string;
  readonly parentSpanIdFromHeader: string | null;
  readonly rootName: string;
  readonly userId?: string;
  readonly agentId?: string;
  readonly sessionId?: string;
  readonly workflowId?: string;
  readonly startTime: number;
  private spans: EdgeSpan[] = [];
  private spanStack: string[] = [];
  private status: "running" | "ok" | "error" = "running";
  private endTime: number | null = null;

  constructor(opts: EdgeTraceOptions, parsed: { traceId: string; parentSpanId: string } | null) {
    this.traceId = parsed?.traceId ?? newId(16);
    this.parentSpanIdFromHeader = parsed?.parentSpanId ?? null;
    this.rootName = opts.rootName;
    this.userId = opts.userId;
    this.agentId = opts.agentId;
    this.sessionId = opts.sessionId;
    this.workflowId = opts.workflowId;
    this.startTime = Date.now();
  }

  startSpan(name: string, kind: SpanKind = "custom"): EdgeSpan {
    const parentSpanId = this.spanStack[this.spanStack.length - 1] ?? this.parentSpanIdFromHeader;
    const span = new EdgeSpan(name, kind, this.traceId, parentSpanId);
    this.spans.push(span);
    this.spanStack.push(span.id);
    return span;
  }

  endSpan(span: EdgeSpan, status: SpanStatus = "ok"): void {
    span.end(status);
    const idx = this.spanStack.lastIndexOf(span.id);
    if (idx >= 0) this.spanStack.splice(idx, 1);
  }

  async withSpan<T>(name: string, kind: SpanKind, fn: (span: EdgeSpan) => Promise<T> | T): Promise<T> {
    const span = this.startSpan(name, kind);
    try {
      const result = await fn(span);
      this.endSpan(span, "ok");
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      span.setStatus("error", msg);
      this.endSpan(span, "error");
      throw err;
    }
  }

  end(status: "ok" | "error" = "ok"): TraceRecord {
    this.status = status;
    this.endTime = Date.now();
    // Auto-close any orphan spans
    for (const s of this.spans) {
      if (s.snapshot().end_time == null) s.end(status);
    }
    const record: TraceRecord = {
      trace_id: this.traceId,
      parent_trace_id: this.parentSpanIdFromHeader ? null : null,
      root_name: this.rootName,
      user_id: this.userId,
      agent_id: this.agentId,
      session_id: this.sessionId,
      workflow_id: this.workflowId,
      start_time: this.startTime,
      end_time: this.endTime,
      status: this.status,
      spans: this.spans.map((s) => s.snapshot()),
      source: "edge",
    };
    void exportTrace(record);
    return record;
  }

  /** Return a `traceparent` value to forward downstream (e.g. to LLM provider). */
  toTraceparent(currentSpan?: EdgeSpan): string {
    const spanId = currentSpan?.id ?? this.spanStack[this.spanStack.length - 1] ?? newId(8);
    return `00-${this.traceId}-${spanId}-01`;
  }
}

// ───────────────────────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────────────────────

export function startEdgeTrace(req: Request, opts: EdgeTraceOptions): EdgeTraceContext {
  const parsed = parseTraceparent(req.headers.get("traceparent"));
  return new EdgeTraceContext(opts, parsed);
}

// ───────────────────────────────────────────────────────────────
// Exporter — fire-and-forget, never throws
// ───────────────────────────────────────────────────────────────

let exporterClient: SupabaseClient | null = null;
function getExporter(): SupabaseClient | null {
  if (exporterClient) return exporterClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  try {
    exporterClient = createClient(url, key, { auth: { persistSession: false } });
    return exporterClient;
  } catch {
    return null;
  }
}

async function exportTrace(record: TraceRecord): Promise<void> {
  const supa = getExporter();
  if (!supa) return;
  try {
    // Best-effort insert into `traces` (mirrors client schema).
    // Schema may evolve; ignore failures silently — tracing must not break the handler.
    await supa.from("traces").insert({
      trace_id: record.trace_id,
      root_name: record.root_name,
      user_id: record.user_id ?? null,
      agent_id: record.agent_id ?? null,
      session_id: record.session_id ?? null,
      workflow_id: record.workflow_id ?? null,
      start_time: new Date(record.start_time).toISOString(),
      end_time: record.end_time ? new Date(record.end_time).toISOString() : null,
      status: record.status,
      source: record.source,
      span_count: record.spans.length,
    }).then(() => {}, () => {});

    if (record.spans.length > 0) {
      const rows = record.spans.map((s) => ({
        span_id: s.span_id,
        trace_id: s.trace_id,
        parent_span_id: s.parent_span_id,
        name: s.name,
        kind: s.kind,
        start_time: new Date(s.start_time).toISOString(),
        end_time: s.end_time ? new Date(s.end_time).toISOString() : null,
        duration_ms: s.duration_ms,
        status: s.status,
        status_message: s.status_message ?? null,
        attributes: s.attributes,
        events: s.events,
      }));
      await supa.from("spans").insert(rows).then(() => {}, () => {});
    }
  } catch {
    // swallow — tracing is best-effort
  }
}
