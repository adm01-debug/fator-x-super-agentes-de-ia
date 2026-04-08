/**
 * Nexus Agents Studio — Health Alerts Service (T16)
 * Polls system + datahub health and emits notifications when status
 * transitions occur. Uses a small in-memory state machine to avoid
 * spamming notifications for the same condition every poll.
 *
 * Lifecycle:
 *  1. start() — begins polling at the given interval
 *  2. stop()  — clears the timer
 *  3. checkOnce() — single immediate check
 *
 * Transition rules:
 *  - healthy → degraded   : warning notification
 *  - healthy → critical   : critical notification
 *  - degraded → critical  : critical notification (escalation)
 *  - X → healthy          : success notification (recovery)
 *  - critical → degraded  : warning notification (partial recovery)
 *  - same state → silent  : no notification
 */
import { useNotificationStore, type Notification } from '@/stores/notificationStore';
import { getSystemHealth, type HealthStatus } from '@/services/healthService';
import { getDatahubHealth, type DatahubHealthReport } from '@/services/datahubService';
import { logger } from '@/lib/logger';

type OverallStatus = 'healthy' | 'degraded' | 'critical';

interface AlertState {
  systemStatus: OverallStatus | null;
  datahubStatus: DatahubHealthReport['overall_status'] | null;
  failedDatabases: Set<string>;
  lastCheckAt: string | null;
}

const STATE: AlertState = {
  systemStatus: null,
  datahubStatus: null,
  failedDatabases: new Set(),
  lastCheckAt: null,
};

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Maps the legacy 4-level HealthStatus to a simpler 3-level overall.
 */
function normalizeSystemHealth(statuses: HealthStatus[]): OverallStatus {
  const downCount = statuses.filter((s) => s === 'down').length;
  const degradedCount = statuses.filter((s) => s === 'degraded').length;
  const total = statuses.length;
  if (total === 0) return 'healthy';
  if (downCount >= total / 2) return 'critical';
  if (downCount > 0 || degradedCount > 0) return 'degraded';
  return 'healthy';
}

interface AlertPayload {
  title: string;
  message: string;
  type: Notification['type'];
  priority: Notification['priority'];
}

/**
 * Compute the right notification payload for a status transition.
 * Returns null when no notification should be emitted.
 */
function buildTransitionAlert(
  previous: OverallStatus | null,
  current: OverallStatus,
  context: string
): AlertPayload | null {
  // First observation: only emit if not healthy
  if (previous === null) {
    if (current === 'healthy') return null;
    return current === 'critical'
      ? {
          title: `${context}: Estado crítico`,
          message: 'Detectado em estado crítico ao iniciar o monitoramento',
          type: 'error',
          priority: 'critical',
        }
      : {
          title: `${context}: Estado degradado`,
          message: 'Detectado em estado degradado ao iniciar o monitoramento',
          type: 'warning',
          priority: 'medium',
        };
  }

  if (previous === current) return null;

  // Recovery
  if (current === 'healthy') {
    return {
      title: `${context}: Recuperado`,
      message: `Voltou ao estado saudável (era ${previous})`,
      type: 'success',
      priority: 'low',
    };
  }

  // Escalation to critical
  if (current === 'critical') {
    return {
      title: `${context}: Crítico`,
      message: `Escalou de ${previous} para crítico — ação necessária`,
      type: 'error',
      priority: 'critical',
    };
  }

  // Partial recovery (critical → degraded)
  if (previous === 'critical' && current === 'degraded') {
    return {
      title: `${context}: Recuperação parcial`,
      message: 'Saiu do estado crítico mas ainda degradado',
      type: 'warning',
      priority: 'medium',
    };
  }

  // Healthy → degraded
  return {
    title: `${context}: Degradado`,
    message: 'Saiu do estado saudável — monitorando',
    type: 'warning',
    priority: 'medium',
  };
}

function emit(payload: AlertPayload, actionUrl?: string) {
  try {
    useNotificationStore.getState().add({
      title: payload.title,
      message: payload.message,
      type: payload.type,
      priority: payload.priority,
      actionUrl,
      actionLabel: actionUrl ? 'Ver detalhes' : undefined,
    });
  } catch (e) {
    logger.error('healthAlerts emit failed', { error: e instanceof Error ? e.message : String(e) });
  }
}

/**
 * Runs a single health check pass and emits any necessary notifications.
 */
export async function checkOnce(): Promise<void> {
  STATE.lastCheckAt = new Date().toISOString();

  // System health
  try {
    const sysHealth = await getSystemHealth();
    const overall = normalizeSystemHealth(
      Object.values(sysHealth.checks).map((c) => c.status)
    );
    const alert = buildTransitionAlert(STATE.systemStatus, overall, 'Sistema');
    if (alert) emit(alert, '/monitoring');
    STATE.systemStatus = overall;
  } catch (e) {
    logger.error('healthAlerts system check failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }

  // DataHub health
  try {
    const dhHealth = await getDatahubHealth();
    const alert = buildTransitionAlert(STATE.datahubStatus, dhHealth.overall_status, 'DataHub');
    if (alert) emit(alert, '/datahub');
    STATE.datahubStatus = dhHealth.overall_status;

    // Per-database transitions: notify when a previously-healthy db goes offline
    const currentlyFailed = new Set<string>();
    for (const proj of dhHealth.projects) {
      if (!proj.reachable) {
        currentlyFailed.add(proj.ref);
        if (!STATE.failedDatabases.has(proj.ref)) {
          // Newly failed
          emit(
            {
              title: `Banco offline: ${proj.project}`,
              message: proj.error ?? 'Conexão falhou — DataHub afetado',
              type: 'error',
              priority: 'high',
            },
            '/datahub'
          );
        }
      } else if (STATE.failedDatabases.has(proj.ref)) {
        // Recovered
        emit(
          {
            title: `Banco recuperado: ${proj.project}`,
            message: 'Conexão restabelecida',
            type: 'success',
            priority: 'low',
          },
          '/datahub'
        );
      }
    }
    STATE.failedDatabases = currentlyFailed;
  } catch (e) {
    logger.error('healthAlerts datahub check failed', {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

/**
 * Begin polling. Default: every 2 minutes.
 * Safe to call multiple times — replaces any existing timer.
 */
export function start(intervalMs = 120_000): void {
  stop();
  // Run an initial check immediately
  void checkOnce();
  pollTimer = setInterval(() => {
    void checkOnce();
  }, intervalMs);
}

export function stop(): void {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

export function getCurrentState() {
  return {
    systemStatus: STATE.systemStatus,
    datahubStatus: STATE.datahubStatus,
    failedDatabases: Array.from(STATE.failedDatabases),
    lastCheckAt: STATE.lastCheckAt,
    isPolling: pollTimer !== null,
  };
}
