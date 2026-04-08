/**
 * executeWorkflow tracer instrumentation tests (next-frontier sprint #3)
 *
 * Verifies that executeWorkflow:
 * - Wraps the entire run in a trace
 * - Creates 1 span for the engine_invoke attempt
 * - Falls back to step-by-step on engine error and creates 1 span per step
 * - Sets the documented attributes on each span (workflow.id, model, etc)
 *
 * Mocks supabase.functions.invoke so the engine path can be controlled.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    functions: { invoke: (...args: unknown[]) => mockInvoke(...args) },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/supabaseExtended', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Capture trace data emitted by the tracer's exporter so we can assert
// on the resulting span tree.
const capturedTraces: unknown[] = [];

vi.mock('@/lib/tracing', async () => {
  const actual = await vi.importActual<typeof import('@/lib/tracing')>('@/lib/tracing');
  return {
    ...actual,
    // Wrap withTrace to also push the resulting trace into capturedTraces
    withTrace: async <T>(
      name: string,
      fn: (
        addSpan: (s: unknown) => void,
        ctx: import('@/lib/tracing').TraceContext
      ) => Promise<T>,
      options: import('@/lib/tracing').TraceOptions = {}
    ) => {
      const ctx = actual.startTrace({ ...options, rootName: name });
      try {
        const result = await fn(((s: unknown) => ctx.addLegacySpan(s as never)) as never, ctx);
        const traceData = ctx.end('ok');
        capturedTraces.push({ name, ...traceData });
        return result;
      } catch (err) {
        const traceData = ctx.end('error');
        capturedTraces.push({ name, ...traceData });
        throw err;
      }
    },
  };
});

import { executeWorkflow } from '@/services/workflowsService';

describe('executeWorkflow — tracer instrumentation', () => {
  beforeEach(() => {
    mockInvoke.mockReset();
    capturedTraces.length = 0;
  });

  it('wraps execution in a trace named workflow.<name>', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'completed', steps_executed: 3, total_cost_usd: 0.05 },
      error: null,
    });
    await executeWorkflow('wf-1', 'TestFlow', ['a', 'b', 'c']);
    expect(capturedTraces.length).toBe(1);
    expect((capturedTraces[0] as { name: string }).name).toBe('workflow.TestFlow');
  });

  it('engine path creates exactly one engine_invoke span', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'completed', steps_executed: 3, total_cost_usd: 0.05 },
      error: null,
    });
    await executeWorkflow('wf-2', 'EnginePath', ['x']);
    const trace = capturedTraces[0] as { spans: Array<{ name: string; kind: string }> };
    const engineSpans = trace.spans.filter((s) => s.name === 'workflow.engine_invoke');
    expect(engineSpans.length).toBe(1);
    expect(engineSpans[0].kind).toBe('tool');
  });

  it('engine path returns the steps_executed and cost from the engine', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'completed', steps_executed: 7, total_cost_usd: 0.42 },
      error: null,
    });
    const result = await executeWorkflow('wf-3', 'EngineReturn', ['a', 'b']);
    expect(result.stepsExecuted).toBe(7);
    expect(result.cost).toBe(0.42);
  });

  it('falls back to step-by-step when engine errors, creating one span per step', async () => {
    let calls = 0;
    mockInvoke.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) {
        // engine call fails
        return { data: null, error: { message: 'engine down' } };
      }
      // each fallback llm-gateway call succeeds
      return {
        data: { content: `step output ${calls}`, cost_usd: 0.01, input_tokens: 100, output_tokens: 50 },
        error: null,
      };
    });

    const result = await executeWorkflow('wf-4', 'FallbackFlow', ['parser', 'enricher', 'reporter']);

    const trace = capturedTraces[0] as { spans: Array<{ name: string; kind: string }> };
    const stepSpans = trace.spans.filter((s) => s.name.startsWith('workflow.step.'));
    expect(stepSpans.length).toBe(3);
    expect(stepSpans.map((s) => s.name)).toEqual([
      'workflow.step.parser',
      'workflow.step.enricher',
      'workflow.step.reporter',
    ]);
    expect(stepSpans.every((s) => s.kind === 'agent')).toBe(true);

    expect(result.stepsExecuted).toBe(3);
    expect(result.cost).toBeCloseTo(0.03, 5); // 3 × 0.01
  });

  it('sets workflow.id, step_name, and gen_ai.request.model attributes on each step span', async () => {
    let calls = 0;
    mockInvoke.mockImplementation(async () => {
      calls += 1;
      if (calls === 1) return { data: null, error: { message: 'engine error' } };
      return { data: { content: 'ok' }, error: null };
    });

    await executeWorkflow('wf-5', 'AttrFlow', ['solo']);

    const trace = capturedTraces[0] as {
      spans: Array<{ name: string; attributes: Record<string, unknown> }>;
    };
    const step = trace.spans.find((s) => s.name === 'workflow.step.solo');
    expect(step).toBeDefined();
    expect(step!.attributes['workflow.id']).toBe('wf-5');
    expect(step!.attributes['workflow.step_name']).toBe('solo');
    expect(step!.attributes['workflow.step_index']).toBe(0);
    expect(step!.attributes['gen_ai.request.model']).toBe('claude-sonnet-4.6');
    expect(step!.attributes['workflow.engine']).toBe('fallback-llm-gateway');
  });

  it('engine_invoke span has workflow.id and steps_count attributes', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'completed', steps_executed: 2, total_cost_usd: 0.1 },
      error: null,
    });
    await executeWorkflow('wf-6', 'AttrEngine', ['a', 'b']);
    const trace = capturedTraces[0] as {
      spans: Array<{ name: string; attributes: Record<string, unknown> }>;
    };
    const engine = trace.spans.find((s) => s.name === 'workflow.engine_invoke');
    expect(engine).toBeDefined();
    expect(engine!.attributes['workflow.id']).toBe('wf-6');
    expect(engine!.attributes['workflow.name']).toBe('AttrEngine');
    expect(engine!.attributes['workflow.steps_count']).toBe(2);
    expect(engine!.attributes['workflow.engine']).toBe('workflow-engine-v2');
  });

  it('records workflow.id at the trace root via TraceOptions', async () => {
    mockInvoke.mockResolvedValue({
      data: { status: 'completed', steps_executed: 0, total_cost_usd: 0 },
      error: null,
    });
    await executeWorkflow('wf-trace-id', 'TraceIdFlow', []);
    const trace = capturedTraces[0] as { workflow_id?: string };
    expect(trace.workflow_id).toBe('wf-trace-id');
  });
});
