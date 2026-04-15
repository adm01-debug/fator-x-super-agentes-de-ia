/**
 * Nexus Agents Studio — Health Service
 * Wraps the health-check Edge Function for system observability.
 */
import { logger } from '@/lib/logger';

export type HealthStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

export interface HealthCheckEntry {
  status: HealthStatus;
  latency_ms?: number;
  error?: string;
}

export interface SystemHealth {
  status: HealthStatus;
  checks: Record<string, HealthCheckEntry>;
  uptime_ms: number;
  timestamp: string;
  version: string;
}

/** Track consecutive failures to suppress repetitive logs */
let consecutiveFailures = 0;

const DOWN_SNAPSHOT = (error: string): SystemHealth => ({
  status: 'down',
  checks: { gateway: { status: 'down', error } },
  uptime_ms: 0,
  timestamp: new Date().toISOString(),
  version: 'unknown',
});

/**
 * Invokes the health-check edge function and returns the system health snapshot.
 * Never throws — returns a `down` snapshot on any failure.
 * Suppresses repetitive error logs after the first failure.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  try {
    const { data, error } = await supabase.functions.invoke('health-check', {
      method: 'GET',
    });
    if (error) {
      consecutiveFailures++;
      // Only log the first failure and then every 10th to avoid console spam
      if (consecutiveFailures === 1) {
        logger.warn('health-check unavailable (will suppress further logs)', { error: error.message });
      } else if (consecutiveFailures % 10 === 0) {
        logger.warn(`health-check still unavailable (${consecutiveFailures} consecutive failures)`);
      }
      return DOWN_SNAPSHOT(error.message);
    }
    // Reset on success
    if (consecutiveFailures > 0) {
      logger.info('health-check recovered after ' + consecutiveFailures + ' failures');
      consecutiveFailures = 0;
    }
    return data as SystemHealth;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    consecutiveFailures++;
    if (consecutiveFailures === 1) {
      logger.warn('health-check transport error (will suppress further logs)', { error: message });
    }
    return DOWN_SNAPSHOT(message);
  }
}

/**
 * Tailwind / hex tokens for health status badges.
 * Aligned with Nexus design system colors.
 */
export function statusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'hsl(var(--nexus-emerald))';
    case 'degraded':
      return 'hsl(var(--nexus-amber))';
    case 'down':
      return 'hsl(var(--nexus-rose))';
    default:
      return 'hsl(var(--nexus-purple))';
  }
}

export function statusLabel(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return 'Saudável';
    case 'degraded':
      return 'Degradado';
    case 'down':
      return 'Fora do ar';
    default:
      return 'Desconhecido';
  }
}
