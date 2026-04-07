/**
 * Nexus Agents Studio — Health Service
 * Wraps the health-check Edge Function for system observability.
 */
import { supabase } from '@/integrations/supabase/client';
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

/**
 * Invokes the health-check edge function and returns the system health snapshot.
 * Throws on transport errors; returns a `down` snapshot if the EF itself fails.
 */
export async function getSystemHealth(): Promise<SystemHealth> {
  try {
    const { data, error } = await supabase.functions.invoke('health-check', {
      method: 'GET',
    });
    if (error) {
      logger.error('health-check invoke failed', { error: error.message });
      return {
        status: 'down',
        checks: { gateway: { status: 'down', error: error.message } },
        uptime_ms: 0,
        timestamp: new Date().toISOString(),
        version: 'unknown',
      };
    }
    return data as SystemHealth;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    logger.error('health-check transport error', { error: message });
    return {
      status: 'down',
      checks: { transport: { status: 'down', error: message } },
      uptime_ms: 0,
      timestamp: new Date().toISOString(),
      version: 'unknown',
    };
  }
}

/**
 * Tailwind / hex tokens for health status badges.
 * Aligned with Nexus design system colors.
 */
export function statusColor(status: HealthStatus): string {
  switch (status) {
    case 'healthy':
      return '#6BCB77';
    case 'degraded':
      return '#FFD93D';
    case 'down':
      return '#FF6B6B';
    default:
      return '#9B59B6';
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
