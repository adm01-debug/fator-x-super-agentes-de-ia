/**
 * RunFilter — seletor de execução (sessão) com autocomplete + "Top runs".
 *
 * Filtra a timeline pelo período (min..max created_at) de uma sessão do agente.
 * O range absoluto resultante (`time:abs:from~to`) reaproveita toda a infra de
 * filtro temporal já existente — deep-link, share, presets continuam funcionando.
 *
 * UX: cmdk com busca por session_id/evento + agrupamentos curados:
 *   • Mais recentes  — debug do "que aconteceu agora"
 *   • Mais lentos    — investigação de performance
 *   • Com erros      — root cause em runs que quebraram
 *
 * Trade-off: filtramos por *período*, não por "versões usadas" naquela run.
 * Versões raramente mudam dentro de um run, então o período é o proxy correto.
 */
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, Loader2, X, ChevronDown, Clock, AlertTriangle, Zap, SearchX, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import type { TimelineRange } from './TimelineRangeFilter';

interface RunSummary {
  session_id: string;
  start_at: string;
  end_at: string;
  duration_ms: number;
  event_count: number;
  error_count: number;
  /** primeiro evento — útil para rotular a execução com algo legível. */
  first_event: string | null;
  /** união dos eventos distintos da run, para alimentar a busca. */
  events: string[];
}

interface Props {
  agentId: string;
  /** Range atual aplicado à timeline — usado para detectar qual execução está ativa. */
  currentRange: TimelineRange;
  /** session_id atualmente fixado via URL (?run=) — tem prioridade sobre matching por janela. */
  activeRunId?: string | null;
  /** Callback que aplica o range temporal da execução escolhida. */
  onApply: (range: TimelineRange, runId: string | null) => void;
}

/** Limites curados para "Top runs" — evitam listas longas e ruidosas. */
const TOP_LIMIT = 5;

/**
 * Busca as últimas execuções (sessões) do agente. Limitamos a 300 traces
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
        .select('session_id, created_at, event, level')
        .eq('agent_id', agentId)
        .not('session_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(300);
      if (error) throw error;
      const bySession = new Map<string, RunSummary & { _events: Set<string> }>();
      for (const row of (data ?? []) as Array<{
        session_id: string | null; created_at: string; event: string; level: string | null;
      }>) {
        if (!row.session_id) continue;
        const existing = bySession.get(row.session_id);
        const isError = row.level === 'error';
        if (!existing) {
          const evSet = new Set<string>([row.event]);
          bySession.set(row.session_id, {
            session_id: row.session_id,
            start_at: row.created_at,
            end_at: row.created_at,
            duration_ms: 0,
            event_count: 1,
            error_count: isError ? 1 : 0,
            first_event: row.event,
            events: [row.event],
            _events: evSet,
          });
        } else {
          existing.event_count += 1;
          if (isError) existing.error_count += 1;
          existing._events.add(row.event);
          if (new Date(row.created_at) < new Date(existing.start_at)) {
            existing.start_at = row.created_at;
            existing.first_event = row.event;
          }
          if (new Date(row.created_at) > new Date(existing.end_at)) {
            existing.end_at = row.created_at;
          }
        }
      }
      // Materializa events array + duration e ordena por mais recente.
      const out: RunSummary[] = [];
      for (const r of bySession.values()) {
        out.push({
          session_id: r.session_id,
          start_at: r.start_at,
          end_at: r.end_at,
          duration_ms: new Date(r.end_at).getTime() - new Date(r.start_at).getTime(),
          event_count: r.event_count,
          error_count: r.error_count,
          first_event: r.first_event,
          events: Array.from(r._events),
        });
      }
      return out.sort((a, b) => +new Date(b.end_at) - +new Date(a.end_at));
    },
  });
}

function formatDuration(ms: number): string {
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

interface RunRowProps {
  run: RunSummary;
  isActive: boolean;
  onPick: (run: RunSummary) => void;
  /** Métrica destacada na linha: padrão = quando, mas "slow"/"errors" trocam. */
  highlight?: 'time' | 'slow' | 'errors';
}

/**
 * Linha de execução. Usa `value` único (session_id + métrica) para o cmdk
 * conseguir filtrar e desambiguar a mesma run aparecendo em múltiplos grupos.
 */
function RunRow({ run, isActive, onPick, highlight = 'time' }: RunRowProps) {
  const value = `${run.session_id} ${run.events.join(' ')}`;
  return (
    <CommandItem
      value={value}
      onSelect={() => onPick(run)}
      className={`flex flex-col items-stretch gap-0.5 cursor-pointer ${
        isActive ? 'bg-nexus-emerald/10 border-l-2 border-nexus-emerald' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2 w-full">
        <span className="text-[11px] font-mono font-semibold text-foreground truncate">
          {run.session_id}
        </span>
        <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1.5">
          {highlight === 'slow' && (
            <span className="text-nexus-amber font-semibold">{formatDuration(run.duration_ms)}</span>
          )}
          {highlight === 'errors' && run.error_count > 0 && (
            <span className="text-destructive font-semibold">{run.error_count} erros</span>
          )}
          <span>{run.event_count} ev</span>
          {highlight !== 'slow' && <span>· {formatDuration(run.duration_ms)}</span>}
        </span>
      </div>
      <div className="text-[10px] text-muted-foreground truncate">
        {formatWhen(run.start_at)}
        {run.first_event ? <> · primeiro: <span className="font-mono">{run.first_event}</span></> : null}
      </div>
    </CommandItem>
  );
}

export function RunFilter({ agentId, currentRange, activeRunId, onApply }: Props) {
  const [open, setOpen] = useState(false);
  const { data: runs = [], isLoading } = useAgentRuns(agentId);
  // Prioridade: ?run= explícito > matching por janela temporal. Assim o link
  // "Run abc123" continua válido mesmo se outro range absoluto coincidir.
  const activeRun = useMemo(() => {
    if (activeRunId) {
      const byId = runs.find((r) => r.session_id === activeRunId);
      if (byId) return byId;
    }
    return findActiveRun(runs, currentRange);
  }, [runs, currentRange, activeRunId]);

  // Top runs derivados — ordenamos cópias para não mutar a lista base
  // (que está em ordem cronológica reversa, usada na seção "Recentes").
  const topSlow = useMemo(
    () => [...runs].sort((a, b) => b.duration_ms - a.duration_ms).slice(0, TOP_LIMIT),
    [runs],
  );
  const topErrors = useMemo(
    () => runs.filter((r) => r.error_count > 0)
      .sort((a, b) => b.error_count - a.error_count)
      .slice(0, TOP_LIMIT),
    [runs],
  );
  const recent = useMemo(() => runs.slice(0, TOP_LIMIT), [runs]);

  const handlePick = (run: RunSummary) => {
    onApply({
      mode: 'time',
      fromIso: run.start_at,
      toIso: run.end_at,
      lastMinutes: undefined,
    }, run.session_id);
    setOpen(false);
  };

  const handleClear = () => {
    onApply({ mode: 'off' }, null);
    setOpen(false);
  };

  const triggerLabel = activeRun
    ? `Run ${activeRun.session_id.slice(-6)}`
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
      <PopoverContent align="start" className="w-[380px] p-0">
        <Command
          // Filtro custom: o `value` da CommandItem é "session_id evento1 evento2…",
          // então a busca casa tanto por id quanto por nome de evento.
          filter={(value, search) => {
            if (!search) return 1;
            return value.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput
            placeholder="Buscar por session id ou evento…"
            className="text-xs"
          />
          <CommandList className="max-h-[360px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                <span className="text-[10px]">Carregando execuções…</span>
              </div>
            ) : runs.length === 0 ? (
              // Estado "agente nunca executou" — diferente de "busca sem match".
              // Damos contexto + próximo passo claro para o usuário não ficar travado.
              <div className="flex flex-col items-center text-center py-8 px-4 gap-2">
                <div className="h-10 w-10 rounded-full bg-secondary/60 flex items-center justify-center">
                  <Inbox className="h-5 w-5 text-muted-foreground" aria-hidden />
                </div>
                <p className="text-[12px] font-semibold text-foreground">
                  Nenhuma execução ainda
                </p>
                <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[260px]">
                  Este agente não tem traces registrados. Rode uma conversa ou
                  acione uma automação para que execuções apareçam aqui.
                </p>
              </div>
            ) : (
              <>
                <CommandEmpty className="py-8">
                  {/* Estado "busca sem match" — só aparece quando há runs mas o
                      input filtra zero resultados. Mostra dica de buscar por
                      session id ou nome de evento. */}
                  <div className="flex flex-col items-center text-center px-4 gap-2">
                    <div className="h-10 w-10 rounded-full bg-secondary/60 flex items-center justify-center">
                      <SearchX className="h-5 w-5 text-muted-foreground" aria-hidden />
                    </div>
                    <p className="text-[12px] font-semibold text-foreground">
                      Nada encontrado
                    </p>
                    <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[260px]">
                      Tente buscar pelos últimos 6 caracteres do session id ou
                      pelo nome de um evento (ex: <span className="font-mono">tool_call</span>).
                    </p>
                  </div>
                </CommandEmpty>

                {topErrors.length > 0 && (
                  <>
                    <CommandGroup
                      heading={
                        <span className="flex items-center gap-1.5 text-destructive">
                          <AlertTriangle className="h-3 w-3" /> Top com erros
                        </span>
                      }
                    >
                      {topErrors.map((run) => (
                        <RunRow
                          key={`err-${run.session_id}`}
                          run={run}
                          isActive={activeRun?.session_id === run.session_id}
                          onPick={handlePick}
                          highlight="errors"
                        />
                      ))}
                    </CommandGroup>
                    <CommandSeparator />
                  </>
                )}

                <CommandGroup
                  heading={
                    <span className="flex items-center gap-1.5 text-nexus-amber">
                      <Zap className="h-3 w-3" /> Top mais lentas
                    </span>
                  }
                >
                  {topSlow.map((run) => (
                    <RunRow
                      key={`slow-${run.session_id}`}
                      run={run}
                      isActive={activeRun?.session_id === run.session_id}
                      onPick={handlePick}
                      highlight="slow"
                    />
                  ))}
                </CommandGroup>
                <CommandSeparator />

                <CommandGroup
                  heading={
                    <span className="flex items-center gap-1.5 text-nexus-cyan">
                      <Clock className="h-3 w-3" /> Mais recentes
                    </span>
                  }
                >
                  {recent.map((run) => (
                    <RunRow
                      key={`rec-${run.session_id}`}
                      run={run}
                      isActive={activeRun?.session_id === run.session_id}
                      onPick={handlePick}
                    />
                  ))}
                </CommandGroup>

                {runs.length > recent.length && (
                  <>
                    <CommandSeparator />
                    <CommandGroup
                      heading={
                        <span className="text-muted-foreground">
                          Todas ({runs.length})
                        </span>
                      }
                    >
                      {runs.slice(recent.length).map((run) => (
                        <RunRow
                          key={`all-${run.session_id}`}
                          run={run}
                          isActive={activeRun?.session_id === run.session_id}
                          onPick={handlePick}
                        />
                      ))}
                    </CommandGroup>
                  </>
                )}
              </>
            )}
          </CommandList>
        </Command>

        {activeRun && (
          <div className="flex items-center justify-between p-2 border-t border-border/50">
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
