import { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { listActiveChaosExperiments } from '@/services/chaosService';
import { useWorkspace } from '@/contexts/WorkspaceContext';

/**
 * Persistent amber banner shown in every page when a chaos experiment is active.
 * Polls every 30s; renders nothing when no experiments are active.
 */
export function ChaosBanner() {
  const { currentWorkspace } = useWorkspace();
  const [activeCount, setActiveCount] = useState(0);

  useEffect(() => {
    if (!currentWorkspace?.id) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const list = await listActiveChaosExperiments(currentWorkspace.id);
        if (!cancelled) setActiveCount(list.length);
      } catch {
        if (!cancelled) setActiveCount(0);
      }
    };
    tick();
    const interval = setInterval(tick, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [currentWorkspace?.id]);

  if (activeCount === 0) return null;

  return (
    <div className="sticky top-0 z-50 bg-amber-500/15 border-b border-amber-500/40 backdrop-blur-md px-4 py-2 text-sm flex items-center justify-center gap-2 text-amber-700 dark:text-amber-300">
      <AlertTriangle className="h-4 w-4" />
      <span className="font-medium">
        {activeCount} experimento{activeCount > 1 ? 's' : ''} de Chaos Engineering ativo{activeCount > 1 ? 's' : ''}
      </span>
      <Link to="/observability/chaos" className="underline font-semibold ml-2 hover:opacity-80">
        Gerenciar
      </Link>
    </div>
  );
}
