/**
 * AgentDrilldownBadge — global header badge that surfaces the active agent
 * drill-down filter. Click ✕ to clear (also navigates Traces back to "all"
 * when currently on that page).
 */
import { Filter, X } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAgentDrilldownStore } from '@/stores/agentDrilldownStore';

export function AgentDrilldownBadge() {
  const { agentId, agentName, clearDrilldown } = useAgentDrilldownStore();
  const navigate = useNavigate();
  const location = useLocation();

  if (!agentId) return null;

  const label = agentName ?? `${agentId.slice(0, 8)}…`;

  const handleClear = () => {
    clearDrilldown();
    toast.success('Filtro de agente removido');
    // If user is on Traces, navigate to the unfiltered view so the page reflects the change.
    if (location.pathname.startsWith('/traces')) {
      navigate('/traces', { replace: true });
    }
  };

  const handleClick = () => {
    if (!location.pathname.startsWith('/traces')) {
      navigate(`/traces?agent_id=${agentId}`);
    }
  };

  return (
    <div
      className="hidden sm:flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/30 pl-2 pr-1 py-0.5 text-xs animate-fade-in-up"
      role="status"
      aria-label={`Filtro de agente ativo: ${label}`}
    >
      <Filter className="h-3 w-3 text-primary shrink-0" aria-hidden />
      <button
        type="button"
        onClick={handleClick}
        className="font-medium text-foreground hover:text-primary transition-colors max-w-[140px] truncate focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
        title={location.pathname.startsWith('/traces') ? label : `Ir para Traces filtrado por ${label}`}
      >
        {label}
      </button>
      <button
        type="button"
        onClick={handleClear}
        className="h-4 w-4 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring transition-colors"
        aria-label="Remover filtro de agente"
        title="Remover filtro"
      >
        <X className="h-2.5 w-2.5" />
      </button>
    </div>
  );
}
