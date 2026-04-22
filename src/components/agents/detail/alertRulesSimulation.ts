/**
 * Simulação de regras de alerta sobre traces históricos.
 * Avalia retroativamente quando cada regra teria disparado nos últimos N dias,
 * agregando por dia (saudável / disparou).
 */
import type { AgentTrace } from '@/services/agentsService';

export type AlertMetric = 'latency_ms' | 'cost_usd' | 'tokens_used' | 'error_rate_pct';
export type AlertOperator = '>' | '>=' | '<' | '<=' | '==';
export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SimulatedAlertRule {
  id: string;
  name: string;
  metric: AlertMetric;
  operator: AlertOperator;
  threshold: number;
  severity: AlertSeverity;
}

export interface AlertFireDay {
  date: string;       // ISO yyyy-mm-dd
  label: string;      // "12/04"
  fired: boolean;
  fireCount: number;  // qts traces disparariam (per-trace metrics) ou 1 (per-day)
  total: number;      // qts traces no dia
  observedValue: number; // valor agregado do dia (para tooltip)
}

export interface AlertSimulationResult {
  rule: SimulatedAlertRule;
  days: AlertFireDay[];
  totalFires: number;
  daysWithFires: number;
  worstDay: AlertFireDay | null;
}

const PER_TRACE_METRICS: AlertMetric[] = ['latency_ms', 'cost_usd', 'tokens_used'];

function compare(value: number, op: AlertOperator, threshold: number): boolean {
  switch (op) {
    case '>': return value > threshold;
    case '>=': return value >= threshold;
    case '<': return value < threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
  }
}

function extractTraceMetric(t: AgentTrace, metric: AlertMetric): number {
  switch (metric) {
    case 'latency_ms': return Number(t.latency_ms ?? 0);
    case 'cost_usd': return Number(t.cost_usd ?? 0);
    case 'tokens_used': return Number(t.tokens_used ?? 0);
    case 'error_rate_pct': return 0; // computed at day level
  }
}

/**
 * Simula uma regra contra os traces, agregando por dia ao longo dos últimos `days`.
 * - Métricas per-trace (latency, cost, tokens): cada trace que satisfaz a condição conta como 1 disparo.
 * - error_rate_pct: calculado por dia (% de erros), dispara se a taxa do dia satisfaz a condição.
 */
export function simulateAlertRule(
  rule: SimulatedAlertRule,
  traces: AgentTrace[],
  days = 14,
): AlertSimulationResult {
  const map = new Map<string, AlertFireDay>();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const iso = d.toISOString().split('T')[0];
    map.set(iso, {
      date: iso,
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      fired: false,
      fireCount: 0,
      total: 0,
      observedValue: 0,
    });
  }

  // First pass: counts and per-trace fires for per-trace metrics.
  const dayLatencyMax = new Map<string, number>();
  const dayCostMax = new Map<string, number>();
  const dayTokensMax = new Map<string, number>();
  const dayErrors = new Map<string, number>();

  traces.forEach((t) => {
    const created = (t as { created_at?: string }).created_at;
    if (!created) return;
    const iso = new Date(created).toISOString().split('T')[0];
    const day = map.get(iso);
    if (!day) return;
    day.total += 1;

    const lat = Number(t.latency_ms ?? 0);
    const cost = Number(t.cost_usd ?? 0);
    const tokens = Number(t.tokens_used ?? 0);
    if (lat > (dayLatencyMax.get(iso) ?? 0)) dayLatencyMax.set(iso, lat);
    if (cost > (dayCostMax.get(iso) ?? 0)) dayCostMax.set(iso, cost);
    if (tokens > (dayTokensMax.get(iso) ?? 0)) dayTokensMax.set(iso, tokens);
    if (t.level === 'error' || t.level === 'critical') {
      dayErrors.set(iso, (dayErrors.get(iso) ?? 0) + 1);
    }

    if (PER_TRACE_METRICS.includes(rule.metric)) {
      const v = extractTraceMetric(t, rule.metric);
      if (compare(v, rule.operator, rule.threshold)) {
        day.fireCount += 1;
        day.fired = true;
      }
    }
  });

  // Set observed value per day (worst-case for per-trace metrics, error% for the other).
  map.forEach((day, iso) => {
    if (rule.metric === 'latency_ms') day.observedValue = dayLatencyMax.get(iso) ?? 0;
    else if (rule.metric === 'cost_usd') day.observedValue = dayCostMax.get(iso) ?? 0;
    else if (rule.metric === 'tokens_used') day.observedValue = dayTokensMax.get(iso) ?? 0;
    else if (rule.metric === 'error_rate_pct') {
      const errors = dayErrors.get(iso) ?? 0;
      const rate = day.total > 0 ? (errors / day.total) * 100 : 0;
      day.observedValue = rate;
      if (day.total > 0 && compare(rate, rule.operator, rule.threshold)) {
        day.fired = true;
        day.fireCount = 1;
      }
    }
  });

  const arr = Array.from(map.values());
  const totalFires = arr.reduce((s, d) => s + d.fireCount, 0);
  const daysWithFires = arr.filter((d) => d.fired).length;
  const worstDay = arr.reduce<AlertFireDay | null>((acc, d) => {
    if (!d.fired) return acc;
    if (!acc) return d;
    return d.fireCount > acc.fireCount ? d : acc;
  }, null);

  return { rule, days: arr, totalFires, daysWithFires, worstDay };
}

export const ALERT_METRIC_META: Record<AlertMetric, { label: string; unit: string; format: (v: number) => string }> = {
  latency_ms: { label: 'Latência por trace', unit: 'ms', format: (v) => `${Math.round(v).toLocaleString('pt-BR')}ms` },
  cost_usd:   { label: 'Custo por trace',    unit: 'USD', format: (v) => `US$ ${v.toFixed(4)}` },
  tokens_used:{ label: 'Tokens por trace',   unit: 'tk',  format: (v) => `${Math.round(v).toLocaleString('pt-BR')} tk` },
  error_rate_pct: { label: 'Taxa de erro diária', unit: '%', format: (v) => `${v.toFixed(2)}%` },
};

export const ALERT_SEVERITY_META: Record<AlertSeverity, { label: string; tw: string; dot: string }> = {
  info:     { label: 'Info',     tw: 'text-muted-foreground border-border bg-secondary/40', dot: 'bg-muted-foreground' },
  warning:  { label: 'Warning',  tw: 'text-nexus-amber border-nexus-amber/40 bg-nexus-amber/10', dot: 'bg-nexus-amber' },
  critical: { label: 'Critical', tw: 'text-destructive border-destructive/40 bg-destructive/10', dot: 'bg-destructive' },
};
