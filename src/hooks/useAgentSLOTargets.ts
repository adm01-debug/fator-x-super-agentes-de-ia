/**
 * Persiste metas SLO ajustáveis por agente em localStorage.
 */
import { useCallback, useEffect, useState } from 'react';

export interface SLOTargetsConfig {
  p50: number;
  p95: number;
  p99: number;
  availability: number; // %
  errorBudget: number;  // %
}

export const DEFAULT_SLO_TARGETS: SLOTargetsConfig = {
  p50: 800,
  p95: 2000,
  p99: 5000,
  availability: 99.5,
  errorBudget: 1,
};

const KEY = (agentId: string) => `nexus-slo-targets-${agentId}`;

export function useAgentSLOTargets(agentId: string) {
  const [targets, setTargetsState] = useState<SLOTargetsConfig>(DEFAULT_SLO_TARGETS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY(agentId));
      if (raw) {
        const parsed = JSON.parse(raw);
        setTargetsState({ ...DEFAULT_SLO_TARGETS, ...parsed });
      } else {
        setTargetsState(DEFAULT_SLO_TARGETS);
      }
    } catch {
      setTargetsState(DEFAULT_SLO_TARGETS);
    }
  }, [agentId]);

  const setTargets = useCallback((next: Partial<SLOTargetsConfig>) => {
    setTargetsState((prev) => {
      const merged = { ...prev, ...next };
      try { localStorage.setItem(KEY(agentId), JSON.stringify(merged)); } catch { /* noop */ }
      return merged;
    });
  }, [agentId]);

  const reset = useCallback(() => {
    try { localStorage.removeItem(KEY(agentId)); } catch { /* noop */ }
    setTargetsState(DEFAULT_SLO_TARGETS);
  }, [agentId]);

  return { targets, setTargets, reset };
}
