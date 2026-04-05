/**
 * Nexus Agents Studio — useAutomation Hook
 *
 * Convenience hook for using automation services in React components
 * with loading states, error handling, and auto-refresh.
 *
 * Melhoria 5/10 — automation improvements
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { getScheduleStats, type ScheduleStats } from '@/services/cronSchedulerService';
import { getNotificationStats, type NotificationStats } from '@/services/notificationEngineService';
import { getExecutionStats } from '@/services/executionHistoryService';
import { getVaultStats, type VaultStats } from '@/services/credentialVaultService';
import { getAllCircuitBreakers, type CircuitBreakerState } from '@/services/retryEngineService';
import { useToast } from '@/hooks/use-toast';

export interface AutomationDashboardData {
  schedules: ScheduleStats | null;
  notifications: NotificationStats | null;
  executions: Awaited<ReturnType<typeof getExecutionStats>> | null;
  vault: VaultStats | null;
  circuitBreakers: CircuitBreakerState[];
  lastRefresh: Date | null;
}

export function useAutomationDashboard(refreshIntervalMs: number = 30000) {
  const [data, setData] = useState<AutomationDashboardData>({
    schedules: null,
    notifications: null,
    executions: null,
    vault: null,
    circuitBreakers: [],
    lastRefresh: null,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [schedules, notifications, executions, vault] = await Promise.allSettled([
        getScheduleStats(),
        getNotificationStats(),
        getExecutionStats(24),
        getVaultStats(),
      ]);

      setData({
        schedules: schedules.status === 'fulfilled' ? schedules.value : null,
        notifications: notifications.status === 'fulfilled' ? notifications.value : null,
        executions: executions.status === 'fulfilled' ? executions.value : null,
        vault: vault.status === 'fulfilled' ? vault.value : null,
        circuitBreakers: getAllCircuitBreakers(),
        lastRefresh: new Date(),
      });
      setError(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erro ao carregar dados';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();

    if (refreshIntervalMs > 0) {
      intervalRef.current = setInterval(refresh, refreshIntervalMs);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refresh, refreshIntervalMs]);

  return { data, loading, error, refresh };
}

/* ------------------------------------------------------------------ */
/*  Typed async action helper                                          */
/* ------------------------------------------------------------------ */

export function useAsyncAction<TArgs extends unknown[], TResult>(
  action: (...args: TArgs) => Promise<TResult>,
) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const { toast } = useToast();

  const execute = useCallback(
    async (...args: TArgs): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await action(...args);
        setResult(res);
        return res;
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Erro inesperado';
        setError(msg);
        toast({ title: 'Erro', description: msg, variant: 'destructive' });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [action, toast],
  );

  return { execute, loading, error, result };
}
