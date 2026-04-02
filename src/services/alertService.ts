/**
 * Alert Service — Auto-generates alerts based on agent behavior
 * Monitors: cost thresholds, error rates, latency spikes, guardrail triggers
 */
import { logger } from '@/lib/logger';
import * as traceService from './traceService';

// ═══ TYPES ═══

export interface Alert {
  id: string;
  severity: 'info' | 'warning' | 'critical';
  type: 'cost' | 'error_rate' | 'latency' | 'guardrail' | 'budget' | 'system';
  title: string;
  message: string;
  agentId?: string;
  timestamp: string;
  acknowledged: boolean;
}

export interface AlertRule {
  id: string;
  name: string;
  type: Alert['type'];
  condition: () => Alert | null;
  intervalMs: number;
  enabled: boolean;
}

// ═══ STORE ═══

const alerts: Alert[] = [];
const rules: AlertRule[] = [];
let checkInterval: ReturnType<typeof setInterval> | null = null;

// ═══ ALERT CRUD ═══

export function getAlerts(limit = 50): Alert[] {
  return alerts.slice(0, limit);
}

export function getUnacknowledged(): Alert[] {
  return alerts.filter(a => !a.acknowledged);
}

export function acknowledgeAlert(id: string): void {
  const alert = alerts.find(a => a.id === id);
  if (alert) alert.acknowledged = true;
}

export function acknowledgeAll(): void {
  alerts.forEach(a => { a.acknowledged = true; });
}

export function clearAlerts(): void {
  alerts.length = 0;
}

function addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>): Alert {
  const full: Alert = { ...alert, id: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, timestamp: new Date().toISOString(), acknowledged: false };
  alerts.unshift(full);
  if (alerts.length > 200) alerts.length = 200;
  logger.warn(`Alert [${alert.severity}]: ${alert.title} — ${alert.message}`, 'alertService');
  return full;
}

// ═══ DEFAULT RULES ═══

export function initDefaultRules(): void {
  // Rule 1: High error rate (>20% in last 10 traces)
  registerRule({
    id: 'high-error-rate', name: 'High Error Rate', type: 'error_rate', intervalMs: 60000, enabled: true,
    condition: () => {
      const recent = traceService.getTraces(10);
      if (recent.length < 3) return null;
      const errors = recent.filter(t => t.status === 'error').length;
      const rate = errors / recent.length;
      if (rate > 0.2) return { severity: 'critical', type: 'error_rate', title: 'Taxa de erro alta', message: `${Math.round(rate * 100)}% de erro nas últimas ${recent.length} execuções` };
      return null;
    },
  });

  // Rule 2: High latency (>10s average)
  registerRule({
    id: 'high-latency', name: 'High Latency', type: 'latency', intervalMs: 60000, enabled: true,
    condition: () => {
      const recent = traceService.getTraces(5);
      if (recent.length < 2) return null;
      const avgLatency = recent.reduce((s, t) => s + t.latency_ms, 0) / recent.length;
      if (avgLatency > 10000) return { severity: 'warning', type: 'latency', title: 'Latência alta', message: `Média de ${(avgLatency / 1000).toFixed(1)}s nas últimas ${recent.length} execuções` };
      return null;
    },
  });

  // Rule 3: Budget approaching (>80%)
  registerRule({
    id: 'budget-warning', name: 'Budget Warning', type: 'budget', intervalMs: 300000, enabled: true,
    condition: () => {
      const cost = traceService.getTotalCost(30);
      if (cost > 50) return { severity: 'warning', type: 'budget', title: 'Custo mensal elevado', message: `$${cost.toFixed(2)} gastos nos últimos 30 dias` };
      return null;
    },
  });

  // Rule 4: Guardrails triggered frequently
  registerRule({
    id: 'guardrail-frequency', name: 'Guardrail Frequency', type: 'guardrail', intervalMs: 120000, enabled: true,
    condition: () => {
      const recent = traceService.getTraces(20);
      const triggered = recent.filter(t => t.guardrails_triggered.length > 0).length;
      if (triggered > 5) return { severity: 'warning', type: 'guardrail', title: 'Guardrails ativados frequentemente', message: `${triggered} de ${recent.length} execuções ativaram guardrails` };
      return null;
    },
  });

  logger.info('Alert rules initialized (4 default rules)', 'alertService');
}

// ═══ RULE MANAGEMENT ═══

export function registerRule(rule: AlertRule): void {
  rules.push(rule);
}

export function getRules(): AlertRule[] {
  return [...rules];
}

export function toggleRule(id: string): void {
  const rule = rules.find(r => r.id === id);
  if (rule) rule.enabled = !rule.enabled;
}

// ═══ CHECK ENGINE ═══

/** Run all enabled rules once. */
export function checkRules(): Alert[] {
  const newAlerts: Alert[] = [];
  for (const rule of rules.filter(r => r.enabled)) {
    try {
      const alert = rule.condition();
      if (alert) {
        // Prevent duplicate alerts within 5 minutes
        const recentDup = alerts.find(a => a.type === alert.type && a.title === alert.title && Date.now() - new Date(a.timestamp).getTime() < 300000);
        if (!recentDup) {
          const created = addAlert(alert);
          newAlerts.push(created);
        }
      }
    } catch {
      // Rule evaluation error — skip
    }
  }
  return newAlerts;
}

/** Start periodic alert checking. */
export function startMonitoring(intervalMs = 60000): void {
  if (checkInterval) return;
  checkInterval = setInterval(() => checkRules(), intervalMs);
  logger.info(`Alert monitoring started (every ${intervalMs / 1000}s)`, 'alertService');
}

/** Stop periodic checking. */
export function stopMonitoring(): void {
  if (checkInterval) { clearInterval(checkInterval); checkInterval = null; }
}

// ═══ INIT ═══
initDefaultRules();
