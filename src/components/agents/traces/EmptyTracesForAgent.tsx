/**
 * EmptyTracesForAgent — contextual empty state shown when the trace explorer
 * is filtered to a single agent that returned zero executions in the active
 * window. Surfaces concrete one-click suggestions (widen window, drop
 * level/event filters, remove agent filter) instead of a generic "no results".
 */
import { ArrowRight, CalendarClock, ListFilter, Tag, UserX } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type SuggestionAction =
  | { type: 'widen-window'; toHours: number; label: string }
  | { type: 'clear-level' }
  | { type: 'clear-event' }
  | { type: 'remove-agent' };

export interface Suggestion {
  /** What we recommend the user to do, in plain Portuguese. */
  label: string;
  /** Short rationale shown under the action. */
  helper: string;
  /** Icon component (lucide-react). */
  icon: React.ComponentType<{ className?: string }>;
  /** Action descriptor consumed by the page-level handler. */
  action: SuggestionAction;
}

interface Props {
  /** Display name of the agent currently filtered (falls back to id snippet). */
  agentName: string;
  /** Current window in hours — used to suggest a wider one. */
  currentHours: number;
  /** Whether a level filter is currently active (info/warning/error). */
  hasLevelFilter: boolean;
  /** Whether a specific event is currently filtered. */
  hasEventFilter: boolean;
  /** Whether an absolute time window is locked (deep-link). When true we
   *  cannot widen the relative window — we suggest releasing the lock instead. */
  hasAbsoluteWindow: boolean;
  /** Callback fired when the user clicks a suggestion. */
  onApply: (action: SuggestionAction) => void;
  /** Callback to release the absolute window override (deep-link). */
  onReleaseWindow?: () => void;
}

/** Picks the next sensible window size given the current one. */
function nextWindow(currentHours: number): { toHours: number; label: string } | null {
  if (currentHours < 24) return { toHours: 24, label: 'últimas 24 h' };
  if (currentHours < 24 * 7) return { toHours: 24 * 7, label: 'últimos 7 dias' };
  if (currentHours < 24 * 30) return { toHours: 24 * 30, label: 'últimos 30 dias' };
  return null;
}

export function EmptyTracesForAgent({
  agentName,
  currentHours,
  hasLevelFilter,
  hasEventFilter,
  hasAbsoluteWindow,
  onApply,
  onReleaseWindow,
}: Props) {
  // Build suggestions in priority order — most likely to surface results first.
  const suggestions: Suggestion[] = [];

  if (!hasAbsoluteWindow) {
    const wider = nextWindow(currentHours);
    if (wider) {
      suggestions.push({
        label: `Ampliar janela para ${wider.label}`,
        helper: 'Pode haver execuções fora do intervalo atual.',
        icon: CalendarClock,
        action: { type: 'widen-window', toHours: wider.toHours, label: wider.label },
      });
    }
  }

  if (hasLevelFilter) {
    suggestions.push({
      label: 'Limpar filtro de nível',
      helper: 'Mostrar info, warning e error juntos.',
      icon: ListFilter,
      action: { type: 'clear-level' },
    });
  }

  if (hasEventFilter) {
    suggestions.push({
      label: 'Limpar filtro de evento',
      helper: 'Considerar todos os tipos de evento.',
      icon: Tag,
      action: { type: 'clear-event' },
    });
  }

  // Removing the agent filter is always the last resort — it fundamentally
  // changes scope, so we keep it visually separated below.
  const removeAgent: Suggestion = {
    label: `Remover filtro do agente`,
    helper: 'Ver execuções de todos os agentes.',
    icon: UserX,
    action: { type: 'remove-agent' },
  };

  return (
    <div
      className="flex flex-col items-center justify-center py-12 px-6 text-center animate-fade-in-up"
      role="status"
      aria-live="polite"
    >
      {/* Illustration: agent silhouette with empty inbox cue */}
      <div className="relative mb-5">
        <div
          className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-primary/15 flex items-center justify-center shadow-sm"
          aria-hidden
        >
          <span className="text-3xl">📭</span>
        </div>
        <div
          className="absolute -bottom-1 -right-1 h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm"
          aria-hidden
        >
          <UserX className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <h3 className="text-base font-heading font-semibold text-foreground mb-1.5">
        Sem traces para <span className="text-primary">{agentName}</span>
      </h3>
      <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
        {hasAbsoluteWindow
          ? 'A janela de tempo deep-linkada não retornou execuções. Tente liberá-la ou aplique uma sugestão abaixo.'
          : 'Nenhuma execução encontrada para os filtros atuais. Experimente uma das sugestões:'}
      </p>

      {hasAbsoluteWindow && onReleaseWindow && (
        <Button
          size="sm"
          variant="outline"
          className="mt-4 h-8 text-xs gap-1.5"
          onClick={onReleaseWindow}
        >
          <CalendarClock className="h-3.5 w-3.5" aria-hidden />
          Liberar janela de tempo
        </Button>
      )}

      {suggestions.length > 0 && (
        <ul className="mt-5 w-full max-w-md space-y-1.5">
          {suggestions.map((s) => {
            const Icon = s.icon;
            return (
              <li key={s.label}>
                <button
                  type="button"
                  onClick={() => onApply(s.action)}
                  className="group w-full flex items-start gap-3 text-left rounded-lg border border-border/60 bg-card/40 hover:border-primary/40 hover:bg-primary/5 transition-colors px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="h-7 w-7 rounded-md bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    <Icon className="h-3.5 w-3.5 text-primary" aria-hidden />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground group-hover:text-primary transition-colors">
                      {s.label}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">
                      {s.helper}
                    </p>
                  </div>
                  <ArrowRight
                    className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1"
                    aria-hidden
                  />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {/* Last-resort: remove the agent filter — visually separated */}
      <div className="mt-4 pt-4 border-t border-border/30 w-full max-w-md">
        <button
          type="button"
          onClick={() => onApply(removeAgent.action)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded px-2 py-1"
        >
          <UserX className="h-3 w-3" aria-hidden />
          {removeAgent.label}
        </button>
      </div>
    </div>
  );
}
