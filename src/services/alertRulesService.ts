/**
 * alertRulesService — persistência client-side de regras de alerta por agente.
 * Funções puras de avaliação e simulação sobre traces mockados.
 */
import type { AgentTraceRow } from '@/services/agentTracesService';
import {
  computeMetric, compare, formatMetricValue, METRIC_CATALOG,
  type AlertMetric, type AlertAggregation,
} from '@/lib/alertMetrics';

export type AlertOperator = '>' | '<' | '>=' | '<=' | '==';
export type AlertSeverity = 'info' | 'warning' | 'critical';
export type AlertChannel = 'toast' | 'email' | 'webhook';
export type AlertWindowMin = 5 | 15 | 60 | 1440;

export interface AlertRule {
  id: string;
  agent_id: string;
  workspace_id: string | null;
  name: string;
  description?: string;
  metric: AlertMetric;
  aggregation: AlertAggregation;
  operator: AlertOperator;
  threshold: number;
  window_minutes: AlertWindowMin;
  severity: AlertSeverity;
  channels: AlertChannel[];
  is_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export interface RuleEvaluation {
  value: number;
  triggers: boolean;
  formatted: string;
  formattedThreshold: string;
}

export interface RuleSimulationBucket {
  ts: string;
  hour: string;
  value: number;
  triggered: boolean;
  trace_ids: string[];
}

export interface RuleSimulation {
  buckets: RuleSimulationBucket[];
  triggers: number;
  first_trigger?: string;
  last_trigger?: string;
  max_value: number;
}

const STORAGE_PREFIX = 'nexus.alert_rules';

function storageKey(workspaceId: string | null, agentId: string): string {
  return `${STORAGE_PREFIX}.${workspaceId ?? 'local'}.${agentId}`;
}

function readAll(workspaceId: string | null, agentId: string): AlertRule[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(storageKey(workspaceId, agentId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AlertRule[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(workspaceId: string | null, agentId: string, rules: AlertRule[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(storageKey(workspaceId, agentId), JSON.stringify(rules));
}

export const alertRulesService = {
  list(workspaceId: string | null, agentId: string): AlertRule[] {
    return readAll(workspaceId, agentId);
  },

  upsert(workspaceId: string | null, agentId: string, rule: AlertRule): AlertRule {
    const all = readAll(workspaceId, agentId);
    const idx = all.findIndex((r) => r.id === rule.id);
    const next = { ...rule, updated_at: new Date().toISOString() };
    if (idx >= 0) all[idx] = next;
    else all.unshift(next);
    writeAll(workspaceId, agentId, all);
    return next;
  },

  remove(workspaceId: string | null, agentId: string, id: string): void {
    writeAll(workspaceId, agentId, readAll(workspaceId, agentId).filter((r) => r.id !== id));
  },

  toggle(workspaceId: string | null, agentId: string, id: string, enabled: boolean): void {
    const all = readAll(workspaceId, agentId);
    const r = all.find((x) => x.id === id);
    if (!r) return;
    r.is_enabled = enabled;
    r.updated_at = new Date().toISOString();
    writeAll(workspaceId, agentId, all);
  },
};

/* ─────────────── Templates ─────────────── */

export const ALERT_RULE_TEMPLATES: Array<Omit<AlertRule, 'id' | 'agent_id' | 'workspace_id' | 'created_at' | 'updated_at'>> = [
  {
    name: 'Latência p95 alta',
    description: 'Dispara quando o p95 de latência ultrapassa 800ms na janela.',
    metric: 'latency_ms', aggregation: 'p95', operator: '>', threshold: 800,
    window_minutes: 5, severity: 'warning', channels: ['toast'], is_enabled: true,
  },
  {
    name: 'Custo por execução estourado',
    description: 'Alguma execução custou mais do que $0.05.',
    metric: 'cost_per_exec', aggregation: 'max', operator: '>', threshold: 0.05,
    window_minutes: 60, severity: 'warning', channels: ['toast'], is_enabled: true,
  },
  {
    name: 'Tool failure rate crítico',
    description: 'Mais de 10% das chamadas de tools falharam.',
    metric: 'tool_failure_rate', aggregation: 'rate', operator: '>', threshold: 10,
    window_minutes: 60, severity: 'critical', channels: ['toast'], is_enabled: true,
  },
  {
    name: 'Memória excedida',
    description: 'Pico de memória ultrapassou 800MB.',
    metric: 'memory_mb', aggregation: 'max', operator: '>', threshold: 800,
    window_minutes: 5, severity: 'info', channels: ['toast'], is_enabled: true,
  },
];

export function makeRuleFromTemplate(
  tpl: typeof ALERT_RULE_TEMPLATES[number],
  agentId: string,
  workspaceId: string | null,
): AlertRule {
  const now = new Date().toISOString();
  return {
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `rule-${Date.now()}`,
    agent_id: agentId,
    workspace_id: workspaceId,
    created_at: now,
    updated_at: now,
    ...tpl,
  };
}

/* ─────────────── Evaluation ─────────────── */

function filterByWindow(traces: AgentTraceRow[], windowMin: AlertWindowMin): AgentTraceRow[] {
  const cutoff = Date.now() - windowMin * 60_000;
  return traces.filter((t) => +new Date(t.created_at) >= cutoff);
}

export function evaluateRule(rule: AlertRule, traces: AgentTraceRow[]): RuleEvaluation {
  const window = filterByWindow(traces, rule.window_minutes);
  const value = computeMetric(rule.metric, rule.aggregation, window);
  return {
    value,
    triggers: compare(value, rule.operator, rule.threshold),
    formatted: formatMetricValue(rule.metric, value),
    formattedThreshold: formatMetricValue(rule.metric, rule.threshold),
  };
}

/**
 * Walks the last 24h in fixed buckets (default 60min), computing the metric
 * inside each bucket and flagging those that would trigger.
 */
export function simulateRule24h(
  rule: AlertRule,
  traces: AgentTraceRow[],
  bucketMinutes = 60,
): RuleSimulation {
  const now = Date.now();
  const horizon = now - 24 * 60 * 60_000;
  const bucketMs = bucketMinutes * 60_000;
  const buckets: RuleSimulationBucket[] = [];
  let triggers = 0;
  let first: string | undefined;
  let last: string | undefined;
  let maxValue = 0;

  for (let start = horizon; start < now; start += bucketMs) {
    const end = start + bucketMs;
    const inBucket = traces.filter((t) => {
      const ts = +new Date(t.created_at);
      return ts >= start && ts < end;
    });
    const value = computeMetric(rule.metric, rule.aggregation, inBucket);
    const triggered = inBucket.length > 0 && compare(value, rule.operator, rule.threshold);
    if (triggered) {
      triggers++;
      const iso = new Date(start).toISOString();
      if (!first) first = iso;
      last = iso;
    }
    if (value > maxValue) maxValue = value;
    buckets.push({
      ts: new Date(start).toISOString(),
      hour: new Date(start).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      value,
      triggered,
      trace_ids: inBucket.slice(0, 5).map((t) => t.id),
    });
  }

  return { buckets, triggers, first_trigger: first, last_trigger: last, max_value: maxValue };
}

export { METRIC_CATALOG };
