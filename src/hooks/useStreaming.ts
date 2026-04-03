import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamingState {
  content: string;
  isStreaming: boolean;
  error: string | null;
  model?: string;
  provider?: string;
  tokens?: { prompt: number; completion: number; total: number };
  costUsd?: number;
  latencyMs?: number;
}

export function useStreaming() {
  const [state, setState] = useState<StreamingState>({ content: '', isStreaming: false, error: null });
  const abortRef = useRef<AbortController | null>(null);

  const stream = useCallback(async (params: {
    model: string;
    messages: Array<{ role: string; content: string }>;
    temperature?: number;
    max_tokens?: number;
    agent_id?: string;
    session_id?: string;
  }) => {
    // Abort any existing stream
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState({ content: '', isStreaming: true, error: null });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const resp = await fetch(`${supabaseUrl}/functions/v1/llm-gateway`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY || '',
        },
        body: JSON.stringify({ ...params, stream: true }),
        signal: controller.signal,
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status}` }));
        setState(prev => ({ ...prev, isStreaming: false, error: err.error || `HTTP ${resp.status}` }));
        return;
      }

      const reader = resp.body?.getReader();
      if (!reader) { setState(prev => ({ ...prev, isStreaming: false, error: 'No stream body' })); return; }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
          try {
            const parsed = JSON.parse(line.substring(6));
            if (parsed.token) {
              setState(prev => ({ ...prev, content: prev.content + parsed.token, model: parsed.model, provider: parsed.provider }));
            }
            if (parsed.done) {
              setState(prev => ({ ...prev, isStreaming: false, tokens: parsed.tokens, costUsd: parsed.cost_usd, latencyMs: parsed.latency_ms }));
            }
            if (parsed.error) {
              setState(prev => ({ ...prev, isStreaming: false, error: parsed.error }));
            }
          } catch { /* skip */ }
        }
      }

      setState(prev => ({ ...prev, isStreaming: false }));
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setState(prev => ({ ...prev, isStreaming: false, error: (err as Error).message }));
      }
    }
  }, []);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    setState(prev => ({ ...prev, isStreaming: false }));
  }, []);

  const reset = useCallback(() => {
    setState({ content: '', isStreaming: false, error: null });
  }, []);

  return { ...state, stream, cancel, reset };
}
