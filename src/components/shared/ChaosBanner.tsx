import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listActiveChaosExperiments } from '@/services/chaosService';
import { getWorkspaceId } from '@/lib/agentService';

/**
 * Persistent warning banner — shown when chaos experiments are active.
 * Polls every 30s. Renders nothing when no experiments active.
 */
export function ChaosBanner() {
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;

    const tick = async () => {
      try {
        const wsId = await getWorkspaceId();
        const list = await listActiveChaosExperiments(wsId);
        if (!cancelled) setActiveCount(list.length);
      } catch {
        if (!cancelled) setActiveCount(0);
      }
    };

    tick();
    interval = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, []);

  if (activeCount === 0) return null;

  return (
    <div className="sticky top-0 z-50 border-b border-nexus-amber/40 bg-nexus-amber/15 backdrop-blur-md px-4 py-2 text-sm flex items-center justify-center gap-2 text-nexus-amber">
      <AlertTriangle className="h-4 w-4" aria-hidden="true" />
      <span className="font-medium">
        {activeCount} experimento{activeCount > 1 ? 's' : ''} de Chaos Engineering ativo{activeCount > 1 ? 's' : ''}
      </span>
      <Link to="/observability/chaos" className="underline font-semibold ml-2 hover:opacity-80">
        Gerenciar
      </Link>
    </div>
  );
}
