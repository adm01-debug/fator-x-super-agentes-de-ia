import { describe, it, expect } from 'vitest';
import {
  MiddlewarePipeline,
  createLoggingMiddleware,
  createCachingMiddleware,
  createRetryMiddleware,
  createTokenCounterMiddleware,
  createPiiRedactionMiddleware,
  createDefaultPipeline,
} from '@/services/middlewarePipelineService';
import type { LLMRequest, LLMResponse } from '@/services/middlewarePipelineService';

function createMockRequest(overrides?: Partial<LLMRequest>): LLMRequest {
  return {
    id: 'req-1',
    provider: 'openai',
    model: 'gpt-5',
    messages: [{ role: 'user', content: 'Hello' }],
    temperature: 0.7,
    maxTokens: 100,
    ...overrides,
  };
}

function createMockResponse(overrides?: Partial<LLMResponse>): LLMResponse {
  return {
    id: 'res-1',
    requestId: 'req-1',
    content: 'Hello back!',
    role: 'assistant',
    provider: 'openai',
    model: 'gpt-5',
    inputTokens: 10,
    outputTokens: 5,
    totalTokens: 15,
    costUsd: 0.001,
    durationMs: 200,
    finishReason: 'stop',
    ...overrides,
  };
}

const mockExecutor = async (_req: LLMRequest): Promise<LLMResponse> => createMockResponse();

describe('MiddlewarePipeline', () => {
  it('executes request through empty pipeline', async () => {
    const pipeline = new MiddlewarePipeline();
    const ctx = await pipeline.execute(createMockRequest(), mockExecutor);
    expect(ctx.response?.content).toBe('Hello back!');
    expect(ctx.error).toBeUndefined();
  });

  it('runs logging middleware without error', async () => {
    const logs: string[] = [];
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createLoggingMiddleware((msg) => logs.push(msg)));
    const ctx = await pipeline.execute(createMockRequest(), mockExecutor);
    expect(ctx.response).toBeDefined();
    expect(logs.length).toBeGreaterThanOrEqual(2);
  });

  it('caches deterministic requests (temp=0)', async () => {
    let callCount = 0;
    const countingExecutor = async (req: LLMRequest): Promise<LLMResponse> => {
      callCount++;
      return createMockResponse({ requestId: req.id });
    };

    const pipeline = new MiddlewarePipeline();
    pipeline.use(createCachingMiddleware());

    const req = createMockRequest({ temperature: 0 });
    await pipeline.execute(req, countingExecutor);
    await pipeline.execute(req, countingExecutor);
    expect(callCount).toBe(1); // second call should be cached
  });

  it('does not cache non-deterministic requests', async () => {
    let callCount = 0;
    const countingExecutor = async (req: LLMRequest): Promise<LLMResponse> => {
      callCount++;
      return createMockResponse({ requestId: req.id });
    };

    const pipeline = new MiddlewarePipeline();
    pipeline.use(createCachingMiddleware());

    const req = createMockRequest({ temperature: 0.7 });
    await pipeline.execute(req, countingExecutor);
    await pipeline.execute(req, countingExecutor);
    expect(callCount).toBe(2);
  });

  it('tracks token counts', async () => {
    let tracked: { inputTokens: number; outputTokens: number } | undefined;
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createTokenCounterMiddleware((data) => { tracked = data; }));
    await pipeline.execute(createMockRequest(), mockExecutor);
    expect(tracked?.inputTokens).toBe(10);
    expect(tracked?.outputTokens).toBe(5);
  });

  it('redacts PII from messages', async () => {
    let capturedMessages: LLMRequest['messages'] = [];
    const captureExecutor = async (req: LLMRequest): Promise<LLMResponse> => {
      capturedMessages = req.messages;
      return createMockResponse();
    };

    const pipeline = new MiddlewarePipeline();
    pipeline.use(createPiiRedactionMiddleware());
    await pipeline.execute(
      createMockRequest({ messages: [{ role: 'user', content: 'CPF: 123.456.789-00' }] }),
      captureExecutor,
    );
    expect(capturedMessages[0].content).toContain('[CPF_REDACTED]');
    expect(capturedMessages[0].content).not.toContain('123.456.789-00');
  });

  it('removes middleware by name', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createLoggingMiddleware());
    expect(pipeline.list().length).toBe(1);
    pipeline.remove('logging');
    expect(pipeline.list().length).toBe(0);
  });

  it('toggles middleware enabled state', () => {
    const pipeline = new MiddlewarePipeline();
    pipeline.use(createLoggingMiddleware());
    pipeline.toggle('logging', false);
    expect(pipeline.list()[0].enabled).toBe(false);
  });

  it('createDefaultPipeline includes all built-in middleware', () => {
    const pipeline = createDefaultPipeline();
    const list = pipeline.list();
    expect(list.some(m => m.name === 'logging')).toBe(true);
    expect(list.some(m => m.name === 'retry')).toBe(true);
    expect(list.some(m => m.name === 'caching')).toBe(true);
    expect(list.some(m => m.name === 'token-counter')).toBe(true);
    expect(list.some(m => m.name === 'pii-redaction')).toBe(true);
  });

  it('retry middleware handles errors gracefully', async () => {
    let attempt = 0;
    const failingExecutor = async (_req: LLMRequest): Promise<LLMResponse> => {
      attempt++;
      if (attempt < 2) throw new Error('rate_limit exceeded');
      return createMockResponse();
    };

    const pipeline = new MiddlewarePipeline();
    pipeline.use(createRetryMiddleware({ maxRetries: 3, baseDelayMs: 10 }));
    const ctx = await pipeline.execute(createMockRequest(), failingExecutor);
    expect(ctx.response?.content).toBe('Hello back!');
    expect(attempt).toBe(2);
  });
});
