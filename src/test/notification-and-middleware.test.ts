/**
 * notificationEngineService + middlewarePipelineService tests
 * (next-frontier sprint #4 — coverage expansion continued)
 *
 * Targets:
 *   notificationEngineService.ts (~536 lines, 0% → ~25% via renderTemplate)
 *   middlewarePipelineService.ts (~464 lines, 0% → ~70% via the class)
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/lib/supabaseExtended', () => ({
  fromTable: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { renderTemplate } from '@/services/notificationEngineService';
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

// ════════════════════════════════════════════════════════════════
// notificationEngineService — renderTemplate
// ════════════════════════════════════════════════════════════════

describe('notificationEngineService — renderTemplate', () => {
  it('replaces simple variables', () => {
    expect(renderTemplate('Hello {{name}}', { name: 'Joaquim' })).toBe('Hello Joaquim');
  });

  it('replaces multiple variables in one template', () => {
    expect(
      renderTemplate('{{greeting}}, {{name}}! Your order #{{id}} is ready.', {
        greeting: 'Hi',
        name: 'Pink',
        id: 42,
      })
    ).toBe('Hi, Pink! Your order #42 is ready.');
  });

  it('supports nested dot-notation paths', () => {
    expect(
      renderTemplate('Customer: {{customer.name}} ({{customer.email}})', {
        customer: { name: 'ACME Corp', email: 'contact@acme.com' },
      })
    ).toBe('Customer: ACME Corp (contact@acme.com)');
  });

  it('leaves unresolved placeholders intact', () => {
    expect(renderTemplate('Hello {{missing}}', {})).toBe('Hello {{missing}}');
  });

  it('handles deep nesting beyond one level', () => {
    expect(
      renderTemplate('{{a.b.c}}', { a: { b: { c: 'deep' } } })
    ).toBe('deep');
  });

  it('returns empty string for null/undefined values', () => {
    expect(renderTemplate('val={{x}}', { x: null })).toBe('val=');
    expect(renderTemplate('val={{x}}', { x: undefined })).toBe('val=');
  });

  it('coerces non-string values to string', () => {
    expect(renderTemplate('{{n}} items at ${{price}}', { n: 5, price: 19.99 }))
      .toBe('5 items at $19.99');
  });

  it('does not match malformed placeholders', () => {
    expect(renderTemplate('{single} {{spaced }} {{ok}}', { ok: 'yes' }))
      .toBe('{single} {{spaced }} yes');
  });

  it('handles a template with no placeholders unchanged', () => {
    expect(renderTemplate('plain text', { foo: 'bar' })).toBe('plain text');
  });
});

// ════════════════════════════════════════════════════════════════
// middlewarePipelineService — MiddlewarePipeline class
// ════════════════════════════════════════════════════════════════

describe('middlewarePipelineService — MiddlewarePipeline registration', () => {
  it('starts with no middlewares', () => {
    const p = new MiddlewarePipeline();
    expect(p.list().length).toBe(0);
  });

  it('use() adds middleware and returns pipeline for chaining', () => {
    const p = new MiddlewarePipeline();
    const result = p.use({
      name: 'logger',
      enabled: true,
      priority: 10,
      description: 'logs requests',
      fn: async (_ctx, next) => next(),
    });
    expect(result).toBe(p);
    expect(p.list().length).toBe(1);
    expect(p.list()[0].name).toBe('logger');
  });

  it('sorts middlewares by priority on insertion', () => {
    const p = new MiddlewarePipeline();
    p.use({ name: 'c', enabled: true, priority: 30, description: '', fn: async (_ctx, next) => next() });
    p.use({ name: 'a', enabled: true, priority: 10, description: '', fn: async (_ctx, next) => next() });
    p.use({ name: 'b', enabled: true, priority: 20, description: '', fn: async (_ctx, next) => next() });
    expect(p.list().map((m) => m.name)).toEqual(['a', 'b', 'c']);
  });

  it('remove() deletes by name', () => {
    const p = new MiddlewarePipeline();
    p.use({ name: 'temp', enabled: true, priority: 1, description: '', fn: async (_ctx, next) => next() });
    p.remove('temp');
    expect(p.list().length).toBe(0);
  });

  it('remove() is a no-op for unknown names', () => {
    const p = new MiddlewarePipeline();
    p.use({ name: 'keep', enabled: true, priority: 1, description: '', fn: async (_ctx, next) => next() });
    p.remove('unknown');
    expect(p.list().length).toBe(1);
  });

  it('toggle() flips enabled flag', () => {
    const p = new MiddlewarePipeline();
    p.use({ name: 'mw', enabled: true, priority: 1, description: '', fn: async (_ctx, next) => next() });
    p.toggle('mw', false);
    expect(p.list()[0].enabled).toBe(false);
    p.toggle('mw', true);
    expect(p.list()[0].enabled).toBe(true);
  });
});

describe('middlewarePipelineService — execute (onion model)', () => {
  const fakeRequest: LLMRequest = {
    model: 'sonnet',
    messages: [{ role: 'user', content: 'hi' }],
  };

  const fakeResponse: LLMResponse = {
    content: 'hello',
    inputTokens: 5,
    outputTokens: 3,
    totalCostUsd: 0.001,
  };

  it('runs the executor when no middlewares present', async () => {
    const p = new MiddlewarePipeline();
    const executor = vi.fn().mockResolvedValue(fakeResponse);
    const result = await p.execute(fakeRequest, executor);
    expect(executor).toHaveBeenCalledTimes(1);
    expect(result.response?.content).toBe('hello');
  });

  it('skips disabled middlewares', async () => {
    const p = new MiddlewarePipeline();
    const mwSpy = vi.fn(async (_ctx, next) => next());
    p.use({ name: 'off', enabled: false, priority: 1, description: '', fn: mwSpy });
    await p.execute(fakeRequest, vi.fn().mockResolvedValue(fakeResponse));
    expect(mwSpy).not.toHaveBeenCalled();
  });

  it('runs middlewares in priority order (onion entry)', async () => {
    const p = new MiddlewarePipeline();
    const order: string[] = [];
    p.use({ name: 'b', enabled: true, priority: 20, description: '', fn: async (_ctx, next) => { order.push('b-in'); await next(); order.push('b-out'); } });
    p.use({ name: 'a', enabled: true, priority: 10, description: '', fn: async (_ctx, next) => { order.push('a-in'); await next(); order.push('a-out'); } });
    await p.execute(fakeRequest, vi.fn().mockResolvedValue(fakeResponse));
    expect(order).toEqual(['a-in', 'b-in', 'b-out', 'a-out']);
  });

  it('captures executor errors as ctx.error and aborted=true', async () => {
    const p = new MiddlewarePipeline();
    const result = await p.execute(fakeRequest, vi.fn().mockRejectedValue(new Error('LLM down')));
    expect(result.aborted).toBe(true);
    expect(result.error?.message).toBe('LLM down');
  });

  it('respects _skipExecution flag set by a middleware', async () => {
    const p = new MiddlewarePipeline();
    p.use({
      name: 'skipper',
      enabled: true,
      priority: 1,
      description: '',
      fn: async (_ctx, next) => {
        ctx.request._skipExecution = true;
        return next();
      },
    });
    const executor = vi.fn().mockResolvedValue(fakeResponse);
    const result = await p.execute(fakeRequest, executor);
    expect(executor).not.toHaveBeenCalled();
    expect(result.response).toBeUndefined();
  });

  it('uses _cachedResponse when middleware sets it', async () => {
    const p = new MiddlewarePipeline();
    p.use({
      name: 'cacher',
      enabled: true,
      priority: 1,
      description: '',
      fn: async (_ctx, next) => {
        ctx.request._cachedResponse = { content: 'from cache', inputTokens: 0, outputTokens: 0, totalCostUsd: 0 };
        return next();
      },
    });
    const executor = vi.fn().mockResolvedValue(fakeResponse);
    const result = await p.execute(fakeRequest, executor);
    expect(executor).not.toHaveBeenCalled();
    expect(result.response?.content).toBe('from cache');
    expect(result.response?._cached).toBe(true);
  });

  it('records durationMs on the response', async () => {
    const p = new MiddlewarePipeline();
    const executor = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 5));
      return fakeResponse;
    });
    const result = await p.execute(fakeRequest, executor);
    expect(result.response?.durationMs).toBeGreaterThanOrEqual(0);
  });
});

describe('middlewarePipelineService — built-in middleware factories', () => {
  it('createLoggingMiddleware returns a valid MiddlewareConfig', () => {
    const mw = createLoggingMiddleware();
    expect(mw.name).toBeTruthy();
    expect(mw.enabled).toBe(true);
    expect(typeof mw.fn).toBe('function');
  });

  it('createCachingMiddleware returns a valid MiddlewareConfig', () => {
    const mw = createCachingMiddleware();
    expect(mw.name).toBeTruthy();
    expect(typeof mw.fn).toBe('function');
  });

  it('createTokenCounterMiddleware returns a valid MiddlewareConfig', () => {
    const mw = createTokenCounterMiddleware();
    expect(mw.name).toBeTruthy();
    expect(typeof mw.fn).toBe('function');
  });

  it('createPiiRedactionMiddleware returns a valid MiddlewareConfig', () => {
    const mw = createPiiRedactionMiddleware();
    expect(mw.name).toBeTruthy();
    expect(typeof mw.fn).toBe('function');
  });

  it('createDefaultPipeline returns a MiddlewarePipeline with multiple middlewares', () => {
    const p = createDefaultPipeline();
    expect(p).toBeInstanceOf(MiddlewarePipeline);
    expect(p.list().length).toBeGreaterThan(0);
  });
});
