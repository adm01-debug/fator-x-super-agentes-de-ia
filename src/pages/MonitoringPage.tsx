import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { traces as mockTraces } from "@/lib/mock-data";
import * as traceService from "@/services/traceService";
import { Clock, DollarSign, Wrench, Search, Download, RefreshCw, Filter, X } from "lucide-react";
import { useState, useCallback, useMemo } from "react";
import { debounce } from "@/services/resilience";
import { toast } from "sonner";

const stepColors: Record<string, string> = {
  input: 'bg-nexus-cyan', retrieval: 'bg-nexus-amber', tool_call: 'bg-primary',
  model: 'bg-nexus-glow', guardrail: 'bg-nexus-emerald', output: 'bg-nexus-emerald',
};

type StatusFilter = 'all' | 'success' | 'error' | 'blocked' | 'timeout';

export default function MonitoringPage() {
  // Use real traces if available, fallback to mock
  const realTraces = traceService.getTraces(100);
  const mappedReal = realTraces.map(t => ({
    id: t.id,
    agent: t.agent_name,
    sessionId: t.session_id,
    timestamp: new Date(t.timestamp).toLocaleString('pt-BR'),
    user: t.user_id ?? 'system',
    status: t.status as string,
    duration: t.latency_ms,
    tokens: t.tokens_in + t.tokens_out,
    cost: t.cost_usd,
    toolCalls: t.tools_used.length,
    steps: t.events.map((e, i) => ({
      id: `step-${i}`, type: e.type, label: e.label, detail: e.detail ?? '',
      duration: e.duration_ms, status: e.status,
    })),
  }));
  const [allTraces] = useState(mappedReal.length > 0 ? mappedReal : mockTraces);
  const [selectedTrace, setSelectedTrace] = useState(mockTraces[0]);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const applySearch = useMemo(() => debounce((v: unknown) => setDebouncedQuery(v as string), 300), []);
  const handleSearch = (v: string) => { setSearchQuery(v); applySearch(v); };
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const filtered = allTraces.filter(t =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (!debouncedQuery || t.agent.toLowerCase().includes(debouncedQuery.toLowerCase()) || t.sessionId.toLowerCase().includes(debouncedQuery.toLowerCase()))
  );

  const refresh = useCallback(() => {
    setIsRefreshing(true);
    toast.info('Atualizando traces...');
    setTimeout(() => { setIsRefreshing(false); toast.success(`${allTraces.length} traces carregados`); }, 1000);
  }, [allTraces]);

  const exportTraces = useCallback(() => {
    const data = JSON.stringify(allTraces, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `traces_${new Date().toISOString().slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${allTraces.length} traces exportados`);
  }, [allTraces]);

  const totalCost = allTraces.reduce((s, t) => s + t.cost, 0);
  const avgLatency = allTraces.length > 0 ? Math.round(allTraces.reduce((s, t) => s + t.duration, 0) / allTraces.length) : 0;
  const errorRate = allTraces.length > 0 ? Math.round(allTraces.filter(t => t.status === 'error').length / allTraces.length * 100) : 0;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Monitoring" description="Traces, sessões e observabilidade em tempo real"
        actions={<div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportTraces} className="gap-1"><Download className="h-3.5 w-3.5" /> Exportar</Button>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isRefreshing} className="gap-1"><RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} /> Atualizar</Button>
        </div>} />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Traces total', value: allTraces.length, color: 'text-foreground' },
          { label: 'Custo total', value: `$${totalCost.toFixed(3)}`, color: 'text-amber-400' },
          { label: 'Latência média', value: `${(avgLatency / 1000).toFixed(1)}s`, color: 'text-foreground' },
          { label: 'Error rate', value: `${errorRate}%`, color: errorRate > 10 ? 'text-rose-400' : 'text-emerald-400' },
          { label: 'Success', value: allTraces.filter(t => t.status === 'success').length, color: 'text-emerald-400' },
        ].map(k => (
          <div key={k.label} className="nexus-card text-center py-3">
            <p className={`text-2xl font-heading font-bold ${k.color}`}>{k.value}</p>
            <p className="text-[10px] text-muted-foreground">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={searchQuery} onChange={e => handleSearch(e.target.value)} placeholder="Buscar agente ou session ID..." className="w-full pl-9 bg-muted/30 border border-border rounded-lg px-3 py-2 text-sm text-foreground" />
        </div>
        <div className="flex gap-1">
          {(['all', 'success', 'error', 'blocked', 'timeout'] as StatusFilter[]).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${statusFilter === s ? 'bg-primary/10 text-primary border border-primary/30' : 'text-muted-foreground hover:bg-muted/30 border border-transparent'}`}>
              {s === 'all' ? 'Todos' : s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Trace list */}
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">
            {filtered.length} sessões {statusFilter !== 'all' ? `(${statusFilter})` : ''}
          </h3>
          {filtered.map(trace => (
            <div key={trace.id} className={`nexus-card cursor-pointer p-3 transition-all ${selectedTrace.id === trace.id ? 'border-primary/40 ring-1 ring-primary/20' : 'hover:border-border'}`} onClick={() => setSelectedTrace(trace)}>
              <div className="flex items-center justify-between mb-1.5">
                <p className="text-xs font-medium text-foreground truncate">{trace.agent.split('—')[0].trim()}</p>
                <StatusBadge status={trace.status} />
              </div>
              <p className="text-[11px] text-muted-foreground font-mono">{trace.sessionId}</p>
              <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {(trace.duration / 1000).toFixed(1)}s</span>
                <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${trace.cost.toFixed(3)}</span>
                <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {trace.toolCalls}</span>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">Nenhum trace encontrado</p>}
        </div>

        {/* Trace detail */}
        <div className="lg:col-span-2 nexus-card">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
            <div>
              <h3 className="text-sm font-heading font-semibold text-foreground">{selectedTrace.agent}</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">{selectedTrace.sessionId} • {selectedTrace.timestamp} • {selectedTrace.user}</p>
            </div>
            <StatusBadge status={selectedTrace.status} size="md" />
          </div>

          <div className="space-y-0">
            {selectedTrace.steps.map((step, i) => (
              <div key={step.id}>
                <div className="flex items-start gap-3 relative">
                  {i < selectedTrace.steps.length - 1 && <div className="absolute left-[11px] top-7 w-0.5 h-[calc(100%+4px)] bg-border/50" />}
                  <div className={`h-6 w-6 rounded-full ${stepColors[step.type] || 'bg-secondary'} flex items-center justify-center shrink-0 z-10`}>
                    <span className="text-[9px] font-bold text-primary-foreground">{i + 1}</span>
                  </div>
                  <div className="flex-1 pb-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium text-foreground">{step.label}</p>
                        <span className="nexus-badge text-[10px] bg-secondary/50 text-muted-foreground">{step.type}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        {step.duration > 0 && <span className="text-[11px] text-muted-foreground">{step.duration}ms</span>}
                        <StatusBadge status={step.status} />
                      </div>
                    </div>
                    {step.detail && <p className="text-[11px] text-muted-foreground mt-1">{step.detail}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div><p className="text-lg font-heading font-bold text-foreground">{(selectedTrace.duration / 1000).toFixed(1)}s</p><p className="text-[10px] text-muted-foreground">Duração total</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{selectedTrace.tokens.toLocaleString()}</p><p className="text-[10px] text-muted-foreground">Tokens</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">${selectedTrace.cost.toFixed(3)}</p><p className="text-[10px] text-muted-foreground">Custo</p></div>
            <div><p className="text-lg font-heading font-bold text-foreground">{selectedTrace.toolCalls}</p><p className="text-[10px] text-muted-foreground">Tool calls</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}
