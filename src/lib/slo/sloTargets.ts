/**
 * Nexus Agents Studio — SLO Targets
 * ═══════════════════════════════════════════════════════════════
 * Service Level Objective targets and threshold helpers.
 * Single source of truth for "what does healthy look like?"
 */

export type SLOStatus = 'healthy' | 'warning' | 'breached';

export const SLO_TARGETS = {
  /** P95 latency target in milliseconds */
  p95LatencyMs: 2000,
  /** P99 latency target in milliseconds */
  p99LatencyMs: 5000,
  /** Success rate target (percentage) */
  successRatePct: 99,
  /** Monthly error budget (percentage of allowed failures) */
  errorBudgetPct: 1,
} as const;

/** Warning thresholds (between target and breach) */
export const SLO_WARNING = {
  p95LatencyMs: SLO_TARGETS.p95LatencyMs * 0.8, // 1600ms
  p99LatencyMs: SLO_TARGETS.p99LatencyMs * 0.8, // 4000ms
  successRatePct: 99.5,
} as const;

/** Returns status based on latency vs target (lower is better) */
export function latencyStatus(actualMs: number, targetMs: number): SLOStatus {
  if (actualMs <= targetMs * 0.8) return 'healthy';
  if (actualMs <= targetMs) return 'warning';
  return 'breached';
}

/** Returns status based on success rate (higher is better) */
export function successRateStatus(actualPct: number): SLOStatus {
  if (actualPct >= SLO_WARNING.successRatePct) return 'healthy';
  if (actualPct >= SLO_TARGETS.successRatePct) return 'warning';
  return 'breached';
}

/** Returns status based on error budget consumed (lower is better) */
export function errorBudgetStatus(consumedPct: number): SLOStatus {
  if (consumedPct <= 50) return 'healthy';
  if (consumedPct <= 100) return 'warning';
  return 'breached';
}

/** Map status → semantic Tailwind text color token */
export const statusColor: Record<SLOStatus, string> = {
  healthy: 'text-nexus-green',
  warning: 'text-nexus-amber',
  breached: 'text-destructive',
};

/** Map status → semantic Tailwind background token (for badges) */
export const statusBg: Record<SLOStatus, string> = {
  healthy: 'bg-nexus-green/10 text-nexus-green border-nexus-green/30',
  warning: 'bg-nexus-amber/10 text-nexus-amber border-nexus-amber/30',
  breached: 'bg-destructive/10 text-destructive border-destructive/30',
};

export const statusLabel: Record<SLOStatus, string> = {
  healthy: 'Saudável',
  warning: 'Atenção',
  breached: 'Violado',
};
