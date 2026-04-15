/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — useTracesData Hook
 * ═══════════════════════════════════════════════════════════════
 * Fetches real execution traces from Supabase.
 * Replaces MOCK_TRACES in ObservabilityModule.
 */

import { useState, useEffect } from 'react';

interface ExecutionTrace {
  id: string;
  agent_id: string;
  session_id: string;
  user_input: string;
  final_output: string;
  total_tokens: number;
  total_cost: number;
  latency_ms: number;
  status: string;
  tool_calls: Record<string, unknown>[];
  guardrails_triggered: Record<string, unknown>[];
  created_at: string;
}

interface TracesState {
  traces: ExecutionTrace[];
  loading: boolean;
  error: string | null;
  total: number;
  avgLatency: number;
  avgCost: number;
  successRate: number;
}

export function useTracesData(
  agentId?: string,
  options: { limit?: number; offset?: number } = {},
): TracesState {
  const { limit = 20, offset = 0 } = options;
  const [state, setState] = useState<TracesState>({
    traces: [],
    loading: true,
    error: null,
    total: 0,
    avgLatency: 0,
    avgCost: 0,
    successRate: 100,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchTraces() {
      try {
        let query = supabase
          .from('trace_events')
          .select('*', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1);

        if (agentId) {
          // Filter by agent_id inside JSONB data column
          query = query.filter('data->>agent_id', 'eq', agentId);
        }

        const { data, error, count } = await query;

        if (error) throw error;

        const traces = (data ?? []).map((t: Record<string, unknown>) => ({
          id: String(t.id),
          agent_id: String(t.agent_id || ''),
          session_id: String(t.session_id || ''),
          user_input: String(t.input_data || t.user_input || ''),
          final_output: String(t.output_data || t.final_output || ''),
          total_tokens: Number(t.total_tokens || t.token_count || 0),
          total_cost: Number(t.cost_usd || t.total_cost || 0),
          latency_ms: Number(t.duration_ms || t.latency_ms || 0),
          status: String(t.status || 'success'),
          tool_calls: Array.isArray(t.tool_calls) ? t.tool_calls : [],
          guardrails_triggered: Array.isArray(t.guardrails_triggered) ? t.guardrails_triggered : [],
          created_at: String(t.created_at),
        })) as ExecutionTrace[];

        const successful = traces.filter((t) => t.status === 'success');
        const avgLatency =
          traces.length > 0 ? traces.reduce((s, t) => s + t.latency_ms, 0) / traces.length : 0;
        const avgCost =
          traces.length > 0 ? traces.reduce((s, t) => s + t.total_cost, 0) / traces.length : 0;
        const successRate = traces.length > 0 ? (successful.length / traces.length) * 100 : 100;

        if (!cancelled) {
          setState({
            traces,
            loading: false,
            error: null,
            total: count || traces.length,
            avgLatency: Math.round(avgLatency),
            avgCost: Number(avgCost.toFixed(4)),
            successRate: Math.round(successRate),
          });
        }
      } catch (err) {
        if (!cancelled) {
          setState((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load traces',
          }));
        }
      }
    }

    fetchTraces();
    return () => {
      cancelled = true;
    };
  }, [agentId, limit, offset]);

  return state;
}
