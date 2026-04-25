import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, CalendarClock, Cloud, CloudOff, DollarSign, Filter, GitCompare, Inbox, Loader2, Play, RefreshCw, X, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/shared/EmptyState';
import { useDebounce } from '@/hooks/use-debounce';
import { useFilterPersistence } from '@/hooks/useFilterPersistence';
import {
  listAgentTraces, listAvailableEvents, groupBySession,
  type ExecutionGroup, type TraceLevel,
} from '@/services/agentTracesService';
import { listAgentSummaries, getAgentById, type AgentSummary } from '@/services/agentsService';
import { TracesFilters } from '@/components/agents/traces/TracesFilters';
import { ExecutionList } from '@/components/agents/traces/ExecutionList';
import { ExecutionTimeline } from '@/components/agents/traces/ExecutionTimeline';
import { ReplayDialog } from '@/components/agents/traces/ReplayDialog';
import { ClearFiltersToast, type ClearedField } from '@/components/agents/traces/ClearFiltersToast';
import { ClearFiltersConfirm } from '@/components/agents/traces/ClearFiltersConfirm';
import { CompareTracesSheet } from '@/components/agents/traces/CompareTracesSheet';
import { useAgentDrilldownStore } from '@/stores/agentDrilldownStore';

interface PersistedFilters extends Record<string, unknown> {
  search: string;
  level: TraceLevel | 'all';
  event: string;
  agentFilter: string;
  sinceHours: number;
}

const STORAGE_KEY = 'nexus.traces.filters';

const RANGE_LABEL: Record<number, string> = {
  1: 'Última hora', 24: 'Últimas 24h', 168: 'Últimos 7 dias', 720: 'Últimos 30 dias', 0: 'Tudo',
};

/** UUID v4 sanity check — keeps malformed `?agent_id=` values out of state. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function AgentTracesPage() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const drilldown = useAgentDrilldownStore();

  // Drill-down deep-link: SLO Dashboard (and other pages) link here with
  // `?agent_id=<uuid>` to pre-select the agent. We only honour valid UUIDs
  // so a tampered URL can't pollute persisted filters.
  const urlAgentId = (() => {
    const raw = searchParams.get('agent_id');
    return raw && UUID_RE.test(raw.trim()) ? raw.trim() : null;
  })();

  // Session-scoped drill-down filter — survives navigation between related
  // pages within the same tab. Captured once at mount so React Query cache
  // keys stay stable across renders.
  const initialDrilldownAgentId = useRef(drilldown.agentId).current;

  const defaults = useMemo<PersistedFilters>(() => ({
    search: '', level: 'all', event: 'all',
    // Priority: route param `:id` > `?agent_id=` deep-link > session drill-down > 'all'
    agentFilter: id ?? urlAgentId ?? initialDrilldownAgentId ?? 'all',
    sinceHours: 24,
  }), [id, urlAgentId, initialDrilldownAgentId]);

  const { filters, setFilters, syncStatus, clearAll, restore } = useFilterPersistence<PersistedFilters>({
    scope: 'agent_traces', defaults, storageKey: STORAGE_KEY,
  });
  const { search, level, event, agentFilter, sinceHours } = filters;

  // URL is the source of truth on load; localStorage is the fallback.
  const urlSession = searchParams.get('session');
  const urlStep = (() => {
    const raw = searchParams.get('step');
    if (raw == null) return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null;
  })();

  // Absolute time window deep-link (e.g. SLO drill-down on a 1h bucket).
  // Only ISO strings that parse to a valid Date are honoured; from must be < to.
  const parsedWindow = useMemo(() => {
    const fromRaw = searchParams.get('from');
    const toRaw = searchParams.get('to');
    if (!fromRaw || !toRaw) return null;
    const fromMs = Date.parse(fromRaw);
    const toMs = Date.parse(toRaw);
    if (!Number.isFinite(fromMs) || !Number.isFinite(toMs) || fromMs >= toMs) return null;
    return { from: new Date(fromMs).toISOString(), to: new Date(toMs).toISOString() };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [windowOverride, setWindowOverride] = useState<{ from: string; to: string } | null>(parsedWindow);

  const [selectedId, setSelectedId] = useState<string | null>(urlSession);
  const [selectedStep, setSelectedStep] = useState(urlStep ?? 0);
  const [replayOpen, setReplayOpen] = useState(false);

  // Compare mode: when active, the explorer shows checkboxes and the user
  // picks two executions to diff side-by-side. Auto-opens the sheet when 2
  // are picked; resets when sheet closes or compare mode is turned off.
  const [compareMode, setCompareMode] = useState(false);
  const [comparePicks, setComparePicks] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  // Undo snapshot (5s window). Stored in ref so changes don't re-render.
  const undoSnapshot = useRef<PersistedFilters | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Per-session step memory (unchanged behaviour).
  const STEP_STORAGE_KEY = 'nexus.traces.lastStepBySession';
  const readStepMap = (): Record<string, number> => {
    try {
      const raw = localStorage.getItem(STEP_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as Record<string, number>) : {};
    } catch { return {}; }
  };
  const writeStepMap = (map: Record<string, number>) => {
    try {
      const entries = Object.entries(map).slice(-50);
      localStorage.setItem(STEP_STORAGE_KEY, JSON.stringify(Object.fromEntries(entries)));
    } catch { /* ignore */ }
  };

  const effectiveAgentId = agentFilter === 'all' ? undefined : agentFilter;

  const { data: agent } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => getAgentById(id!),
    enabled: !!id,
  });

  const { data: agents = [] } = useQuery({
    queryKey: ['agent-summaries-traces'],
    queryFn: () => listAgentSummaries(100),
  });

  // Apply `?agent_id=` deep-link once after mount: override the persisted
  // agent filter, push it to the session-scoped drilldown store (so it
  // survives navigation between related pages within the tab), surface a
  // toast confirming which agent was matched, then strip the param.
  const appliedAgentParam = useRef<string | null>(null);
  useEffect(() => {
    if (!urlAgentId || appliedAgentParam.current === urlAgentId) return;
    if (filters.agentFilter !== urlAgentId) {
      setFilters((prev) => ({ ...prev, agentFilter: urlAgentId }));
      const matched = agents.find((a) => a.id === urlAgentId);
      drilldown.setDrilldown(urlAgentId, matched?.name ?? null, 'deep-link');
      toast.success(matched ? `Filtrando por: ${matched.name}` : 'Filtro de agente aplicado via link');
    }
    appliedAgentParam.current = urlAgentId;
    const next = new URLSearchParams(searchParams);
    next.delete('agent_id');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlAgentId, agents]);

  // Keep the global drilldown store in sync with manual filter changes:
  // selecting a specific agent in the dropdown promotes it to "active drill",
  // selecting "todos" releases the drill (so the badge disappears across pages).
  // We skip this when on a route-pinned agent (`/agents/:id/traces`) so the
  // route param doesn't accidentally hijack a different drill context.
  useEffect(() => {
    if (id) return; // route param wins, don't propagate
    if (agentFilter === 'all') {
      if (drilldown.agentId !== null) drilldown.clearDrilldown();
      return;
    }
    if (drilldown.agentId !== agentFilter) {
      const matched = agents.find((a) => a.id === agentFilter);
      drilldown.setDrilldown(agentFilter, matched?.name ?? null, 'manual');
    } else if (!drilldown.agentName) {
      // Backfill the cached name once agents finish loading.
      const matched = agents.find((a) => a.id === agentFilter);
      if (matched) drilldown.setDrilldown(agentFilter, matched.name, drilldown.origin ?? 'manual');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentFilter, agents, id]);

  // External clears (badge ✕ in another page or this one) should pull the
  // local filter back to 'all' so the page reflects reality immediately.
  useEffect(() => {
    if (id) return;
    if (drilldown.agentId === null && agentFilter !== 'all') {
      setFilters((prev) => ({ ...prev, agentFilter: 'all' }));
      setSelectedId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drilldown.agentId, id]);

  // Apply `?from=&to=` deep-link once: surface a toast confirming the bucket
  // window and strip the params so manual filter changes aren't shadowed by them.
  const appliedWindowParam = useRef(false);
  useEffect(() => {
    if (appliedWindowParam.current || !parsedWindow) return;
    appliedWindowParam.current = true;
    const fmt = (iso: string) => new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
    });
    toast.success(`Janela aplicada: ${fmt(parsedWindow.from)} → ${fmt(parsedWindow.to)}`);
    const next = new URLSearchParams(searchParams);
    next.delete('from');
    next.delete('to');
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsedWindow]);

  const { data: events = [] } = useQuery({
    queryKey: ['agent-trace-events', effectiveAgentId],
    queryFn: () => listAvailableEvents(effectiveAgentId),
  });

  const { data: traces = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['agent-traces', effectiveAgentId, level, event, debouncedSearch, sinceHours, windowOverride?.from, windowOverride?.to],
    queryFn: () => listAgentTraces({
      agentId: effectiveAgentId,
      level,
      event,
      search: debouncedSearch,
      // Absolute window wins over `sinceHours` when present.
      sinceHours: windowOverride ? 0 : sinceHours,
      from: windowOverride?.from,
      to: windowOverride?.to,
      limit: 500,
    }),
    staleTime: 30_000,
  });

  const executions = useMemo(() => groupBySession(traces), [traces]);
  const selected: ExecutionGroup | null = useMemo(
    () => executions.find((e) => e.session_id === selectedId) ?? executions[0] ?? null,
    [executions, selectedId],
  );

  // Auto-open compare sheet when 2 picks are accumulated.
  useEffect(() => {
    if (compareMode && comparePicks.length === 2) setCompareOpen(true);
  }, [compareMode, comparePicks]);

  const compareA = useMemo(
    () => executions.find((e) => e.session_id === comparePicks[0]) ?? null,
    [executions, comparePicks],
  );
  const compareB = useMemo(
    () => executions.find((e) => e.session_id === comparePicks[1]) ?? null,
    [executions, comparePicks],
  );

  const toggleCompare = (e: ExecutionGroup) => {
    setComparePicks((prev) => {
      if (prev.includes(e.session_id)) return prev.filter((x) => x !== e.session_id);
      if (prev.length >= 2) return prev; // capped — UI also disables the row
      return [...prev, e.session_id];
    });
  };

  const exitCompareMode = () => {
    setCompareMode(false);
    setComparePicks([]);
    setCompareOpen(false);
  };

  const effectiveSessionId = selected?.session_id ?? null;
  const effectiveTotal = selected?.traces.length ?? 0;
  const [consumedUrlStepFor, setConsumedUrlStepFor] = useState<string | null>(null);

  useEffect(() => {
    if (!effectiveSessionId) { setSelectedStep(0); return; }
    let target: number;
    if (urlStep != null && consumedUrlStepFor !== effectiveSessionId) {
      target = urlStep;
      setConsumedUrlStepFor(effectiveSessionId);
    } else {
      const map = readStepMap();
      target = map[effectiveSessionId] ?? 0;
    }
    setSelectedStep(Math.max(0, Math.min(target, Math.max(0, effectiveTotal - 1))));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveSessionId, effectiveTotal]);

  useEffect(() => {
    if (!effectiveSessionId) return;
    const map = readStepMap();
    if (map[effectiveSessionId] !== selectedStep) {
      map[effectiveSessionId] = selectedStep;
      writeStepMap(map);
    }
    const next = new URLSearchParams(searchParams);
    if (next.get('session') !== effectiveSessionId) next.set('session', effectiveSessionId);
    if (next.get('step') !== String(selectedStep)) next.set('step', String(selectedStep));
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
  }, [effectiveSessionId, selectedStep, searchParams, setSearchParams]);

  const totals = useMemo(() => {
    const errors = traces.filter((t) => t.level === 'error').length;
    const cost = traces.reduce((s, t) => s + Number(t.cost_usd ?? 0), 0);
    return { execs: executions.length, traces: traces.length, errors, cost };
  }, [traces, executions]);

  const hasActiveFilters =
    debouncedSearch.trim() !== '' ||
    level !== 'all' ||
    event !== 'all' ||
    (id ? agentFilter !== id : agentFilter !== 'all') ||
    sinceHours !== 24;

  const agentNameById = (aid: string) =>
    agents.find((a: AgentSummary) => a.id === aid)?.name ?? aid.slice(0, 8);

  /** Build human-readable diff of which fields changed back to defaults. */
  const buildClearedFields = (snap: PersistedFilters): ClearedField[] => {
    const out: ClearedField[] = [];
    if (snap.search.trim() !== '') {
      out.push({ label: 'Busca', from: `"${snap.search}"`, to: 'vazio' });
    }
    if (snap.level !== 'all') {
      out.push({ label: 'Nível', from: snap.level, to: 'todos' });
    }
    if (snap.event !== 'all') {
      out.push({ label: 'Evento', from: snap.event, to: 'todos' });
    }
    const defaultAgent = id ?? 'all';
    if (snap.agentFilter !== defaultAgent) {
      out.push({
        label: 'Agente',
        from: snap.agentFilter === 'all' ? 'todos' : agentNameById(snap.agentFilter),
        to: defaultAgent === 'all' ? 'todos' : agentNameById(defaultAgent),
      });
    }
    if (snap.sinceHours !== 24) {
      out.push({
        label: 'Janela',
        from: RANGE_LABEL[snap.sinceHours] ?? `${snap.sinceHours}h`,
        to: 'Últimas 24h',
      });
    }
    return out;
  };

  /** Active filters list for the confirmation modal. */
  const activeFiltersForModal = useMemo(() => {
    const out: Array<{ label: string; value: string }> = [];
    if (search.trim()) out.push({ label: 'Busca', value: `"${search}"` });
    if (level !== 'all') out.push({ label: 'Nível', value: level });
    if (event !== 'all') out.push({ label: 'Evento', value: event });
    const defaultAgent = id ?? 'all';
    if (agentFilter !== defaultAgent) {
      out.push({ label: 'Agente', value: agentFilter === 'all' ? 'todos' : agentNameById(agentFilter) });
    }
    if (sinceHours !== 24) out.push({ label: 'Janela', value: RANGE_LABEL[sinceHours] ?? `${sinceHours}h` });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, level, event, agentFilter, sinceHours, id, agents]);

  const handleClearFilters = () => {
    // Snapshot current filters BEFORE reset for undo.
    const snapshot: PersistedFilters = { search, level, event, agentFilter, sinceHours };
    const cleared = buildClearedFields(snapshot);
    undoSnapshot.current = snapshot;

    // Inspeciona o localStorage ANTES do clear: só listamos chaves que
    // realmente existiam, evitando dizer ao usuário que removemos algo
    // que nunca esteve lá. STEP_STORAGE_KEY é estado de UI (último passo
    // por sessão) e fica preservado intencionalmente — não é filtro.
    const removedKeys: string[] = [];
    try {
      if (localStorage.getItem(STORAGE_KEY) !== null) removedKeys.push(STORAGE_KEY);
    } catch {
      /* localStorage indisponível (modo privado) — ignora. */
    }

    // Reset state + Cloud + localStorage
    clearAll();
    drilldown.clearDrilldown();
    setSelectedId(null);

    // Custom toast with undo (5s) + grace (2s).
    const toastId = toast.custom((t) => (
      <ClearFiltersToast
        toastId={t}
        cleared={cleared}
        storageKeys={removedKeys}
        onUndo={() => {
          if (undoSnapshot.current) {
            restore(undoSnapshot.current);
            undoSnapshot.current = null;
            toast.success('Filtros restaurados');
          }
        }}
        onClose={() => toast.dismiss(t)}
      />
    ), { duration: 7000 });

    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => {
      undoSnapshot.current = null;
      toast.dismiss(toastId);
    }, 7000);
  };

  // Invalidate undo if user changes any filter manually after clearing.
  useEffect(() => {
    if (!undoSnapshot.current) return;
    const current = { search, level, event, agentFilter, sinceHours };
    const isDefault =
      current.search === defaults.search &&
      current.level === defaults.level &&
      current.event === defaults.event &&
      current.agentFilter === defaults.agentFilter &&
      current.sinceHours === defaults.sinceHours;
    if (!isDefault) {
      undoSnapshot.current = null;
      if (undoTimer.current) { clearTimeout(undoTimer.current); undoTimer.current = null; }
    }
  }, [search, level, event, agentFilter, sinceHours, defaults]);

  const renderClearWrapper = (button: React.ReactNode) => (
    <ClearFiltersConfirm
      trigger={button}
      activeFilters={activeFiltersForModal}
      onConfirm={handleClearFilters}
    />
  );

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-5 max-w-[1500px] mx-auto animate-page-enter">
      <PageHeader
        title={agent ? `Traces de execução — ${agent.name}` : 'Traces de execução'}
        description="Inspecione cada execução agrupada por sessão. Filtre por nível, evento ou agente e reproduza passo a passo."
        backTo={id ? `/agents/${id}` : '/agents'}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant={compareMode ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                if (compareMode) exitCompareMode();
                else { setCompareMode(true); setComparePicks([]); }
              }}
              aria-pressed={compareMode}
              title={compareMode ? 'Sair do modo de comparação' : 'Selecionar 2 execuções para comparar'}
            >
              <GitCompare className="h-3.5 w-3.5 mr-1.5" />
              {compareMode ? 'Cancelar comparação' : 'Comparar'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
            </Button>
          </div>
        }
      />

      <TracesFilters
        search={search} onSearch={(v) => setFilters((p) => ({ ...p, search: v }))}
        level={level} onLevel={(v) => setFilters((p) => ({ ...p, level: v }))}
        event={event} onEvent={(v) => setFilters((p) => ({ ...p, event: v }))}
        agentId={agentFilter}
        onAgent={(v) => { setFilters((p) => ({ ...p, agentFilter: v })); setSelectedId(null); }}
        sinceHours={sinceHours} onSinceHours={(v) => setFilters((p) => ({ ...p, sinceHours: v }))}
        events={events} agents={agents}
      />

      {/* Active absolute window banner (drill-down from SLO bucket / KPI delta) */}
      {windowOverride && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
          <div className="flex items-center gap-2 min-w-0">
            <CalendarClock className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-muted-foreground">Janela ativa:</span>
            <span className="font-medium tabular-nums truncate">
              {new Date(windowOverride.from).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
              {' → '}
              {new Date(windowOverride.to).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
            </span>
            <span className="text-muted-foreground">
              ({Math.max(1, Math.round((Date.parse(windowOverride.to) - Date.parse(windowOverride.from)) / 60000))} min)
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => {
              setWindowOverride(null);
              setSelectedId(null);
              toast.success('Janela removida — voltando ao filtro relativo');
            }}
          >
            <X className="h-3 w-3" /> Limpar janela
          </Button>
        </div>
      )}

      {/* Sync indicator */}
      <div className="flex items-center justify-end -mt-2">
        <SyncBadge status={syncStatus} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Activity} label="Execuções" value={totals.execs.toString()} />
        <Kpi icon={Zap} label="Traces" value={totals.traces.toString()} />
        <Kpi icon={AlertTriangle} label="Erros" value={totals.errors.toString()} accent={totals.errors > 0} />
        <Kpi icon={DollarSign} label="Custo total" value={`$${totals.cost.toFixed(4)}`} />
      </div>

      {/* Compare-mode helper banner */}
      {compareMode && (
        <div
          className="flex items-center justify-between gap-3 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-xs animate-fade-in-up"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 min-w-0">
            <GitCompare className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden />
            <span className="text-foreground/90">
              {comparePicks.length === 0 && 'Selecione 2 execuções na lista para comparar lado a lado.'}
              {comparePicks.length === 1 && 'Selecione mais 1 execução para abrir a comparação.'}
              {comparePicks.length === 2 && 'Comparação pronta — abrindo painel.'}
            </span>
            <span className="text-muted-foreground tabular-nums shrink-0">{comparePicks.length}/2</span>
          </div>
          <div className="flex items-center gap-1">
            {comparePicks.length === 2 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setCompareOpen(true)}>
                Reabrir painel
              </Button>
            )}
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={exitCompareMode}>
              <X className="h-3 w-3 mr-1" /> Sair
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Execuções</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ExecutionList
              executions={executions}
              selectedId={selected?.session_id ?? null}
              onSelect={(e) => setSelectedId(e.session_id)}
              onReplay={(e) => { setSelectedId(e.session_id); setReplayOpen(true); }}
              loading={isLoading}
              hasActiveFilters={hasActiveFilters}
              onClearFilters={handleClearFilters}
              clearFiltersWrapper={renderClearWrapper}
              compareMode={compareMode}
              selectedForCompare={comparePicks}
              onToggleCompare={toggleCompare}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm">Linha do tempo</CardTitle>
            {selected && (
              <Button size="sm" onClick={() => setReplayOpen(true)} className="h-8">
                <Play className="h-3.5 w-3.5 mr-1.5" /> Replay
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {executions.length === 0 ? (
              <div className="h-[560px] flex items-center justify-center">
                {hasActiveFilters ? (
                  <div className="text-center space-y-4">
                    <EmptyState
                      icon={Filter}
                      illustration="search"
                      title="Nenhuma execução para esses filtros"
                      description="Ajuste o nível, evento, agente ou janela temporal para ampliar a busca."
                    />
                    <ClearFiltersConfirm
                      trigger={<Button size="sm">Limpar filtros</Button>}
                      activeFilters={activeFiltersForModal}
                      onConfirm={handleClearFilters}
                    />
                  </div>
                ) : (
                  <EmptyState
                    icon={Inbox}
                    illustration="data"
                    title="Sem traces ainda"
                    description="Quando seus agentes começarem a executar, a linha do tempo aparecerá aqui."
                  />
                )}
              </div>
            ) : !selected ? (
              <div className="h-[560px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <Activity className="h-8 w-8 opacity-40" />
                Selecione uma execução para ver os eventos.
              </div>
            ) : (
              <div className="max-h-[640px] overflow-y-auto pr-2">
                <ExecutionTimeline
                  execution={selected}
                  selectedStep={selectedStep}
                  onSelectStep={(s) => {
                    setSelectedStep(s);
                    setReplayOpen(true);
                  }}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReplayDialog
        open={replayOpen}
        onOpenChange={setReplayOpen}
        execution={selected}
        initialStep={selectedStep}
        onStepChange={setSelectedStep}
      />

      <CompareTracesSheet
        open={compareOpen}
        onOpenChange={(open) => {
          setCompareOpen(open);
          // Closing the sheet keeps picks & compare mode so the user can adjust
          // and reopen via the helper banner — only the explicit "Sair" button
          // exits compare mode entirely.
        }}
        a={compareA}
        b={compareB}
      />
    </div>
  );
}

function SyncBadge({ status }: { status: 'idle' | 'loading' | 'synced' | 'local' | 'saving' }) {
  if (status === 'loading' || status === 'idle') return null;
  const map = {
    synced: { Icon: Cloud, text: 'Sincronizado', cls: 'text-nexus-emerald' },
    local: { Icon: CloudOff, text: 'Salvo localmente', cls: 'text-nexus-amber' },
    saving: { Icon: Loader2, text: 'Salvando...', cls: 'text-muted-foreground' },
  } as const;
  const { Icon, text, cls } = map[status];
  return (
    <span className={`flex items-center gap-1.5 text-[10px] ${cls}`} aria-live="polite">
      <Icon className={`h-3 w-3 ${status === 'saving' ? 'animate-spin' : ''}`} /> {text}
    </span>
  );
}

function Kpi({ icon: Icon, label, value, accent }: {
  icon: React.ComponentType<{ className?: string }>; label: string; value: string; accent?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-3 flex items-center gap-3">
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent ? 'bg-destructive/10 text-destructive' : 'bg-primary/10 text-primary'}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
          <p className="text-base font-semibold tabular-nums">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
