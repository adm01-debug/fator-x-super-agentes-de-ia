/**
 * Tracing tests (T20.1)
 *
 * Critical: PROVES that the T19 rewrite fixed the race condition where
 * parallel traces would overwrite each other's spans on the old singleton
 * NexusTracer.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase BEFORE importing tracing
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  startTrace,
  withTrace,
  Span,
  TraceContext,
  getActiveTrace,
  listActiveTraces,
  tracer,
} from '@/lib/tracing';

describe('tracing — TraceContext basics', () => {
  beforeEach(() => {
    // Clean any leftover active traces from prior tests
    for (const id of listActiveTraces()) {
      const ctx = getActiveTrace(id);
      ctx?.end('ok');
    }
  });

  it('startTrace returns a context with unique id', () => {
    const a = startTrace({ agentId: 'agent-1' });
    const b = startTrace({ agentId: 'agent-2' });
    expect(a.traceId).not.toBe(b.traceId);
    expect(a.agentId).toBe('agent-1');
    expect(b.agentId).toBe('agent-2');
    a.end('ok');
    b.end('ok');
  });

  it('startSpan returns a Span with auto-generated id', () => {
    const ctx = startTrace();
    const span = ctx.startSpan('llm-call', 'llm');
    expect(span).toBeInstanceOf(Span);
    expect(span.id).toBeTruthy();
    expect(span.traceId).toBe(ctx.traceId);
    ctx.endSpan(span);
    ctx.end('ok');
  });

  it('Span.end auto-computes duration_ms', async () => {
    const ctx = startTrace();
    const span = ctx.startSpan('slow-op', 'tool');
    await new Promise((r) => setTimeout(r, 15));
    const data = span.end('ok');
    expect(data.duration_ms).toBeGreaterThanOrEqual(10);
    expect(data.end_time).toBeGreaterThan(data.start_time);
    expect(data.status).toBe('ok');
    ctx.end('ok');
  });

  it('nested spans get parent_span_id from the stack', () => {
    const ctx = startTrace();
    const parent = ctx.startSpan('outer', 'workflow');
    const child = ctx.startSpan('inner', 'llm');
    expect(child.snapshot().parent_span_id).toBe(parent.id);
    expect(parent.snapshot().parent_span_id).toBeNull();
    ctx.endSpan(child);
    ctx.endSpan(parent);
    ctx.end('ok');
  });

  it('Span.setAttribute and setAttributes accumulate', () => {
    const ctx = startTrace();
    const span = ctx.startSpan('llm', 'llm');
    span.setAttribute('gen_ai.request.model', 'claude-sonnet-4-5');
    span.setAttributes({
      'gen_ai.usage.input_tokens': 100,
      'gen_ai.usage.output_tokens': 50,
      'cost.usd': 0.0123,
    });
    const snap = span.snapshot();
    expect(snap.attributes['gen_ai.request.model']).toBe('claude-sonnet-4-5');
    expect(snap.attributes['gen_ai.usage.input_tokens']).toBe(100);
    expect(snap.attributes['cost.usd']).toBe(0.0123);
    ctx.end('ok');
  });

  it('totalTokens and totalCostUsd aggregate from all spans', () => {
    const ctx = startTrace();
    const s1 = ctx.startSpan('llm-1', 'llm');
    s1.setAttributes({
      'gen_ai.usage.input_tokens': 100,
      'gen_ai.usage.output_tokens': 50,
      'cost.usd': 0.01,
    });
    ctx.endSpan(s1);
    const s2 = ctx.startSpan('llm-2', 'llm');
    s2.setAttributes({
      'gen_ai.usage.input_tokens': 200,
      'gen_ai.usage.output_tokens': 75,
      'cost.usd': 0.02,
    });
    ctx.endSpan(s2);
    expect(ctx.totalTokens).toBe(425);
    expect(ctx.totalCostUsd).toBeCloseTo(0.03, 6);
    ctx.end('ok');
  });
});

describe('tracing — withTrace helper', () => {
  it('runs the function and returns its result on success', async () => {
    const result = await withTrace(
      'test-op',
      async (addSpan) => {
        addSpan({ name: 'inner', type: 'llm', costUsd: 0.001 });
        return 42;
      }
    );
    expect(result).toBe(42);
  });

  it('propagates errors and still ends the trace', async () => {
    const before = listActiveTraces().length;
    await expect(
      withTrace('bad-op', async () => {
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');
    // Trace should be removed from active registry even after error
    expect(listActiveTraces().length).toBe(before);
  });

  it('passes the TraceContext as second arg', async () => {
    let captured: TraceContext | null = null;
    await withTrace('op', async (_addSpan, ctx) => {
      captured = ctx;
      const span = ctx.startSpan('child', 'llm');
      ctx.endSpan(span);
    });
    expect(captured).not.toBeNull();
    expect(captured!.spanCount).toBe(1);
  });

  it('TraceContext.withSpan auto-ends with error status on throw', async () => {
    const ctx = startTrace();
    await expect(
      ctx.withSpan('failing', 'tool', async () => {
        throw new Error('span error');
      })
    ).rejects.toThrow('span error');
    const snap = ctx.snapshot();
    expect(snap.spans.length).toBe(1);
    expect(snap.spans[0].status).toBe('error');
    expect(snap.spans[0].status_message).toBe('span error');
    ctx.end('ok');
  });
});

describe('tracing — RACE CONDITION FIX (the critical T19 test)', () => {
  it('two parallel traces NEVER share spans', async () => {
    // Run 5 parallel "agent executions" each with multiple spans.
    // The old singleton tracer would mix all spans into one trace.
    // The new per-call TraceContext must keep them perfectly isolated.

    const runAgent = async (agentId: string, spanCount: number): Promise<TraceContext> => {
      const ctx = startTrace({ agentId });
      for (let i = 0; i < spanCount; i++) {
        const span = ctx.startSpan(`${agentId}-span-${i}`, 'llm');
        span.setAttribute('gen_ai.usage.input_tokens', i * 10);
        // Yield to event loop to interleave with other agents
        await new Promise((r) => setTimeout(r, 1));
        ctx.endSpan(span);
      }
      return ctx;
    };

    const contexts = await Promise.all([
      runAgent('agent-A', 3),
      runAgent('agent-B', 5),
      runAgent('agent-C', 2),
      runAgent('agent-D', 4),
      runAgent('agent-E', 6),
    ]);

    // Each trace must have ONLY its own spans
    expect(contexts[0].spanCount).toBe(3);
    expect(contexts[1].spanCount).toBe(5);
    expect(contexts[2].spanCount).toBe(2);
    expect(contexts[3].spanCount).toBe(4);
    expect(contexts[4].spanCount).toBe(6);

    // Every span must belong to its own trace_id
    for (const ctx of contexts) {
      const snap = ctx.snapshot();
      for (const span of snap.spans) {
        expect(span.trace_id).toBe(ctx.traceId);
        expect(span.name.startsWith(ctx.agentId!)).toBe(true);
      }
    }

    // Trace IDs must all be unique
    const ids = contexts.map((c) => c.traceId);
    expect(new Set(ids).size).toBe(ids.length);

    // Cleanup
    contexts.forEach((c) => c.end('ok'));
  });

  it('parallel withTrace calls return correct results without cross-contamination', async () => {
    const results = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        withTrace(`op-${i}`, async (_addSpan, ctx) => {
          // Add unique spans to each
          for (let j = 0; j < 3; j++) {
            const span = ctx.startSpan(`s-${i}-${j}`, 'tool');
            await new Promise((r) => setTimeout(r, 1));
            ctx.endSpan(span);
          }
          return { trace: ctx.traceId, spans: ctx.spanCount };
        })
      )
    );

    // All trace IDs unique
    const ids = results.map((r) => r.trace);
    expect(new Set(ids).size).toBe(10);
    // All have exactly 3 spans (no cross-contamination)
    results.forEach((r) => expect(r.spans).toBe(3));
  });
});

describe('tracing — active trace registry', () => {
  it('getActiveTrace returns context while running, undefined after end', () => {
    const ctx = startTrace({ agentId: 'a1' });
    expect(getActiveTrace(ctx.traceId)).toBe(ctx);
    ctx.end('ok');
    expect(getActiveTrace(ctx.traceId)).toBeUndefined();
  });

  it('listActiveTraces reflects in-flight traces', () => {
    const before = listActiveTraces().length;
    const a = startTrace();
    const b = startTrace();
    expect(listActiveTraces().length).toBe(before + 2);
    a.end('ok');
    expect(listActiveTraces().length).toBe(before + 1);
    b.end('ok');
    expect(listActiveTraces().length).toBe(before);
  });
});

describe('tracing — backward compat', () => {
  it('legacy tracer.startTrace + addSpan + endTrace works', async () => {
    const id = tracer.startTrace({ agentId: 'legacy' });
    expect(id).toBeTruthy();
    tracer.addSpan({
      name: 'legacy-call',
      type: 'llm',
      model: 'claude',
      inputTokens: 50,
      outputTokens: 25,
      costUsd: 0.005,
    });
    await tracer.endTrace('success');
    // No throw = pass
  });

  it('legacy addLegacySpan stores OTel attributes', () => {
    const ctx = startTrace();
    ctx.addLegacySpan({
      name: 'old-style',
      type: 'rag',
      model: 'gpt-4',
      inputTokens: 200,
      outputTokens: 100,
      costUsd: 0.012,
      durationMs: 350,
      metadata: { source: 'kb-1' },
    });
    const snap = ctx.snapshot();
    expect(snap.spans.length).toBe(1);
    const span = snap.spans[0];
    expect(span.attributes['gen_ai.request.model']).toBe('gpt-4');
    expect(span.attributes['gen_ai.usage.input_tokens']).toBe(200);
    expect(span.attributes['cost.usd']).toBe(0.012);
    expect(span.attributes['legacy.duration_ms']).toBe(350);
    expect(span.attributes['source']).toBe('kb-1');
    ctx.end('ok');
  });
});
