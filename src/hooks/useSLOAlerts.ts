/**
 * Nexus Agents Studio — useSLOAlerts
 * Polls SLO summary every 5 minutes and toasts on breach.
 * Mounted once in App.tsx for authenticated users.
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/useAuth';
import { fetchSLOSummary } from '@/lib/slo/sloService';
import { SLO_TARGETS, latencyStatus, successRateStatus } from '@/lib/slo/sloTargets';
import { logger } from '@/lib/logger';

const POLL_MS = 5 * 60_000;
const NOTIFIED_KEY = 'nexus-slo-last-alert';

export function useSLOAlerts() {
  const { user } = useAuth();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;

    const check = async () => {
      try {
        const summary = await fetchSLOSummary(1); // last hour
        if (cancelled || summary.total_traces === 0) return;

        const breaches: string[] = [];
        if (latencyStatus(summary.p95_latency_ms, SLO_TARGETS.p95LatencyMs) === 'breached') {
          breaches.push(
            `Latência P95 ${summary.p95_latency_ms}ms (alvo ${SLO_TARGETS.p95LatencyMs}ms)`,
          );
        }
        if (successRateStatus(summary.success_rate) === 'breached') {
          breaches.push(
            `Taxa de sucesso ${summary.success_rate}% (alvo ${SLO_TARGETS.successRatePct}%)`,
          );
        }

        if (breaches.length === 0) return;

        // Dedupe: only fire once per hour per breach signature
        const sig = breaches.join('|');
        const last = sessionStorage.getItem(NOTIFIED_KEY);
        if (last === sig) return;
        sessionStorage.setItem(NOTIFIED_KEY, sig);

        toast.error('SLO violado', {
          description: breaches.join(' · '),
          duration: 10_000,
          action: {
            label: 'Ver dashboard',
            onClick: () => {
              window.location.href = '/observability/slo';
            },
          },
        });
      } catch (err) {
        logger.error('SLO poll failed:', err);
      }
    };

    check(); // immediate
    timerRef.current = window.setInterval(check, POLL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [user]);
}
