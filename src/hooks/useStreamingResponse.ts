/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — useStreamingResponse Hook
 * ═══════════════════════════════════════════════════════════════
 * Consumes Server-Sent Events (SSE) from Edge Functions for
 * real-time token-by-token streaming. Foundation for AG-UI.
 *
 * Features:
 *  - Auto-retry with exponential backoff (max 2 retries)
 *  - Handles both OpenAI-compatible and custom gateway SSE formats
 *  - AG-UI event emission
 *  - Abort/cancel support
 */

import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

// AG-UI compatible event types
export type AGUIEventType =
  | 'RUN_STARTED'
  | 'RUN_FINISHED'
  | 'RUN_ERROR'
  | 'TEXT_MESSAGE_START'
  | 'TEXT_MESSAGE_CONTENT'
  | 'TEXT_MESSAGE_END'
  | 'TOOL_CALL_START'
  | 'TOOL_CALL_ARGS'
  | 'TOOL_CALL_END'
  | 'STATE_DELTA'
  | 'STATE_SNAPSHOT'
  | 'MESSAGES_SNAPSHOT'
  | 'RAW';

export interface AGUIEvent {
  type: AGUIEventType;
  timestamp: number;
  data: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  args: string;
  result?: string;
  status: 'pending' | 'running' | 'completed' | 'error';
}

export interface StreamingState {
  text: string;
  tokens: number;
  toolCalls: ToolCall[];
  events: AGUIEvent[];
  stateDelta: Record<string, unknown>;
  isStreaming: boolean;
  isComplete: boolean;
  error: string | null;
  latencyMs: number;
  provider: string | null;
  model: string | null;
  retryCount: number;
}

const INITIAL_STATE: StreamingState = {
  text: '',
  tokens: 0,
  toolCalls: [],
  events: [],
  stateDelta: {},
  isStreaming: false,
  isComplete: false,
  error: null,
  latencyMs: 0,
  provider: null,
  model: null,
  retryCount: 0,
};

const MAX_RETRIES = 2;
const RETRY_DELAYS = [1000, 3000]; // exponential backoff

export function useStreamingResponse() {
  const [state, setState] = useState<StreamingState>(INITIAL_STATE);
  const abortRef = useRef<AbortController | null>(null);
  const startTimeRef = useRef<number>(0);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState(INITIAL_STATE);
  }, []);

  const cancel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState(prev => ({ ...prev, isStreaming: false, isComplete: true }));
  }, []);

  const stream = useCallback(async (
    endpoint: string,
    body: Record<string, unknown>,
    options?: {
      onToken?: (token: string) => void;
      onEvent?: (event: AGUIEvent) => void;
      onComplete?: (fullText: string) => void;
      onError?: (error: string) => void;
      maxRetries?: number;
    }
  ) => {
    reset();
    startTimeRef.current = Date.now();

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const err = 'Não autenticado';
      setState(prev => ({ ...prev, error: err }));
      options?.onError?.(err);
      return;
    }

    const controller = new AbortController();
    abortRef.current = controller;
    setState(prev => ({ ...prev, isStreaming: true }));

    const url = endpoint.startsWith('http')
      ? endpoint
      : `${import.meta.env.VITE_SUPABASE_URL}${endpoint}`;

    const maxRetries = options?.maxRetries ?? MAX_RETRIES;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (controller.signal.aborted) return;

      try {
        if (attempt > 0) {
          setState(prev => ({ ...prev, retryCount: attempt }));
          await new Promise(r => setTimeout(r, RETRY_DELAYS[attempt - 1] || 3000));
          if (controller.signal.aborted) return;
        }

        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            'Accept': 'text/event-stream',
          },
          body: JSON.stringify({ ...body, stream: true }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: response.statusText }));
          const errMsg = (err as Record<string, string>).error || `HTTP ${response.status}`;
          // Retry on 429 (rate limit) and 503 (cold start)
          if ((response.status === 429 || response.status === 503) && attempt < maxRetries) {
            logger.warn(`Stream attempt ${attempt + 1} failed (${response.status}), retrying...`);
            continue;
          }
          throw new Error(errMsg);
        }

        const contentType = response.headers.get('content-type') || '';

        if (contentType.includes('text/event-stream') && response.body) {
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let fullText = '';
          let tokenCount = 0;

          const emitEvent = (event: AGUIEvent) => {
            setState(prev => ({ ...prev, events: [...prev.events, event] }));
            options?.onEvent?.(event);
          };

          emitEvent({ type: 'RUN_STARTED', timestamp: Date.now(), data: { attempt: attempt + 1 } });

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const raw = line.slice(6).trim();
              if (raw === '[DONE]') continue;

              try {
                const parsed = JSON.parse(raw) as Record<string, unknown>;

                // Custom gateway format: { token, model, provider }
                if (typeof parsed.token === 'string' && parsed.token) {
                  fullText += parsed.token;
                  tokenCount++;
                  if (parsed.provider) setState(prev => ({ ...prev, provider: parsed.provider as string }));
                  if (parsed.model) setState(prev => ({ ...prev, model: parsed.model as string }));
                  setState(prev => ({
                    ...prev,
                    text: fullText,
                    tokens: tokenCount,
                    latencyMs: Date.now() - startTimeRef.current,
                  }));
                  options?.onToken?.(parsed.token as string);
                  emitEvent({ type: 'TEXT_MESSAGE_CONTENT', timestamp: Date.now(), data: { content: parsed.token } });
                  continue;
                }

                // Gateway done event: { done: true, tokens, cost_usd, ... }
                if (parsed.done === true) {
                  if (parsed.provider) setState(prev => ({ ...prev, provider: parsed.provider as string }));
                  if (parsed.model) setState(prev => ({ ...prev, model: parsed.model as string }));
                  continue;
                }

                // Gateway error event
                if (typeof parsed.error === 'string') {
                  throw new Error(parsed.error);
                }

                // OpenAI-compatible streaming format
                const choices = parsed.choices as Array<Record<string, Record<string, string>>> | undefined;
                if (choices?.[0]?.delta?.content) {
                  const token = choices[0].delta.content;
                  fullText += token;
                  tokenCount++;
                  setState(prev => ({
                    ...prev,
                    text: fullText,
                    tokens: tokenCount,
                    latencyMs: Date.now() - startTimeRef.current,
                  }));
                  options?.onToken?.(token);
                  emitEvent({ type: 'TEXT_MESSAGE_CONTENT', timestamp: Date.now(), data: { content: token } });
                }

                // Tool call streaming
                const toolCall = choices?.[0]?.delta as Record<string, unknown> | undefined;
                if (toolCall?.tool_calls) {
                  const tc = (toolCall.tool_calls as Array<Record<string, unknown>>)[0];
                  if (tc) emitEvent({ type: 'TOOL_CALL_ARGS', timestamp: Date.now(), data: tc });
                }

                // AG-UI native events
                if (parsed.type && typeof parsed.type === 'string') {
                  emitEvent({ type: parsed.type as AGUIEventType, timestamp: Date.now(), data: parsed });
                  if (parsed.type === 'STATE_DELTA') {
                    setState(prev => ({ ...prev, stateDelta: { ...prev.stateDelta, ...(parsed.delta as Record<string, unknown>) } }));
                  }
                }
              } catch (parseErr) {
                if (parseErr instanceof Error && parseErr.message !== raw) {
                  // Re-throw gateway errors
                  if (parseErr.message.startsWith('All streaming providers failed') || parseErr.message.includes('Stream error')) {
                    throw parseErr;
                  }
                }
                // Non-JSON SSE line, treat as raw text token
                fullText += raw;
                tokenCount++;
                setState(prev => ({ ...prev, text: fullText, tokens: tokenCount }));
                options?.onToken?.(raw);
              }
            }
          }

          emitEvent({ type: 'RUN_FINISHED', timestamp: Date.now(), data: { tokens: tokenCount } });
          options?.onComplete?.(fullText);
          setState(prev => ({
            ...prev,
            isStreaming: false,
            isComplete: true,
            latencyMs: Date.now() - startTimeRef.current,
          }));
          return; // Success — exit retry loop
        }

        // JSON fallback (non-streaming response)
        const data = await response.json() as Record<string, unknown>;
        const text = typeof data.text === 'string' ? data.text
          : typeof data.response === 'string' ? data.response
          : typeof data.content === 'string' ? data.content
          : JSON.stringify(data);

        setState(prev => ({
          ...prev,
          text,
          tokens: text.split(/\s+/).length,
          isStreaming: false,
          isComplete: true,
          latencyMs: Date.now() - startTimeRef.current,
          provider: typeof data.provider === 'string' ? data.provider : null,
          model: typeof data.model === 'string' ? data.model : null,
        }));
        options?.onComplete?.(text);
        return; // Success
      } catch (err) {
        if ((err as Error).name === 'AbortError') return;
        if (attempt < maxRetries) {
          logger.warn(`Stream attempt ${attempt + 1} failed, retrying...`, (err as Error).message);
          continue;
        }
        const errorMsg = err instanceof Error ? err.message : 'Erro de streaming';
        setState(prev => ({
          ...prev,
          error: errorMsg,
          isStreaming: false,
          isComplete: true,
        }));
        options?.onError?.(errorMsg);
      }
    }
  }, [reset]);

  return { ...state, stream, reset, cancel };
}
