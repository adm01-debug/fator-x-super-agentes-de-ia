/**
 * Helpers de agregação para a página de detalhes do agente.
 * Calcula percentis, séries diárias e SLOs a partir de traces + usage existentes.
 */
import type { AgentTrace, AgentUsage } from '@/services/agentsService';

export function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

export interface DailyPoint {
  date: string;       // ISO yyyy-mm-dd
  label: string;      // "12/04"
  requests: number;
  cost: number;
  tokens: number;
  avgLatency: number;
}

/** Constrói série diária dos últimos N dias preenchendo zeros. */
export function buildDailySeries(usage: AgentUsage[], days = 14): DailyPoint[] {
  const map = new Map<string, AgentUsage>();
  usage.forEach((u) => map.set(u.date, u));

  const out: DailyPoint[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    const row = map.get(iso);
    out.push({
      date: iso,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      requests: row?.requests ?? 0,
      cost: Number(row?.total_cost_usd ?? 0),
      tokens: Number((row?.tokens_input ?? 0) + (row?.tokens_output ?? 0)),
      avgLatency: Number(row?.avg_latency_ms ?? 0),
    });
  }
  return out;
}

export interface SLOMetrics {
  totalTraces: number;
  successCount: number;
  errorCount: number;
  warningCount: number;
  successRate: number;       // 0..100
  errorRate: number;          // 0..100
  p50: number;
  p95: number;
  p99: number;
  avgLatency: number;
  avgCost: number;
  totalTokens: number;
}

export function computeSLO(traces: AgentTrace[]): SLOMetrics {
  const lat = traces.map((t) => Number(t.latency_ms ?? 0)).filter((n) => n > 0);
  const total = traces.length;
  const errors = traces.filter((t) => t.level === 'error' || t.level === 'critical').length;
  const warnings = traces.filter((t) => t.level === 'warning' || t.level === 'warn').length;
  const success = total - errors;
  const totalCost = traces.reduce((s, t) => s + Number(t.cost_usd ?? 0), 0);
  const totalTokens = traces.reduce((s, t) => s + Number(t.tokens_used ?? 0), 0);

  return {
    totalTraces: total,
    successCount: success,
    errorCount: errors,
    warningCount: warnings,
    successRate: total > 0 ? (success / total) * 100 : 100,
    errorRate: total > 0 ? (errors / total) * 100 : 0,
    p50: Math.round(percentile(lat, 50)),
    p95: Math.round(percentile(lat, 95)),
    p99: Math.round(percentile(lat, 99)),
    avgLatency: lat.length > 0 ? Math.round(lat.reduce((a, b) => a + b, 0) / lat.length) : 0,
    avgCost: total > 0 ? totalCost / total : 0,
    totalTokens,
  };
}

export interface SLOTarget {
  label: string;
  value: number;
  target: number;
  unit: string;
  inverted?: boolean; // true = menor é melhor (latência, erro)
}

export function buildSLOTargets(slo: SLOMetrics): SLOTarget[] {
  return [
    { label: 'Disponibilidade', value: slo.successRate, target: 99.5, unit: '%' },
    { label: 'Taxa de erro', value: slo.errorRate, target: 1, unit: '%', inverted: true },
    { label: 'Latência p95', value: slo.p95, target: 2000, unit: 'ms', inverted: true },
    { label: 'Latência p99', value: slo.p99, target: 5000, unit: 'ms', inverted: true },
  ];
}

export function sloHealth(t: SLOTarget): 'healthy' | 'warning' | 'critical' {
  if (t.inverted) {
    if (t.value <= t.target) return 'healthy';
    if (t.value <= t.target * 1.5) return 'warning';
    return 'critical';
  }
  if (t.value >= t.target) return 'healthy';
  if (t.value >= t.target * 0.95) return 'warning';
  return 'critical';
}

export interface KPIComparison {
  current: number;
  previous: number;
  deltaAbs: number;
  deltaPct: number;
  hasPrev: boolean;
  trend: 'up' | 'down' | 'flat';
  isPositive: boolean;
  inverted: boolean;
}

/** Compara janela atual (últimos `window` dias) vs janela anterior. */
export function compareWindows(
  daily: DailyPoint[],
  pick: (d: DailyPoint) => number,
  opts: { inverted?: boolean; window?: number } = {},
): KPIComparison {
  const window = opts.window ?? 7;
  const inverted = !!opts.inverted;
  const last = daily.slice(-window);
  const prev = daily.slice(-window * 2, -window);
  const current = last.reduce((s, d) => s + pick(d), 0);
  const previous = prev.reduce((s, d) => s + pick(d), 0);
  const hasPrev = prev.length > 0 && previous > 0;
  const deltaAbs = current - previous;
  const deltaPct = hasPrev ? (deltaAbs / previous) * 100 : 0;
  const absPct = Math.abs(deltaPct);
  const trend: 'up' | 'down' | 'flat' = absPct <= 1 ? 'flat' : deltaPct > 0 ? 'up' : 'down';
  // positivo = bom; quando inverted, queda é boa
  const isPositive = inverted ? deltaPct < 0 : deltaPct > 0;
  return { current, previous, deltaAbs, deltaPct, hasPrev, trend, isPositive, inverted };
}

/** Compara taxa de sucesso (%) entre últimos 7d e 7d anteriores a partir dos traces. */
export function compareSuccessRateWindows(
  traces: AgentTrace[],
  window = 7,
): KPIComparison {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutCurrent = new Date(today);
  cutCurrent.setDate(today.getDate() - window + 1);
  const cutPrev = new Date(today);
  cutPrev.setDate(today.getDate() - window * 2 + 1);

  let curTotal = 0, curErr = 0, prevTotal = 0, prevErr = 0;
  for (const t of traces) {
    const created = (t as { created_at?: string }).created_at;
    if (!created) continue;
    const d = new Date(created);
    d.setHours(0, 0, 0, 0);
    const isErr = t.level === 'error' || t.level === 'critical';
    if (d >= cutCurrent && d <= today) {
      curTotal++;
      if (isErr) curErr++;
    } else if (d >= cutPrev && d < cutCurrent) {
      prevTotal++;
      if (isErr) prevErr++;
    }
  }
  const current = curTotal > 0 ? ((curTotal - curErr) / curTotal) * 100 : 0;
  const previous = prevTotal > 0 ? ((prevTotal - prevErr) / prevTotal) * 100 : 0;
  const hasPrev = prevTotal > 0;
  const deltaAbs = current - previous;
  const deltaPct = hasPrev && previous > 0 ? (deltaAbs / previous) * 100 : 0;
  const absPct = Math.abs(deltaPct);
  const trend: 'up' | 'down' | 'flat' = absPct <= 0.1 ? 'flat' : deltaPct > 0 ? 'up' : 'down';
  // sucesso: maior é melhor
  const isPositive = deltaPct > 0;
  return { current, previous, deltaAbs, deltaPct, hasPrev, trend, isPositive, inverted: false };
}

export function formatCost(v: number): string {
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

export function formatNumber(v: number): string {
  return v.toLocaleString('pt-BR');
}

/** Calcula consumo de error budget mensal e ETA de exaustão. */
export function computeBudgetBurn(
  slo: SLOMetrics,
  errorBudgetPct: number,
): { consumedPct: number; daysToExhaustion: number | null; status: 'healthy' | 'warning' | 'critical' } {
  if (slo.totalTraces === 0 || errorBudgetPct <= 0) {
    return { consumedPct: 0, daysToExhaustion: null, status: 'healthy' };
  }
  const consumedPct = Math.min(999, (slo.errorRate / errorBudgetPct) * 100);
  // assume janela observada = ~14 dias; mês = 30 dias
  const burnRatePerDay = slo.errorRate / 14;
  const remainingBudget = Math.max(0, errorBudgetPct - slo.errorRate);
  const daysToExhaustion = burnRatePerDay > 0 ? Math.round(remainingBudget / burnRatePerDay) : null;
  const status: 'healthy' | 'warning' | 'critical' =
    consumedPct >= 100 ? 'critical' : consumedPct >= 70 ? 'warning' : 'healthy';
  return { consumedPct, daysToExhaustion, status };
}

export interface ViolationDay {
  date: string;
  label: string;
  p95Violations: number;
  p99Violations: number;
  errors: number;
  total: number;
}

/** Agrupa traces por dia e conta violações vs. metas. */
export function buildViolationTimeline(
  traces: AgentTrace[],
  targets: { p95: number; p99: number },
  days = 14,
): ViolationDay[] {
  const map = new Map<string, ViolationDay>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    map.set(iso, {
      date: iso,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      p95Violations: 0,
      p99Violations: 0,
      errors: 0,
      total: 0,
    });
  }

  traces.forEach((t) => {
    const created = (t as { created_at?: string }).created_at;
    if (!created) return;
    const iso = new Date(created).toISOString().split('T')[0];
    const day = map.get(iso);
    if (!day) return;
    day.total += 1;
    const lat = Number(t.latency_ms ?? 0);
    if (lat > targets.p99) day.p99Violations += 1;
    else if (lat > targets.p95) day.p95Violations += 1;
    if (t.level === 'error' || t.level === 'critical') day.errors += 1;
  });

  return Array.from(map.values());
}

/**
 * Builds a violation timeline divided into N buckets covering the last `windowMs`.
 * Buckets are labeled as "HH:mm" for sub-day windows and "DD/MM" otherwise.
 * Useful for ad-hoc evaluation windows (1h, 6h, 24h, 7d, 30d…).
 */
export function buildViolationBuckets(
  traces: AgentTrace[],
  targets: { p95: number; p99: number },
  windowMs: number,
  bucketCount = 14,
): ViolationDay[] {
  const now = Date.now();
  const start = now - windowMs;
  const bucketMs = windowMs / bucketCount;
  const useTimeLabel = windowMs <= 24 * 60 * 60 * 1000;

  const buckets: ViolationDay[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketStart = new Date(start + i * bucketMs);
    let label: string;
    if (useTimeLabel) {
      label = `${String(bucketStart.getHours()).padStart(2, '0')}:${String(bucketStart.getMinutes()).padStart(2, '0')}`;
    } else {
      label = `${String(bucketStart.getDate()).padStart(2, '0')}/${String(bucketStart.getMonth() + 1).padStart(2, '0')}`;
    }
    buckets.push({
      date: bucketStart.toISOString(),
      label,
      p95Violations: 0,
      p99Violations: 0,
      errors: 0,
      total: 0,
    });
  }

  traces.forEach((t) => {
    const created = (t as { created_at?: string }).created_at;
    if (!created) return;
    const ts = new Date(created).getTime();
    if (ts < start || ts > now) return;
    const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((ts - start) / bucketMs)));
    const b = buckets[idx];
    b.total += 1;
    const lat = Number(t.latency_ms ?? 0);
    if (lat > targets.p99) b.p99Violations += 1;
    else if (lat > targets.p95) b.p95Violations += 1;
    if (t.level === 'error' || t.level === 'critical') b.errors += 1;
  });

  return buckets;
}

/** Filtra traces que caem dentro da janela de `windowMs` a partir de agora. */
export function filterTracesByWindow(traces: AgentTrace[], windowMs: number): AgentTrace[] {
  const cutoff = Date.now() - windowMs;
  return traces.filter((t) => {
    const created = (t as { created_at?: string }).created_at;
    if (!created) return false;
    return new Date(created).getTime() >= cutoff;
  });
}
