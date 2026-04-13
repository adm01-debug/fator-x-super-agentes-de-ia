/**
 * Types for Middleware Pipeline Service
 */

export interface LLMRequest {
  id: string;
  provider: string;
  model: string;
  messages: Array<{
    role: 'system' | 'user' | 'assistant';
    content: string;
  }>;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  _startTime?: number;
  _cachedResponse?: LLMResponse;
  _skipExecution?: boolean;
  _retryCount?: number;
}

export interface LLMResponse {
  id: string;
  requestId: string;
  content: string;
  role: 'assistant';
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  costUsd: number;
  durationMs: number;
  finishReason: 'stop' | 'length' | 'tool_calls' | 'error';
  toolCalls?: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
  _cached?: boolean;
  _filtered?: boolean;
  _retried?: boolean;
}

export interface MiddlewareContext {
  request: LLMRequest;
  response?: LLMResponse;
  error?: Error;
  aborted: boolean;
  metadata: Record<string, unknown>;
  skipRemaining: boolean;
}

export type MiddlewareFn = (
  ctx: MiddlewareContext,
  next: () => Promise<MiddlewareContext>
) => Promise<MiddlewareContext>;

export interface MiddlewareConfig {
  name: string;
  description: string;
  enabled: boolean;
  priority: number;
  fn: MiddlewareFn;
  options?: Record<string, unknown>;
}
