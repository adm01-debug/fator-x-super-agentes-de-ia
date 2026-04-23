/**
 * RunFilter — filtra a timeline de versões pelo período de uma execução
 * (sessão) específica do agente.
 *
 * Como cada `agent_traces` tem um `session_id` e um `created_at`, agrupamos as
 * sessões mais recentes do agente e usamos `min(created_at)`/`max(created_at)`
 * como janela temporal. Ao escolher uma execução, aplicamos um range absoluto
 * (`time:abs:from~to`) — assim a timeline já existente filtra normalmente,
 * sem precisar de novo modo de range.
 *
 * Trade-off consciente: filtramos por *período* da execução, não por
 * "versões usadas". Versões raramente mudam dentro de uma execução, então o
 * período é o proxy correto e mantém o resto do sistema (deep-link, share,
 * presets) funcionando sem nenhuma mudança.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Loader2, X, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import type { TimelineRange } from './TimelineRangeFilter';

interface RunSummary {
  session_id: string;
  start_at: string;
  end_at: string;
  event_count: number;
  /** primeiro evento — útil para rotular a execução com algo legível. */
  first_event: string | null;
}

interface Props {
  agentId: string;
  /** Range atual aplicado à timeline — usado para detectar qual execução está ativa. */
  currentRange: TimelineRange;
  /** Callback que aplica o range temporal da execução escolhida. */
  onApply: (range: TimelineRange) => void;
}

/**
 * Busca as últimas execuções (sessões) do agente. Limitamos a 100 traces
 * recentes e agrupamos no client para evitar dependência de RPC dedicada.
 */
function useAgentRuns(agentId: string) {
  return useQuery({
    queryKey: ['agent-runs', agentId],
    enabled: !!agentId,
    staleTime: 30_000,
    queryFn: async (): Promise<RunSummary[]> => {
      const { data, error } = await supabaseExternal
        .from('agent_traces')
        .select('session_id, created_at, event')
        .eq('agent_id', agentId)
        .not('session_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      const bySession = new Map<string, RunSummary>();
      for (const row of (data ?? []) as Array<{ session_id: string | null; created_at: string; event: string }>) {
        if (!row.session_id) continue;
        const existing = bySession.get(row.session_id);
        if (!existing) {
          bySession.set(row.session_id, {
            session_id: row.session_id,
            start_at: row.created_at,
            end_at: row.created_at,
            event_count: 1,
            first_event: row.event,
          });
        } else {
          existing.event_count += 1;
          if (new Date(row.created_at) < new Date(existing.start_at)) {
            existing.start_at = row.created_at;
            existing.first_event = row.event;
          }
          if (new Date(row.created_at) > new Date(existing.end_at)) {
            existing.end_at = row.created_at;
          }
        }
      }
      return Array.from(bySession.values()).sort(
        (a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime(),
      );
    },
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}min`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

/** Sessão cujo intervalo absoluto bate com o range atual (se houver). */
function findActiveRun(runs: RunSummary[], range: TimelineRange): RunSummary | null {
  if (range.mode !== 'time' || !range.fromIso || !range.toIso) return null;
  return runs.find(
    (r) => r.start_at === range.fromIso && r.end_at === range.toIso,
  ) ?? null;
}

export function RunFilter({ agentId, currentRange, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const { data: runs = [], isLoading } = useAgentRuns(agentId);
  const activeRun = useMemo(() => findActiveRun(runs, currentRange), [runs, currentRange]);

  const handlePick = (run: RunSummary) => {
    onApply({
      mode: 'time',
      fromIso: run.start_at,
      toIso: run.end_at,
      lastMinutes: undefined,
    });
    setOpen(false);
  };

  const handleClear = () => {
    onApply({ mode: 'off' });
    setOpen(false);
  };

  const triggerLabel = activeRun
    ? `Execução ${activeRun.session_id.slice(-6)}`
    : 'Execução';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={activeRun ? 'default' : 'ghost'}
          className={`h-6 px-2 text-[11px] gap-1 ${
            activeRun
              ? 'bg-nexus-emerald/15 text-nexus-emerald hover:bg-nexus-emerald/25 border border-nexus-emerald/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
          aria-pressed={!!activeRun}
          title="Filtrar pela janela temporal de uma execução do agente"
        >
          <Activity className="h-3 w-3" aria-hidden />
          {triggerLabel}
          {activeRun ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpar filtro de execução"
              className="ml-0.5 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  handleClear();
                }
              }}
            >
              <X className="h-2.5 w-2.5" aria-hidden />
            </span>
          ) : (
            <ChevronDown className="h-2.5 w-2.5 opacity-60" aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[360px] p-2">
        <div className="px-1.5 py-1 mb-1.5 border-b border-border/50">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Execuções recentes
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Aplica como janela temporal — versões fora desse período somem da timeline.
          </p>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          </div>
        ) : runs.length === 0 ? (
          <div className="py-6 text-center text-[11px] text-muted-foreground">
            Nenhuma execução registrada para este agente ainda.
          </div>
        ) : (
          <div className="max-h-[280px] overflow-y-auto space-y-0.5">
            {runs.map((run) => {
              const isActive = activeRun?.session_id === run.session_id;
              return (
                <button
                  key={run.session_id}
                  type="button"
                  onClick={() => handlePick(run)}
                  className={`w-full text-left rounded px-2 py-1.5 transition-colors ${
                    isActive
                      ? 'bg-nexus-emerald/15 border border-nexus-emerald/40'
                      : 'hover:bg-secondary/60 border border-transparent'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-mono font-semibold text-foreground truncate">
                      {run.session_id}
                    </span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {run.event_count} ev · {formatDuration(run.start_at, run.end_at)}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                    {formatWhen(run.start_at)}
                    {run.first_event ? <> · primeiro: <span className="font-mono">{run.first_event}</span></> : null}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {activeRun && (
          <div className="flex items-center justify-between pt-2 mt-1.5 border-t border-border/50">
            <span className="text-[10px] text-muted-foreground truncate">
              Janela: {formatWhen(activeRun.start_at)} → {formatWhen(activeRun.end_at)}
            </span>
            <Button
              type="button" size="sm" variant="ghost"
              className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={handleClear}
            >
              Limpar
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
