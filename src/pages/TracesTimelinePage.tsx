/**
 * TracesTimelinePage — Observabilidade LangSmith-grade
 *
 * Lê de `trace_events` (event_type='trace_complete') para reconstruir
 * traces com hierarquia de spans (parent_span_id), exibindo waterfall
 * interativo via SpanTreeView, filtros avançados (cost/latency/status/kind),
 * heatmap por tipo de span, e export OTLP-compatible JSON.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Clock, DollarSign, Filter, GitBranch, Search, Zap, AlertTriangle,
  Download, RefreshCw, Activity, TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { PageHeader } from "@/components/shared/PageHeader";
import { SpanTreeView, type SpanLike } from "@/components/monitoring/SpanTreeView";
import { supabaseExternal } from "@/integrations/supabase/externalClient";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface TraceRecord {
  trace_id: string;
  agent_id?: string | null;
  session_id?: string | null;
  workflow_id?: string | null;
  duration_ms: number;
  status: 'ok' | 'error' | 'running';
  span_count: number;
  spans: SpanLike[];
  start_time: number;
  cost_usd: number;
  tokens: number;
  has_error: boolean;
  error_message?: string;
}

const STATUS_BADGE: Record<string, string> = {
  ok: "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  running: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
};

const KIND_HEAT_COLOR: Record<string, string> = {
  llm: "bg-nexus-blue/70",
  tool: "bg-nexus-amber/70",
  rag: "bg-nexus-violet/70",
  guardrail: "bg-destructive/70",
  workflow: "bg-primary/70",
  http: "bg-nexus-emerald/70",
  db: "bg-yellow-500/70",
  custom: "bg-muted-foreground/50",
};

export default function TracesTimelinePage() {
  const [traces, setTraces] = useState<TraceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kindFilter, setKindFilter] = useState<string>("all");
  const [minLatency, setMinLatency] = useState(0);
  const [minCost, setMinCost] = useState(0);
  const [selected, setSelected] = useState<TraceRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabaseExternal
          .from("trace_events")
          .select("id,event_type,data,created_at")
          .eq("event_type", "trace_complete")
          .order("created_at", { ascending: false })
          .limit(200);
        if (error) throw error;

        const records: TraceRecord[] = (data ?? []).map((row: { id: string; data: unknown; created_at: string | null }) => {
          const d = (row.data ?? {}) as Record<string, unknown>;
          const spans = (Array.isArray(d.spans) ? d.spans : []) as SpanLike[];
          let cost = 0;
          let tokens = 0;
          let errMsg: string | undefined;
          for (const s of spans) {
            const a = s.attributes ?? {};
            cost += Number(a['cost.usd'] ?? 0);
            tokens += Number(a['gen_ai.usage.input_tokens'] ?? 0) + Number(a['gen_ai.usage.output_tokens'] ?? 0);
            if (s.status === 'error' && !errMsg) errMsg = s.status_message;
          }
          const status = String(d.status ?? 'ok') as 'ok' | 'error' | 'running';
          return {
            trace_id: String(d.trace_id ?? row.id),
            agent_id: (d.agent_id as string) ?? null,
            session_id: (d.session_id as string) ?? null,
            workflow_id: (d.workflow_id as string) ?? null,
            duration_ms: Number(d.duration_ms ?? 0),
            status,
            span_count: Number(d.span_count ?? spans.length),
            spans,
            start_time: spans[0]?.start_time ?? new Date(row.created_at ?? Date.now()).getTime(),
            cost_usd: cost,
            tokens,
            has_error: status === 'error' || spans.some(s => s.status === 'error'),
            error_message: errMsg,
          };
        });

        if (active) setTraces(records);
      } catch (e) {
        logger.error("Failed to load traces", e);
        if (active) toast.error("Falha ao carregar traces");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [refreshKey]);

  // Aggregate kind frequency for heatmap
  const kindStats = useMemo(() => {
    const stats: Record<string, { count: number; totalMs: number }> = {};
    for (const t of traces) {
      for (const s of t.spans) {
        const k = s.kind ?? 'custom';
        if (!stats[k]) stats[k] = { count: 0, totalMs: 0 };
        stats[k].count++;
        stats[k].totalMs += s.duration_ms ?? 0;
      }
    }
    return Object.entries(stats)
      .map(([kind, v]) => ({ kind, count: v.count, avgMs: v.count > 0 ? v.totalMs / v.count : 0 }))
      .sort((a, b) => b.count - a.count);
  }, [traces]);

  const maxKindCount = Math.max(...kindStats.map(k => k.count), 1);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return traces.filter(t => {
      if (statusFilter === 'errors' && !t.has_error) return false;
      if (statusFilter === 'success' && t.has_error) return false;
      if (kindFilter !== 'all' && !t.spans.some(s => s.kind === kindFilter)) return false;
      if (t.duration_ms < minLatency) return false;
      if (t.cost_usd < minCost) return false;
      if (q) {
        const hay = `${t.trace_id} ${t.agent_id ?? ''} ${t.workflow_id ?? ''} ${t.spans.map(s => s.name).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [traces, search, statusFilter, kindFilter, minLatency, minCost]);

  const totals = useMemo(() => ({
    traces: filtered.length,
    spans: filtered.reduce((s, t) => s + t.span_count, 0),
    cost: filtered.reduce((s, t) => s + t.cost_usd, 0),
    tokens: filtered.reduce((s, t) => s + t.tokens, 0),
    errors: filtered.filter(t => t.has_error).length,
    p95: percentile(filtered.map(t => t.duration_ms), 0.95),
  }), [filtered]);

  const handleExportOTLP = () => {
    if (!selected) return;
    const otlp = {
      resourceSpans: [{
        resource: { attributes: [
          { key: 'service.name', value: { stringValue: 'nexus-agents-studio' } },
          { key: 'agent.id', value: { stringValue: selected.agent_id ?? 'unknown' } },
        ]},
        scopeSpans: [{
          scope: { name: 'nexus-tracing', version: '1.0' },
          spans: selected.spans.map(s => ({
            traceId: selected.trace_id,
            spanId: s.span_id,
            parentSpanId: s.parent_span_id,
            name: s.name,
            kind: s.kind,
            startTimeUnixNano: String(s.start_time * 1_000_000),
            endTimeUnixNano: s.end_time ? String(s.end_time * 1_000_000) : null,
            status: { code: s.status === 'ok' ? 1 : s.status === 'error' ? 2 : 0, message: s.status_message },
            attributes: Object.entries(s.attributes ?? {}).map(([key, value]) => ({
              key, value: { stringValue: String(value) },
            })),
          })),
        }],
      }],
    };
    const blob = new Blob([JSON.stringify(otlp, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trace-${selected.trace_id.slice(0, 8)}-otlp.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Trace exportado em formato OTLP");
  };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1600px] mx-auto animate-page-enter">
      <PageHeader
        title="Traces & Observabilidade"
        description="Timeline interativa LangSmith-grade — waterfall hierárquico de spans, heatmap por tipo, filtros avançados e export OTLP."
        actions={
          <Button variant="outline" size="sm" onClick={() => setRefreshKey(k => k + 1)}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Atualizar
          </Button>
        }
      />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KpiCard label="Traces" value={totals.traces.toString()} icon={Activity} />
        <KpiCard label="Spans" value={totals.spans.toString()} icon={Zap} />
        <KpiCard label="Custo total" value={`$${totals.cost.toFixed(4)}`} icon={DollarSign} />
        <KpiCard label="Tokens" value={totals.tokens.toLocaleString('pt-BR')} icon={TrendingUp} />
        <KpiCard label="Latência p95" value={`${totals.p95.toFixed(0)}ms`} icon={Clock} />
        <KpiCard label="Erros" value={totals.errors.toString()} icon={AlertTriangle} accent={totals.errors > 0 ? 'destructive' : undefined} />
      </div>

      {/* Heatmap por kind */}
      {kindStats.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Activity className="h-4 w-4" /> Distribuição por tipo de span
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {kindStats.map(k => (
                <button
                  key={k.kind}
                  onClick={() => setKindFilter(kindFilter === k.kind ? 'all' : k.kind)}
                  className={`group p-2 rounded-md border text-left transition-all ${
                    kindFilter === k.kind ? 'border-primary bg-primary/5' : 'border-border/40 hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium uppercase">{k.kind}</span>
                    <span className="text-[10px] text-muted-foreground">{k.count}</span>
                  </div>
                  <div className="h-1.5 bg-muted/30 rounded-full overflow-hidden mb-1">
                    <div
                      className={`h-full rounded-full ${KIND_HEAT_COLOR[k.kind] ?? KIND_HEAT_COLOR.custom}`}
                      style={{ width: `${(k.count / maxKindCount) * 100}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{k.avgMs.toFixed(0)}ms média</div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[440px_1fr] gap-4">
        {/* Sessions list */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Filter className="h-4 w-4" /> Filtros & Sessões
            </CardTitle>
            <div className="space-y-2 mt-3">
              <div className="relative">
                <Search className="h-3.5 w-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar trace_id, agent, span name..."
                  className="h-8 pl-7 text-xs"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos status</SelectItem>
                    <SelectItem value="success">✅ Sucesso</SelectItem>
                    <SelectItem value="errors">❌ Com erro</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={kindFilter} onValueChange={setKindFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos kinds</SelectItem>
                    {kindStats.map(k => (
                      <SelectItem key={k.kind} value={k.kind}>{k.kind} ({k.count})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Latência min</span><span className="font-mono">{minLatency}ms</span>
                </div>
                <Slider value={[minLatency]} onValueChange={(v) => setMinLatency(v[0])} max={10000} step={100} />
              </div>
              <div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Custo min</span><span className="font-mono">${minCost.toFixed(4)}</span>
                </div>
                <Slider value={[minCost * 10000]} onValueChange={(v) => setMinCost(v[0] / 10000)} max={1000} step={1} />
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[560px]">
              {loading && <div className="p-4 text-sm text-muted-foreground">Carregando traces...</div>}
              {!loading && filtered.length === 0 && (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum trace encontrado com esses filtros.
                </div>
              )}
              <div className="divide-y divide-border/40">
                {filtered.map(t => (
                  <button
                    key={t.trace_id}
                    onClick={() => setSelected(t)}
                    className={`w-full text-left p-3 hover:bg-muted/40 transition-colors ${
                      selected?.trace_id === t.trace_id ? "bg-primary/8 border-l-2 border-l-primary" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-mono text-muted-foreground truncate max-w-[180px]">
                        {t.trace_id.slice(0, 16)}…
                      </span>
                      <Badge className={`h-4 text-[9px] px-1.5 ${STATUS_BADGE[t.status] || ''}`}>
                        {t.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{t.duration_ms}ms</span>
                      <span className="flex items-center gap-1"><DollarSign className="h-2.5 w-2.5" />${t.cost_usd.toFixed(5)}</span>
                      <span className="flex items-center gap-1"><Zap className="h-2.5 w-2.5" />{t.span_count}</span>
                      {t.tokens > 0 && <span>{t.tokens.toLocaleString('pt-BR')} tk</span>}
                    </div>
                    <div className="text-[10px] text-muted-foreground/70 mt-1">
                      {new Date(t.start_time).toLocaleString("pt-BR")}
                    </div>
                    {t.has_error && t.error_message && (
                      <div className="text-[10px] text-destructive italic mt-1 truncate">⚠ {t.error_message}</div>
                    )}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Waterfall detail */}
        <Card>
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle className="text-sm">Waterfall hierárquico</CardTitle>
              {selected && (
                <p className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                  {selected.trace_id}
                </p>
              )}
            </div>
            {selected && (
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleExportOTLP}>
                  <Download className="h-3 w-3 mr-1" /> OTLP
                </Button>
                <Button
                  size="sm" variant="outline" className="h-7 text-xs"
                  onClick={() => {
                    window.location.href = `/replay-fork?trace_id=${selected.trace_id}`;
                  }}
                >
                  <GitBranch className="h-3 w-3 mr-1" /> Fork
                </Button>
              </div>
            )}
          </CardHeader>
          <CardContent>
            {!selected ? (
              <div className="h-[600px] flex flex-col items-center justify-center text-muted-foreground text-sm gap-2">
                <Activity className="h-8 w-8 opacity-40" />
                Selecione um trace para ver o waterfall hierárquico
              </div>
            ) : (
              <Tabs defaultValue="waterfall">
                <TabsList className="mb-3">
                  <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
                  <TabsTrigger value="raw">JSON</TabsTrigger>
                  <TabsTrigger value="metrics">Métricas</TabsTrigger>
                </TabsList>

                <TabsContent value="waterfall">
                  <ScrollArea className="h-[560px]">
                    <SpanTreeView
                      spans={selected.spans}
                      traceStartTime={selected.start_time}
                      traceDurationMs={selected.duration_ms}
                    />
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="raw">
                  <ScrollArea className="h-[560px]">
                    <pre className="text-[10px] bg-muted/30 p-3 rounded font-mono">
                      {JSON.stringify(selected, null, 2)}
                    </pre>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="metrics">
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <Metric label="Duration" value={`${selected.duration_ms}ms`} />
                    <Metric label="Spans" value={selected.span_count.toString()} />
                    <Metric label="Total cost" value={`$${selected.cost_usd.toFixed(6)}`} />
                    <Metric label="Tokens" value={selected.tokens.toLocaleString('pt-BR')} />
                    <Metric label="Status" value={selected.status} />
                    <Metric label="Errors" value={selected.spans.filter(s => s.status === 'error').length.toString()} />
                    <Metric label="Agent ID" value={selected.agent_id ?? '—'} mono />
                    <Metric label="Workflow" value={selected.workflow_id ?? '—'} mono />
                  </div>
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value, icon: Icon, accent }: { label: string; value: string; icon: React.ComponentType<{ className?: string }>; accent?: 'destructive' }) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mb-1 uppercase tracking-wide">
          <Icon className="h-3 w-3" /> {label}
        </div>
        <div className={`text-xl font-bold ${accent === 'destructive' ? 'text-destructive' : ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="bg-muted/20 p-2.5 rounded">
      <div className="text-[10px] text-muted-foreground uppercase mb-0.5">{label}</div>
      <div className={`text-foreground ${mono ? 'font-mono text-[11px]' : 'text-sm font-semibold'}`}>{value}</div>
    </div>
  );
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p) - 1;
  return sorted[Math.max(0, idx)];
}
