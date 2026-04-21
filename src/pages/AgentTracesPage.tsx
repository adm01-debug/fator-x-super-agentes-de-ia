import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, DollarSign, Play, RefreshCw, Zap } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useDebounce } from '@/hooks/use-debounce';
import {
  listAgentTraces, listAvailableEvents, groupBySession,
  type ExecutionGroup, type TraceLevel,
} from '@/services/agentTracesService';
import { listAgentSummaries, getAgentById } from '@/services/agentsService';
import { TracesFilters } from '@/components/agents/traces/TracesFilters';
import { ExecutionList } from '@/components/agents/traces/ExecutionList';
import { ExecutionTimeline } from '@/components/agents/traces/ExecutionTimeline';
import { ReplayDialog } from '@/components/agents/traces/ReplayDialog';

export default function AgentTracesPage() {
  const { id } = useParams();

  const [agentFilter, setAgentFilter] = useState<string>(id ?? 'all');
  const [level, setLevel] = useState<TraceLevel | 'all'>('all');
  const [event, setEvent] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [sinceHours, setSinceHours] = useState(24);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replayOpen, setReplayOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

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

  const { data: events = [] } = useQuery({
    queryKey: ['agent-trace-events', effectiveAgentId],
    queryFn: () => listAvailableEvents(effectiveAgentId),
  });

  const { data: traces = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['agent-traces', effectiveAgentId, level, event, debouncedSearch, sinceHours],
    queryFn: () => listAgentTraces({
      agentId: effectiveAgentId,
      level,
      event,
      search: debouncedSearch,
      sinceHours,
      limit: 500,
    }),
    staleTime: 30_000,
  });

  const executions = useMemo(() => groupBySession(traces), [traces]);
  const selected: ExecutionGroup | null = useMemo(
    () => executions.find((e) => e.session_id === selectedId) ?? executions[0] ?? null,
    [executions, selectedId],
  );

  const totals = useMemo(() => {
    const errors = traces.filter((t) => t.level === 'error').length;
    const cost = traces.reduce((s, t) => s + Number(t.cost_usd ?? 0), 0);
    return { execs: executions.length, traces: traces.length, errors, cost };
  }, [traces, executions]);

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-5 max-w-[1500px] mx-auto animate-page-enter">
      <PageHeader
        title={agent ? `Traces de execução — ${agent.name}` : 'Traces de execução'}
        description="Inspecione cada execução agrupada por sessão. Filtre por nível, evento ou agente e reproduza passo a passo."
        backTo={id ? `/agents/${id}` : '/agents'}
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isFetching ? 'animate-spin' : ''}`} /> Atualizar
          </Button>
        }
      />

      <TracesFilters
        search={search} onSearch={setSearch}
        level={level} onLevel={setLevel}
        event={event} onEvent={setEvent}
        agentId={agentFilter} onAgent={(v) => { setAgentFilter(v); setSelectedId(null); }}
        sinceHours={sinceHours} onSinceHours={setSinceHours}
        events={events} agents={agents}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi icon={Activity} label="Execuções" value={totals.execs.toString()} />
        <Kpi icon={Zap} label="Traces" value={totals.traces.toString()} />
        <Kpi icon={AlertTriangle} label="Erros" value={totals.errors.toString()} accent={totals.errors > 0} />
        <Kpi icon={DollarSign} label="Custo total" value={`$${totals.cost.toFixed(4)}`} />
      </div>

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
              loading={isLoading}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-sm">Linha do tempo</CardTitle>
              {selected && (
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono truncate">
                  {selected.session_id.startsWith('auto-') ? '∅ sem session_id' : selected.session_id}
                  {' · '}{selected.traces.length} eventos · {selected.total_ms}ms
                </p>
              )}
            </div>
            {selected && (
              <Button size="sm" onClick={() => setReplayOpen(true)} className="h-8">
                <Play className="h-3.5 w-3.5 mr-1.5" /> Replay
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="h-[560px] flex flex-col items-center justify-center text-sm text-muted-foreground gap-2">
                <Activity className="h-8 w-8 opacity-40" />
                Selecione uma execução para ver os eventos.
              </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto pr-2">
                <ExecutionTimeline execution={selected} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <ReplayDialog open={replayOpen} onOpenChange={setReplayOpen} execution={selected} />
    </div>
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
