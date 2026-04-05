/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Edge Function Tracing Helper
 * ═══════════════════════════════════════════════════════════════
 * Structured tracing + cost tracking for all edge functions.
 * Wrap your handler with `withTracing()` to get:
 * - Automatic latency measurement
 * - Structured JSON logs
 * - Error capture with stack traces
 * - Cost tracking header
 * - Request ID propagation
 *
 * Usage:
 *   import { withTracing } from "../_shared/tracing.ts";
 *   Deno.serve(withTracing("my-function", handler));
 */

export interface TraceContext {
  requestId: string;
  functionName: string;
  startTime: number;
  userId?: string;
  metadata: Record<string, unknown>;
  /** Add structured data to the trace */
  annotate: (key: string, value: unknown) => void;
  /** Record token usage for cost tracking */
  recordUsage: (inputTokens: number, outputTokens: number, costUsd: number) => void;
}

interface UsageData {
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

function generateRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Wrap an edge function handler with structured tracing.
 */
export function withTracing(
  functionName: string,
  handler: (req: Request, ctx: TraceContext) => Promise<Response>
): (req: Request) => Promise<Response> {
  return async (req: Request): Promise<Response> => {
    const requestId = req.headers.get('x-request-id') ?? generateRequestId();
    const startTime = Date.now();
    const annotations: Record<string, unknown> = {};
    let usage: UsageData | undefined;

    const traceCtx: TraceContext = {
      requestId,
      functionName,
      startTime,
      metadata: {},
      annotate: (key, value) => { annotations[key] = value; },
      recordUsage: (inputTokens, outputTokens, costUsd) => {
        usage = { inputTokens, outputTokens, costUsd };
      },
    };

    // Extract user from auth header if present
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const payload = JSON.parse(atob(authHeader.split('.')[1]));
        traceCtx.userId = payload.sub;
      } catch { /* JWT decode failed, non-critical */ }
    }

    // Log request start
    console.log(JSON.stringify({
      level: 'info',
      event: 'request_start',
      function: functionName,
      request_id: requestId,
      method: req.method,
      path: new URL(req.url).pathname,
      user_id: traceCtx.userId ?? 'anonymous',
      timestamp: new Date().toISOString(),
    }));

    try {
      const response = await handler(req, traceCtx);
      const durationMs = Date.now() - startTime;

      // Log request completion
      console.log(JSON.stringify({
        level: 'info',
        event: 'request_end',
        function: functionName,
        request_id: requestId,
        status: response.status,
        duration_ms: durationMs,
        ...(usage ? {
          input_tokens: usage.inputTokens,
          output_tokens: usage.outputTokens,
          cost_usd: usage.costUsd,
        } : {}),
        ...annotations,
        timestamp: new Date().toISOString(),
      }));

      // Add tracing headers to response
      const headers = new Headers(response.headers);
      headers.set('x-request-id', requestId);
      headers.set('x-duration-ms', String(durationMs));
      if (usage) headers.set('x-cost-usd', usage.costUsd.toFixed(6));

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMsg = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack?.split('\n').slice(0, 5).join('\n') : undefined;

      // Log error
      console.error(JSON.stringify({
        level: 'error',
        event: 'request_error',
        function: functionName,
        request_id: requestId,
        error: errorMsg,
        stack,
        duration_ms: durationMs,
        ...annotations,
        timestamp: new Date().toISOString(),
      }));

      return new Response(JSON.stringify({ error: errorMsg, request_id: requestId }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'x-request-id': requestId,
          'x-duration-ms': String(durationMs),
        },
      });
    }
  };
}

/**
 * Create a child span for tracing sub-operations within a handler.
 */
export function createSpan(parent: TraceContext, spanName: string) {
  const spanStart = Date.now();

  return {
    end: (metadata?: Record<string, unknown>) => {
      const spanDuration = Date.now() - spanStart;
      parent.annotate(`span_${spanName}_ms`, spanDuration);
      if (metadata) {
        Object.entries(metadata).forEach(([k, v]) => {
          parent.annotate(`span_${spanName}_${k}`, v);
        });
      }
    },
  };
}
