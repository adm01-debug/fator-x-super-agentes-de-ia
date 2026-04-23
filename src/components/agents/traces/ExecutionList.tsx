import type { ReactNode } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Activity, AlertTriangle, CheckCircle2, Clock, DollarSign, Filter, Inbox, Play, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/EmptyState';
import type { ExecutionGroup } from '@/services/agentTracesService';

interface Props {
  executions: ExecutionGroup[];
  selectedId: string | null;
  onSelect: (e: ExecutionGroup) => void;
  onReplay?: (e: ExecutionGroup) => void;
  loading: boolean;
  hasActiveFilters?: boolean;
  onClearFilters?: () => void;
  /** Optional renderer that wraps the "Limpar filtros" button (e.g. ConfirmDialog). */
  clearFiltersWrapper?: (button: ReactNode) => ReactNode;
}

export function ExecutionList({ executions, selectedId, onSelect, onReplay, loading, hasActiveFilters, onClearFilters, clearFiltersWrapper }: Props) {
  if (loading) {
    return (
      <div className="p-3 space-y-2" aria-busy="true" aria-label="Carregando execuções">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" style={{ animationDelay: `${i * 60}ms` }} />
        ))}
      </div>
    );
  }
  if (executions.length === 0) {
    if (!hasActiveFilters) {
      return (
        <EmptyState
          icon={Inbox}
          illustration="data"
          title="Sem traces ainda"
          description="Quando seus agentes começarem a executar, as sessões aparecerão aqui em tempo real."
        />
      );
    }
    const button = onClearFilters ? (
      <Button onClick={onClearFilters} size="sm" className="gap-1.5">Limpar filtros</Button>
    ) : null;
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up" role="status">
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center border border-primary/10" aria-hidden>
            <span className="text-3xl">🔍</span>
          </div>
          <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
        <h3 className="text-lg font-heading font-semibold text-foreground mb-1.5">Nenhuma execução para esses filtros</h3>
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
          Ajuste o nível, evento, agente ou janela temporal para ampliar a busca.
        </p>
        {button && (
          <div className="mt-5">
            {clearFiltersWrapper ? clearFiltersWrapper(button) : button}
          </div>
        )}
      </div>
    );
  }

  return (
    <ScrollArea className="h-[640px]">
      <ul className="divide-y divide-border/40" role="listbox" aria-label="Execuções">
        {executions.map((e) => {
          const active = selectedId === e.session_id;
          const dotColor =
            e.counts.error > 0 ? 'bg-destructive' :
            e.counts.warning > 0 ? 'bg-nexus-amber' : 'bg-nexus-emerald';
          return (
            <li key={e.session_id} className="relative group">
              <button
                onClick={() => onSelect(e)}
                aria-selected={active}
                role="option"
                className={`w-full text-left p-3 transition-colors hover:bg-muted/40 ${
                  active ? 'bg-primary/8 border-l-2 border-l-primary' : 'border-l-2 border-l-transparent'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${dotColor}`} aria-hidden />
                    <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[200px]">
                      {e.session_id.startsWith('auto-') ? '∅ sem session' : e.session_id.slice(0, 18)}
                    </span>
                  </div>
                  <span className={`text-[10px] text-muted-foreground shrink-0 ${onReplay ? 'mr-16' : ''}`}>
                    {new Date(e.started_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1"><Activity className="h-2.5 w-2.5" />{e.traces.length}</span>
                  <span className="flex items-center gap-1 text-nexus-emerald"><CheckCircle2 className="h-2.5 w-2.5" />{e.counts.info}</span>
                  {e.counts.warning > 0 && (
                    <span className="flex items-center gap-1 text-nexus-amber"><AlertTriangle className="h-2.5 w-2.5" />{e.counts.warning}</span>
                  )}
                  {e.counts.error > 0 && (
                    <span className="flex items-center gap-1 text-destructive"><XCircle className="h-2.5 w-2.5" />{e.counts.error}</span>
                  )}
                  <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{e.total_ms}ms</span>
                  {e.total_cost > 0 && (
                    <span className="flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" />${e.total_cost.toFixed(4)}</span>
                  )}
                </div>
              </button>
              {onReplay && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(ev) => { ev.stopPropagation(); onSelect(e); onReplay(e); }}
                  className="absolute top-2 right-2 h-6 px-2 text-[10px] gap-1 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-primary/10 hover:bg-primary/20 text-primary"
                  aria-label={`Replay da execução ${e.session_id}`}
                  title="Reproduzir esta execução passo a passo"
                >
                  <Play className="h-2.5 w-2.5" /> Replay
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </ScrollArea>
  );
}
