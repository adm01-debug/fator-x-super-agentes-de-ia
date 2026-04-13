import { logger } from '@/lib/logger';
/**
 * Nexus Agents Studio — Middleware Pipeline Service
 * 
 * Inspired by Microsoft Agent Framework's middleware system.
 * Provides a composable pipeline of middleware that processes
 * LLM requests/responses for cross-cutting concerns:
 * 
 * - Logging & tracing
 * - Caching (avoid duplicate LLM calls)
 * - Rate limiting
 * - Token counting
 * - Cost tracking
 * - Content filtering
 * - Response transformation
 * - Error handling & retry
 * - PII redaction
 */

export type { LLMRequest, LLMResponse, MiddlewareContext, MiddlewareFn, MiddlewareConfig } from './types/middlewarePipelineTypes';
import type { LLMRequest, LLMResponse, MiddlewareContext, MiddlewareFn, MiddlewareConfig } from './types/middlewarePipelineTypes';

// ──────── Pipeline Class ────────

export class MiddlewarePipeline {
  private middlewares: MiddlewareConfig[] = [];

  /**
   * Register a middleware to the pipeline
   */
  use(config: MiddlewareConfig): this {
    this.middlewares.push(config);
    this.middlewares.sort((a, b) => a.priority - b.priority);
    return this;
  }

  /**
   * Remove a middleware by name
   */
  remove(name: string): this {
    this.middlewares = this.middlewares.filter((m) => m.name !== name);
    return this;
  }

  /**
   * Enable/disable a middleware by name
   */
  toggle(name: string, enabled: boolean): this {
    const mw = this.middlewares.find((m) => m.name === name);
    if (mw) mw.enabled = enabled;
    return this;
  }

  /**
   * List all registered middlewares
   */
  list(): Array<{ name: string; enabled: boolean; priority: number; description: string }> {
    return this.middlewares.map((m) => ({
      name: m.name,
      enabled: m.enabled,
      priority: m.priority,
      description: m.description,
    }));
  }

  /**
   * Execute the pipeline with a request and an executor function.
   * The executor is the actual LLM call (e.g., calling Supabase Edge Function).
   */
  async execute(
    request: LLMRequest,
    executor: (req: LLMRequest) => Promise<LLMResponse>
  ): Promise<MiddlewareContext> {
    const ctx: MiddlewareContext = {
      request: { ...request, _startTime: Date.now() },
      aborted: false,
      metadata: {},
      skipRemaining: false,
    };

    const activeMiddlewares = this.middlewares.filter((m) => m.enabled);

    // Build the middleware chain (onion model)
    const chain = this.buildChain(activeMiddlewares, executor);

    try {
      const result = await chain(ctx);
      return result;
    } catch (error) {
      ctx.error = error instanceof Error ? error : new Error(String(error));
      ctx.aborted = true;
      return ctx;
    }
  }

  private buildChain(
    middlewares: MiddlewareConfig[],
    executor: (req: LLMRequest) => Promise<LLMResponse>
  ): (ctx: MiddlewareContext) => Promise<MiddlewareContext> {
    // The innermost function is the actual LLM call
    let chain = async (ctx: MiddlewareContext): Promise<MiddlewareContext> => {
      if (ctx.aborted || ctx.request._skipExecution) return ctx;

      // Check for cached response
      if (ctx.request._cachedResponse) {
        ctx.response = { ...ctx.request._cachedResponse, _cached: true };
        return ctx;
      }

      // Execute the actual LLM call
      ctx.response = await executor(ctx.request);
      ctx.response.durationMs = Date.now() - (ctx.request._startTime ?? Date.now());
      return ctx;
    };

    // Wrap each middleware around the chain (reverse order for onion model)
    for (let i = middlewares.length - 1; i >= 0; i--) {
      const mw = middlewares[i];
      const innerChain = chain;
      chain = async (ctx: MiddlewareContext): Promise<MiddlewareContext> => {
        return mw.fn(ctx, async () => innerChain(ctx));
      };
    }

    return chain;
  }
}

// ──────── Built-in Middlewares ────────

/**
 * Logging middleware — logs request/response details
 */
export function createLoggingMiddleware(
  logFn?: (msg: string, data: Record<string, unknown>) => void
): MiddlewareConfig {
  const log = logFn ?? ((msg, data) => logger.info(`[NexusMW:Log] ${msg}`, data));

  return {
    name: 'logging',
    description: 'Logs LLM request/response details for debugging',
    enabled: true,
    priority: 10,
    fn: async (ctx, next) => {
      log('Request', {
        id: ctx.request.id,
        provider: ctx.request.provider,
        model: ctx.request.model,
        messageCount: ctx.request.messages.length,
      });

      const result = await next();

      if (result.response) {
        log('Response', {
          id: result.response.id,
          tokens: result.response.totalTokens,
          costUsd: result.response.costUsd,
          durationMs: result.response.durationMs,
          cached: result.response._cached ?? false,
        });
      }

      if (result.error) {
        log('Error', { error: result.error.message });
      }

      return result;
    },
  };
}

/**
 * Caching middleware — caches identical requests to avoid duplicate LLM calls
 */
export function createCachingMiddleware(options?: {
  maxEntries?: number;
  ttlMs?: number;
}): MiddlewareConfig {
  const cache = new Map<string, { response: LLMResponse; timestamp: number }>();
  const maxEntries = options?.maxEntries ?? 100;
  const ttlMs = options?.ttlMs ?? 300_000; // 5 minutes default

  function getCacheKey(req: LLMRequest): string {
    return JSON.stringify({
      provider: req.provider,
      model: req.model,
      messages: req.messages,
      temperature: req.temperature,
    });
  }

  return {
    name: 'caching',
    description: 'Caches identical LLM requests to avoid duplicate API calls',
    enabled: true,
    priority: 20,
    fn: async (ctx, next) => {
      // Only cache deterministic requests (temperature 0)
      if ((ctx.request.temperature ?? 1) > 0) return next();

      const key = getCacheKey(ctx.request);
      const cached = cache.get(key);

      if (cached && Date.now() - cached.timestamp < ttlMs) {
        ctx.request._cachedResponse = cached.response;
        return next();
      }

      const result = await next();

      // Store in cache
      if (result.response && !result.error) {
        if (cache.size >= maxEntries) {
          // Evict oldest entry
          const firstKey = cache.keys().next().value;
          if (firstKey) cache.delete(firstKey);
        }
        cache.set(key, {
          response: result.response,
          timestamp: Date.now(),
        });
      }

      return result;
    },
  };
}

/**
 * Retry middleware — retries failed requests with exponential backoff
 */
export function createRetryMiddleware(options?: {
  maxRetries?: number;
  baseDelayMs?: number;
  retryableErrors?: string[];
}): MiddlewareConfig {
  const maxRetries = options?.maxRetries ?? 3;
  const baseDelayMs = options?.baseDelayMs ?? 1000;
  const retryableErrors = options?.retryableErrors ?? [
    'rate_limit', 'timeout', 'server_error', '429', '500', '502', '503',
  ];

  return {
    name: 'retry',
    description: 'Retries failed LLM calls with exponential backoff',
    enabled: true,
    priority: 15,
    fn: async (ctx, next) => {
      let lastError: Error | undefined;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          ctx.request._retryCount = attempt;
          const result = await next();

          if (result.error && attempt < maxRetries) {
            const isRetryable = retryableErrors.some((e) =>
              result.error?.message.toLowerCase().includes(e.toLowerCase())
            );
            if (isRetryable) {
              lastError = result.error;
              const delay = baseDelayMs * Math.pow(2, attempt);
              await new Promise((resolve) => setTimeout(resolve, delay));
              result.error = undefined;
              result.response = undefined;
              continue;
            }
          }

          if (attempt > 0 && result.response) {
            result.response._retried = true;
            result.response.metadata = {
              ...result.response.metadata,
              retryAttempt: attempt,
            };
          }

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
          if (attempt < maxRetries) {
            const delay = baseDelayMs * Math.pow(2, attempt);
            await new Promise((resolve) => setTimeout(resolve, delay));
          }
        }
      }

      ctx.error = lastError ?? new Error('All retries exhausted');
      return ctx;
    },
  };
}

/**
 * Token counter middleware — counts tokens and tracks cost
 */
export function createTokenCounterMiddleware(
  onCount?: (data: { inputTokens: number; outputTokens: number; costUsd: number }) => void
): MiddlewareConfig {
  return {
    name: 'token-counter',
    description: 'Tracks token usage and cost for each LLM call',
    enabled: true,
    priority: 90,
    fn: async (_ctx, next) => {
      const result = await next();

      if (result.response) {
        onCount?.({
          inputTokens: result.response.inputTokens,
          outputTokens: result.response.outputTokens,
          costUsd: result.response.costUsd,
        });
      }

      return result;
    },
  };
}

/**
 * PII Redaction middleware — removes sensitive data from prompts
 */
export function createPiiRedactionMiddleware(): MiddlewareConfig {
  const patterns = [
    { name: 'cpf', regex: /\d{3}\.?\d{3}\.?\d{3}-?\d{2}/g, replacement: '[CPF_REDACTED]' },
    { name: 'cnpj', regex: /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g, replacement: '[CNPJ_REDACTED]' },
    { name: 'email', regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, replacement: '[EMAIL_REDACTED]' },
    { name: 'phone_br', regex: /\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g, replacement: '[PHONE_REDACTED]' },
    { name: 'credit_card', regex: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/g, replacement: '[CARD_REDACTED]' },
  ];

  function redact(text: string): string {
    let result = text;
    for (const p of patterns) {
      result = result.replace(p.regex, p.replacement);
    }
    return result;
  }

  return {
    name: 'pii-redaction',
    description: 'Redacts PII (CPF, CNPJ, email, phone, credit card) from LLM prompts',
    enabled: true,
    priority: 5,
    fn: async (ctx, next) => {
      // Redact PII from messages
      ctx.request.messages = ctx.request.messages.map((msg) => ({
        ...msg,
        content: redact(msg.content),
      }));

      return next();
    },
  };
}

// ──────── Default Pipeline Factory ────────

/**
 * Create a pre-configured pipeline with all built-in middlewares
 */
export function createDefaultPipeline(options?: {
  enableCaching?: boolean;
  enableRetry?: boolean;
  enablePiiRedaction?: boolean;
  enableLogging?: boolean;
  enableTokenCounter?: boolean;
  onTokenCount?: (data: { inputTokens: number; outputTokens: number; costUsd: number }) => void;
  logFn?: (msg: string, data: Record<string, unknown>) => void;
}): MiddlewarePipeline {
  const pipeline = new MiddlewarePipeline();

  if (options?.enablePiiRedaction !== false) {
    pipeline.use(createPiiRedactionMiddleware());
  }

  if (options?.enableLogging !== false) {
    pipeline.use(createLoggingMiddleware(options?.logFn));
  }

  if (options?.enableRetry !== false) {
    pipeline.use(createRetryMiddleware());
  }

  if (options?.enableCaching !== false) {
    pipeline.use(createCachingMiddleware());
  }

  if (options?.enableTokenCounter !== false) {
    pipeline.use(createTokenCounterMiddleware(options?.onTokenCount));
  }

  return pipeline;
}
