/**
 * middlewarePipelineService tests
 *
 * Covers: MiddlewarePipeline class, built-in middlewares (logging, caching,
 * retry, token counter, PII redaction), default pipeline factory.
 * Pure functions — no Supabase mocking needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  MiddlewarePipeline,
  createLoggingMiddleware,
  createCachingMiddleware,
  createTokenCounterMiddleware,
  createPiiRedactionMiddleware,
  createDefaultPipeline,
  type LLMRequest,
  type LLMResponse,
} from '@/services/middlewarePipelineService';

// ──────── Helpers ────────

function makeRequest(overrides?: Partial<LLMRequest>): LLMRequest {
  return {
    id: 'req-1',
    provider: 'openai',
    model: 'gpt-4',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.7,
    ...overrides,
  };
}

function makeResponse(overrides?: Partial<LLMResponse>): LLMResponse {
  return {
    id: 'res-1',
    requestId: 'req-1',
    content: 'Hi there!',
    role: 'assistant',
    provider: 'openai',
    model: 'gpt-4',
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    costUsd: 0.001,
    durationMs: 200,
    finishReason: 'stop',
    ...overrides,
  };
}

function mockExecutor(response?: Partial<LLMResponse>) {
  return vi.fn(async () => makeResponse(response));
}

// ──────── Pipeline Class ────────

describe('MiddlewarePipeline — basic operations', () => {
  let pipeline: MiddlewarePipeline;

  beforeEach(() => {
    pipeline = new MiddlewarePipeline();
  });

  it('list() returns empty for new pipeline', () => {
    expect(pipeline.list()).toEqual([]);
  });

  it('use() adds middleware and sorts by priority', () => {
    pipeline.use({
      name: 'second',
      description: '',
      enabled: true,
      priority: 20,
      fn: async (_ctx, next) => next(),
    });
    pipeline.use({
      name: 'first',
      description: '',
      enabled: true,
      priority: 10,
      fn: async (_ctx, next) => next(),
    });
    const list = pipeline.list();
    expect(list[0].name).toBe('first');
    expect(list[1].name).toBe('second');
  });

  it('remove() deletes middleware by name', () => {
    pipeline.use({
      name: 'to-remove',
      description: '',
      enabled: true,
      priority: 1,
      fn: async (_ctx, next) => next(),
    });
    pipeline.remove('to-remove');
    expect(pipeline.list()).toHaveLength(0);
  });

  it('toggle() enables/disables middleware', () => {
    pipeline.use({
      name: 'toggler',
      description: '',
      enabled: true,
      priority: 1,
      fn: async (_ctx, next) => next(),
    });
    pipeline.toggle('toggler', false);
    expect(pipeline.list()[0].enabled).toBe(false);
    pipeline.toggle('toggler', true);
    expect(pipeline.list()[0].enabled).toBe(true);
  });

  it('toggle() on non-existent name is no-op', () => {
    pipeline.toggle('nonexistent', true);
    expect(pipeline.list()).toHaveLength(0);
  });

  it('use() returns this for chaining', () => {
    const result = pipeline.use({
      name: 'a',
      description: '',
      enabled: true,
      priority: 1,
      fn: async (_ctx, next) => next(),
    });
    expect(result).toBe(pipeline);
  });
});

describe('MiddlewarePipeline — execute', () => {
  it('calls executor and returns response', async () => {
    const pipeline = new MiddlewarePipeline();
    const executor = mockExecutor();
    const ctx = await pipeline.execute(makeRequest(), executor);
    expect(ctx.response).toBeDefined();
    expect(ctx.response!.content).toBe('Hi there!');
    expect(executor).toHaveBeenCalledOnce();
  });

  it('disabled middlewares are skipped', async () => {
    const pipeline = new MiddlewarePipeline();
    const spy = vi.fn();
    pipeline.use({
      name: 'disabled-mw',
      description: '',
      enabled: false,
      priority: 1,
      fn: async (_ctx, next) => {
        spy();
        return next();
      },
    });
    await pipeline.execute(makeRequest(), mockExecutor());
    expect(spy).not.toHaveBeenCalled();
  });

  it('middlewares execute in priority order (onion model)', async () => {
    const pipeline = new MiddlewarePipeline();
    const order: string[] = [];

    pipeline.use({
      name: 'first',
      description: '',
      enabled: true,
      priority: 10,
      fn: async (_ctx, next) => {
        order.push('first-pre');
        const result = await next();
        order.push('first-post');
        return result;
      },
    });
    pipeline.use({
      name: 'second',
      description: '',
      enabled: true,
      priority: 20,
      fn: async (_ctx, next) => {
        order.push('second-pre');
        const result = await next();
        order.push('second-post');
        return result;
      },
    });

    await pipeline.execute(makeRequest(), mockExecutor());
    expect(order).toEqual(['first-pre', 'second-pre', 'second-post', 'first-post']);
  });

  it('catches executor errors and sets ctx.error', async () => {
    const pipeline = new MiddlewarePipeline();
    const failingExecutor = vi.fn(async () => {
      throw new Error('LLM failed');
    });
    const ctx = await pipeline.execute(makeRequest(), failingExecutor);
    expect(ctx.error).toBeDefined();
    expect(ctx.error!.message).toBe('LLM failed');
    expect(ctx.aborted).toBe(true);
  });

  it('cached response skips executor', async () => {
    const pipeline = new MiddlewarePipeline();
    const cachedResp = makeResponse({ content: 'cached!' });

    pipeline.use({
      name: 'cache-hit',
      description: '',
      enabled: true,
      priority: 1,
      fn: async (_ctx, next) => {
        ctx.request._cachedResponse = cachedResp;
        return next();
      },
    });

    const executor = mockExecutor();
    const ctx = await pipeline.execute(makeRequest(), executor);
    expect(executor).not.toHaveBeenCalled();
    expect(ctx.response!.content).toBe('cached!');
    expect(ctx.response!._cached).toBe(true);
  });

  it('_skipExecution flag prevents executor call', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use({
      name: 'skipper',
      description: '',
      enabled: true,
      priority: 1,
      fn: async (_ctx, next) => {
        ctx.request._skipExecution = true;
        return next();
      },
    });

    const executor = mockExecutor();
    const ctx = await pipeline.execute(makeRequest(), executor);
    expect(executor).not.toHaveBeenCalled();
    expect(ctx.response).toBeUndefined();
  });
});

// ──────── Built-in Middlewares ────────

describe('createLoggingMiddleware', () => {
  it('logs request and response', async () => {
    const logFn = vi.fn();
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createLoggingMiddleware(logFn));

    await pipeline.execute(makeRequest(), mockExecutor());

    expect(logFn).toHaveBeenCalledTimes(2); // Request + Response
    expect(logFn.mock.calls[0][0]).toBe('Request');
    expect(logFn.mock.calls[1][0]).toBe('Response');
  });

  it('logs error when executor fails', async () => {
    const logFn = vi.fn();
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createLoggingMiddleware(logFn));

    // Middleware catches errors from next(), so we need a middleware that sets error
    pipeline.use({
      name: 'error-maker',
      description: '',
      enabled: true,
      priority: 20,
      fn: async (_ctx, next) => {
        const result = await next();
        result.error = new Error('test error');
        return result;
      },
    });

    await pipeline.execute(makeRequest(), mockExecutor());
    const errorLog = logFn.mock.calls.find((c) => c[0] === 'Error');
    expect(errorLog).toBeDefined();
  });
});

describe('createCachingMiddleware', () => {
  it('only caches deterministic requests (temperature=0)', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createCachingMiddleware());
    const executor = mockExecutor();

    // Non-deterministic (temperature > 0) — should NOT cache
    await pipeline.execute(makeRequest({ temperature: 0.7 }), executor);
    await pipeline.execute(makeRequest({ temperature: 0.7 }), executor);
    expect(executor).toHaveBeenCalledTimes(2);
  });

  it('caches deterministic requests and reuses them', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createCachingMiddleware());
    const executor = mockExecutor();

    const req = makeRequest({ temperature: 0 });
    await pipeline.execute(req, executor);
    await pipeline.execute(req, executor);
    // Second call should use cache, executor called only once
    expect(executor).toHaveBeenCalledTimes(1);
  });

  it('evicts oldest entry when maxEntries exceeded', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createCachingMiddleware({ maxEntries: 1 }));

    const executor1 = mockExecutor({ content: 'first' });
    const executor2 = mockExecutor({ content: 'second' });

    await pipeline.execute(
      makeRequest({ id: '1', temperature: 0, messages: [{ role: 'user', content: 'a' }] }),
      executor1,
    );
    await pipeline.execute(
      makeRequest({ id: '2', temperature: 0, messages: [{ role: 'user', content: 'b' }] }),
      executor2,
    );

    // First entry should have been evicted
    const executor3 = mockExecutor({ content: 'third' });
    await pipeline.execute(
      makeRequest({ id: '3', temperature: 0, messages: [{ role: 'user', content: 'a' }] }),
      executor3,
    );
    expect(executor3).toHaveBeenCalledTimes(1); // cache miss — evicted
  });
});

describe('createTokenCounterMiddleware', () => {
  it('calls onCount with token/cost data', async () => {
    const onCount = vi.fn();
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createTokenCounterMiddleware(onCount));

    await pipeline.execute(
      makeRequest(),
      mockExecutor({ inputTokens: 100, outputTokens: 50, costUsd: 0.005 }),
    );

    expect(onCount).toHaveBeenCalledWith({
      inputTokens: 100,
      outputTokens: 50,
      costUsd: 0.005,
    });
  });

  it('does not call onCount if no response', async () => {
    const onCount = vi.fn();
    const pipeline = new MiddlewarePipeline();

    pipeline.use({
      name: 'skip',
      description: '',
      enabled: true,
      priority: 1,
      fn: async (_ctx, next) => {
        ctx.request._skipExecution = true;
        return next();
      },
    });
    pipeline.use(createTokenCounterMiddleware(onCount));

    await pipeline.execute(makeRequest(), mockExecutor());
    expect(onCount).not.toHaveBeenCalled();
  });
});

describe('createPiiRedactionMiddleware', () => {
  it('redacts CPF', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());

    const executor = vi.fn(async (req: LLMRequest) => {
      expect(req.messages[0].content).toContain('[CPF_REDACTED]');
      expect(req.messages[0].content).not.toContain('123.456.789-00');
      return makeResponse();
    });

    await pipeline.execute(
      makeRequest({ messages: [{ role: 'user', content: 'Meu CPF é 123.456.789-00' }] }),
      executor,
    );
    expect(executor).toHaveBeenCalled();
  });

  it('redacts CNPJ', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());

    const executor = vi.fn(async (req: LLMRequest) => {
      expect(req.messages[0].content).toContain('[CNPJ_REDACTED]');
      return makeResponse();
    });

    await pipeline.execute(
      makeRequest({ messages: [{ role: 'user', content: 'CNPJ: 12.345.678/0001-90' }] }),
      executor,
    );
  });

  it('redacts email', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());

    const executor = vi.fn(async (req: LLMRequest) => {
      expect(req.messages[0].content).toContain('[EMAIL_REDACTED]');
      expect(req.messages[0].content).not.toContain('user@example.com');
      return makeResponse();
    });

    await pipeline.execute(
      makeRequest({ messages: [{ role: 'user', content: 'Email: user@example.com' }] }),
      executor,
    );
  });

  it('redacts Brazilian phone numbers', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());

    const executor = vi.fn(async (req: LLMRequest) => {
      expect(req.messages[0].content).toContain('[PHONE_REDACTED]');
      return makeResponse();
    });

    await pipeline.execute(
      makeRequest({ messages: [{ role: 'user', content: 'Tel: (11) 98765-4321' }] }),
      executor,
    );
  });

  it('redacts credit card numbers', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());

    const executor = vi.fn(async (req: LLMRequest) => {
      expect(req.messages[0].content).toContain('[CARD_REDACTED]');
      return makeResponse();
    });

    await pipeline.execute(
      makeRequest({ messages: [{ role: 'user', content: 'Card: 4111 1111 1111 1111' }] }),
      executor,
    );
  });

  it('redacts multiple PII in one message', async () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());

    const executor = vi.fn(async (req: LLMRequest) => {
      const c = req.messages[0].content;
      expect(c).toContain('[CPF_REDACTED]');
      expect(c).toContain('[EMAIL_REDACTED]');
      return makeResponse();
    });

    await pipeline.execute(
      makeRequest({
        messages: [{ role: 'user', content: 'CPF 123.456.789-00 email test@foo.com' }],
      }),
      executor,
    );
  });
});

describe('createDefaultPipeline', () => {
  it('creates pipeline with all middlewares enabled by default', () => {
    const pipeline = createDefaultPipeline();
    const names = pipeline.list().map((m) => m.name);
    expect(names).toContain('logging');
    expect(names).toContain('caching');
    expect(names).toContain('retry');
    expect(names).toContain('token-counter');
    expect(names).toContain('pii-redaction');
  });

  it('can disable specific middlewares', () => {
    const pipeline = createDefaultPipeline({
      enableCaching: false,
      enableRetry: false,
    });
    const names = pipeline.list().map((m) => m.name);
    expect(names).not.toContain('caching');
    expect(names).not.toContain('retry');
    expect(names).toContain('logging');
  });
});
