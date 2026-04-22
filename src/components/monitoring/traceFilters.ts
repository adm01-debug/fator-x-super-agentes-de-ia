/**
 * AdvancedTraceFilters — tipo, defaults e filtro puro (sem JSX).
 */

export interface TraceFilters {
  dateFrom: string;
  dateTo: string;
  minLatency: string;
  maxLatency: string;
  minCost: string;
  maxCost: string;
  level: string;
  event: string;
}

export const EMPTY_FILTERS: TraceFilters = {
  dateFrom: '',
  dateTo: '',
  minLatency: '',
  maxLatency: '',
  minCost: '',
  maxCost: '',
  level: 'all',
  event: '',
};

export function applyTraceFilters(
  traces: Record<string, unknown>[],
  filters: TraceFilters,
): Record<string, unknown>[] {
  return traces.filter((t) => {
    const createdAt = t.created_at;
    if (filters.dateFrom) {
      const traceDate = new Date(String(createdAt ?? '')).toISOString().split('T')[0];
      if (traceDate < filters.dateFrom) return false;
    }
    if (filters.dateTo) {
      const traceDate = new Date(String(createdAt ?? '')).toISOString().split('T')[0];
      if (traceDate > filters.dateTo) return false;
    }
    const latency = t.latency_ms as number | undefined;
    if (filters.minLatency && latency != null && latency < Number(filters.minLatency)) return false;
    if (filters.maxLatency && latency != null && latency > Number(filters.maxLatency)) return false;
    const cost = t.cost_usd as number | string | undefined;
    if (filters.minCost && cost != null && Number(cost) < Number(filters.minCost)) return false;
    if (filters.maxCost && cost != null && Number(cost) > Number(filters.maxCost)) return false;
    if (filters.level !== 'all' && t.level !== filters.level) return false;
    const event = typeof t.event === 'string' ? t.event : '';
    if (filters.event && !event.toLowerCase().includes(filters.event.toLowerCase())) return false;
    return true;
  });
}
