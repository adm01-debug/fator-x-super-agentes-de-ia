/**
 * alertMetrics — funções puras para calcular métricas de alerta a partir
 * de traces mockados (`agent_traces`). Sem efeitos colaterais.
 */
import type { AgentTraceRow } from '@/services/agentTracesService';

export type AlertMetric =
  | 'latency_ms'
  | 'cost_per_exec'
  | 'cost_window'
  | 'tool_failure_rate'
  | 'tool_failures_count'
  | 'memory_mb'
  | 'error_rate';

export type AlertAggregation = 'avg' | 'p95' | 'p99' | 'max' | 'sum' | 'count' | 'rate';

export const METRIC_CATALOG: Array<{
  metric: AlertMetric;
  label: string;
  unit: string;
  defaultAgg: AlertAggregation;
  allowedAggs: AlertAggregation[];
  defaultThreshold: number;
}> = [
  { metric: 'latency_ms',         label: 'Latência',                 unit: 'ms',  defaultAgg: 'p95', allowedAggs: ['avg', 'p95', 'p99', 'max'], defaultThreshold: 800 },
  { metric: 'cost_per_exec',      label: 'Custo por execução',       unit: 'USD', defaultAgg: 'max', allowedAggs: ['avg', 'max', 'sum'],         defaultThreshold: 0.05 },
  { metric: 'cost_window',        label: 'Custo na janela',          unit: 'USD', defaultAgg: 'sum', allowedAggs: ['sum'],                       defaultThreshold: 1.0 },
  { metric: 'tool_failure_rate',  label: 'Taxa de falha de tools',   unit: '%',   defaultAgg: 'rate', allowedAggs: ['rate'],                     defaultThreshold: 10 },
  { metric: 'tool_failures_count',label: 'Falhas de tools (count)',  unit: '',    defaultAgg: 'count', allowedAggs: ['count'],                   defaultThreshold: 3 },
  { metric: 'memory_mb',          label: 'Memória usada',            unit: 'MB',  defaultAgg: 'max', allowedAggs: ['avg', 'max'],                defaultThreshold: 800 },
  { metric: 'error_rate',         label: 'Taxa de erro geral',       unit: '%',   defaultAgg: 'rate', allowedAggs: ['rate'],                     defaultThreshold: 5 },
];

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

/** Deterministic memory_mb fallback when metadata.memory_mb is missing. */
function deriveMemoryMb(t: AgentTraceRow): number {
  const meta = (t.metadata ?? {}) as Record<string, unknown>;
  if (typeof meta.memory_mb === 'number') return meta.memory_mb;
  // Deterministic pseudo-random based on trace id (stable per render)
  let h = 0;
  for (let i = 0; i < t.id.length; i++) h = (h * 31 + t.id.charCodeAt(i)) | 0;
  return 200 + (Math.abs(h) % 800); // 200..1000 MB
}

/**
 * Returns a single numeric value for the given metric+aggregation
 * computed from the provided trace window.
 */
export function computeMetric(
  metric: AlertMetric,
  agg: AlertAggregation,
  traces: AgentTraceRow[],
): number {
  if (traces.length === 0) return 0;

  switch (metric) {
    case 'latency_ms': {
      const vals = traces.map((t) => t.latency_ms ?? 0).filter((v) => v > 0);
      if (vals.length === 0) return 0;
      if (agg === 'avg') return vals.reduce((s, v) => s + v, 0) / vals.length;
      if (agg === 'max') return Math.max(...vals);
      if (agg === 'p99') return percentile(vals, 99);
      return percentile(vals, 95);
    }
    case 'cost_per_exec': {
      const bySession = new Map<string, number>();
      for (const t of traces) {
        const key = t.session_id ?? t.id;
        bySession.set(key, (bySession.get(key) ?? 0) + Number(t.cost_usd ?? 0));
      }
      const vals = [...bySession.values()];
      if (vals.length === 0) return 0;
      if (agg === 'avg') return vals.reduce((s, v) => s + v, 0) / vals.length;
      if (agg === 'sum') return vals.reduce((s, v) => s + v, 0);
      return Math.max(...vals);
    }
    case 'cost_window':
      return traces.reduce((s, t) => s + Number(t.cost_usd ?? 0), 0);

    case 'tool_failure_rate': {
      const toolCalls = traces.filter((t) => t.event === 'tool.call');
      if (toolCalls.length === 0) return 0;
      const failed = toolCalls.filter((t) => t.level === 'error').length;
      return (failed / toolCalls.length) * 100;
    }
    case 'tool_failures_count':
      return traces.filter((t) => t.event === 'tool.call' && t.level === 'error').length;

    case 'memory_mb': {
      const vals = traces.map(deriveMemoryMb);
      if (agg === 'avg') return vals.reduce((s, v) => s + v, 0) / vals.length;
      return Math.max(...vals);
    }
    case 'error_rate': {
      const errors = traces.filter((t) => t.level === 'error').length;
      return (errors / traces.length) * 100;
    }
  }
}

export function compare(value: number, op: '>' | '<' | '>=' | '<=' | '==', threshold: number): boolean {
  switch (op) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return Math.abs(value - threshold) < 1e-9;
  }
}

export function formatMetricValue(metric: AlertMetric, value: number): string {
  const cfg = METRIC_CATALOG.find((m) => m.metric === metric);
  if (!cfg) return value.toFixed(2);
  if (cfg.unit === 'USD') return `$${value.toFixed(4)}`;
  if (cfg.unit === '%') return `${value.toFixed(1)}%`;
  if (cfg.unit === 'ms') return `${Math.round(value)}ms`;
  if (cfg.unit === 'MB') return `${Math.round(value)}MB`;
  return value.toFixed(0);
}
