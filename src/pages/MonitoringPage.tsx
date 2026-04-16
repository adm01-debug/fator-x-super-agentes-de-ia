import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { SystemHealthBanner } from "@/components/shared/SystemHealthBanner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Wrench, Activity, Loader2, Bell, CheckCircle, Layers, Zap } from "lucide-react";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LightBarChart, LightPieChart } from "@/components/charts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { getAgentTraces, getSessions, getSessionTraces, getTraceEvents, getAlerts, resolveAlert, getAgentsForFilter } from "@/services/monitoringService";
import { TracingPanel } from "@/components/monitoring/TracingPanel";
import { AdvancedTraceFilters, applyTraceFilters, EMPTY_FILTERS, type TraceFilters } from "@/components/monitoring/AdvancedTraceFilters";
import { AlertRulesPanel } from "@/components/monitoring/AlertRulesPanel";
import { WebVitalsPanel } from "@/components/monitoring/WebVitalsPanel";

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--nexus-emerald, 142 71% 45%))', 'hsl(var(--nexus-amber, 38 92% 50%))', 'hsl(var(--nexus-cyan, 190 90% 50%))', 'hsl(var(--destructive))'];

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [traceFilters, setTraceFilters] = useState<TraceFilters>(EMPTY_FILTERS);
  const { data: agentsList = [] } = useQuery({ queryKey: ['agents_list_monitoring'], queryFn: getAgentsForFilter });
  const { data: traces = [], isLoading } = useQuery({ queryKey: ['agent_traces', agentFilter], queryFn: () => getAgentTraces({ agentId: agentFilter !== 'all' ? agentFilter : undefined }) });
  const filteredTraces = applyTraceFilters(traces, traceFilters);
  const { data: sessions = [], isLoading: loadingSessions } = useQuery({ queryKey: ['sessions_real', agentFilter], queryFn: () => getSessions({ agentId: agentFilter !== 'all' ? agentFilter : undefined }) });
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);
  const { data: sessionTraces = [] } = useQuery({ queryKey: ['session_traces', expandedSessionId], enabled: !!expandedSessionId, queryFn: () => expandedSessionId ? getSessionTraces(expandedSessionId) : Promise.resolve([]) });
  const [expandedTraceId, setExpandedTraceId] = useState<string | null>(null);
  const { data: traceEvents = [] } = useQuery({ queryKey: ['trace_events', expandedTraceId], enabled: !!expandedTraceId, queryFn: () => expandedTraceId ? getTraceEvents(expandedTraceId) : Promise.resolve([]) });
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({ queryKey: ['alerts'], queryFn: () => getAlerts({}) });

  const selected = filteredTraces.find((t: any) => t.id === selectedId) || filteredTraces[0];
  const stats = { total: filteredTraces.length, errors: filteredTraces.filter((t: any) => t.level === 'error' || t.level === 'critical').length, avgLatency: filteredTraces.length ? Math.round(filteredTraces.reduce((s: number, t: any) => s + (t.latency_ms || 0), 0) / filteredTraces.length) : 0, totalCost: filteredTraces.reduce((s: number, t: any) => s + Number(t.cost_usd || 0), 0) };
  const levelCounts = filteredTraces.reduce((acc: Record<string, number>, t: any) => { const level = t.level || 'info'; acc[level] = (acc[level] || 0) + 1; return acc; }, {} as Record<string, number>);
  const pieData = Object.entries(levelCounts).map(([name, value]) => ({ name, value: value as number }));
  const latencyData = filteredTraces.slice(0, 20).reverse().map((t: any) => ({ time: new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }), latency: t.latency_ms || 0 }));
  const unresolvedCount = alerts.filter((a: any) => !a.is_resolved).length;
  const agentName = (id: string | null) => { if (!id) return '—'; const a = agentsList.find((ag: any) => ag.id === id); return a ? a.name : id.substring(0, 8); };

  const handleResolveAlert = async (id: string) => { try { await resolveAlert(id); toast.success('Alerta resolvido'); queryClient.invalidateQueries({ queryKey: ['alerts'] }); } catch (e: unknown) { toast.error(e instanceof Error ? e.message : 'Erro inesperado'); } };

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader title="Monitoramento" description="Traces, sessões, alertas e observabilidade em tempo real" />
      <SystemHealthBanner />
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[220px] bg-secondary/50 text-xs"><SelectValue placeholder="Filtrar por agente" /></SelectTrigger>
          <SelectContent><SelectItem value="all">Todos os agentes</SelectItem>{agentsList.map((a) => <SelectItem key={a.id} value={String(a.id)}>{String(a.name)}</SelectItem>)}</SelectContent>
        </Select>
        {agentFilter !== 'all' && <Badge variant="outline" className="text-[11px]">Filtrado</Badge>}
      </div>
      <AdvancedTraceFilters filters={traceFilters} onChange={setTraceFilters} />

      <Tabs defaultValue="traces" className="space-y-4">
        <TabsList>
          <TabsTrigger value="traces">Traces</TabsTrigger>
          <TabsTrigger value="sessions" className="gap-1.5"><Layers className="h-3.5 w-3.5" /> Sessões {sessions.length > 0 && <Badge variant="secondary" className="text-[11px] h-4 px-1 ml-1">{sessions.length}</Badge>}</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">Alertas {unresolvedCount > 0 && <Badge variant="destructive" className="text-[11px] h-4 px-1">{unresolvedCount}</Badge>}</TabsTrigger>
          <TabsTrigger value="tracing" className="gap-1.5"><Zap className="h-3.5 w-3.5" /> Tracing</TabsTrigger>
          <TabsTrigger value="vitals" className="gap-1.5">⚡ Web Vitals</TabsTrigger>
        </TabsList>

        <TabsContent value="traces">
          {isLoading ? <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : filteredTraces.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center"><Activity className="h-12 w-12 text-muted-foreground mb-4" /><h2 className="text-lg font-semibold text-foreground mb-1">Nenhum trace registrado</h2><p className="text-sm text-muted-foreground">Traces aparecerão aqui quando agentes estiverem em produção.</p></div>
          : <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-foreground">{stats.total}</p><p className="text-[11px] text-muted-foreground">Total de traces</p></div>
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-destructive">{stats.errors}</p><p className="text-[11px] text-muted-foreground">Erros</p></div>
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-foreground">{stats.avgLatency}ms</p><p className="text-[11px] text-muted-foreground">Latência média</p></div>
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-foreground">${stats.totalCost.toFixed(3)}</p><p className="text-[11px] text-muted-foreground">Custo total</p></div>
              </div>
              <div className="grid lg:grid-cols-2 gap-4">
                <div className="nexus-card"><h3 className="text-sm font-heading font-semibold text-foreground mb-3">Latência por evento</h3><LightBarChart data={latencyData} xKey="time" height={180} yFormatter={(v) => `${v}ms`} tooltipFormatter={(v) => `${v}ms`} series={[{ dataKey: 'latency', name: 'Latência', color: 'hsl(var(--primary))', radius: 3 }]} /></div>
                <div className="nexus-card"><h3 className="text-sm font-heading font-semibold text-foreground mb-3">Distribuição por nível</h3><LightPieChart data={pieData.map((p: any, i: number) => ({ ...p, color: PIE_COLORS[i % PIE_COLORS.length] }))} height={180} innerRadius={40} outerRadius={70} /></div>
              </div>
              <div className="grid lg:grid-cols-3 gap-4">
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Eventos recentes</h3>
                  {filteredTraces.map((trace: any) => (
                    <div key={trace.id} className={`nexus-card cursor-pointer p-3 ${selected?.id === trace.id ? 'border-primary/40 nexus-glow-sm' : ''}`} onClick={() => setSelectedId(trace.id)}>
                      <div className="flex items-center justify-between mb-1.5"><p className="text-xs font-medium text-foreground truncate">{trace.event}</p><StatusBadge status={trace.level || 'info'} /></div>
                      <p className="text-[11px] text-muted-foreground">{trace.session_id || trace.id.slice(0, 8)}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        {trace.latency_ms && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {(trace.latency_ms / 1000).toFixed(1)}s</span>}
                        {trace.cost_usd != null && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${Number(trace.cost_usd).toFixed(3)}</span>}
                        {trace.tokens_used && <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {String(trace.tokens_used)}</span>}
                      </div>
                    </div>
                  ))}
                </div>
                {selected && (
                  <div className="lg:col-span-2 nexus-card">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                      <div><h3 className="text-sm font-heading font-semibold text-foreground">{selected.event}</h3><p className="text-[11px] text-muted-foreground mt-0.5">{selected.session_id} • {new Date(selected.created_at).toLocaleString('pt-BR')}</p></div>
                      <StatusBadge status={selected.level || 'info'} />
                    </div>
                    <div className="space-y-3">
                      {selected.input && <div><p className="text-xs font-semibold text-foreground mb-1">Input</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.input, null, 2)}</pre></div>}
                      {selected.output && <div><p className="text-xs font-semibold text-foreground mb-1">Output</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.output, null, 2)}</pre></div>}
                      {selected.metadata && Object.keys(selected.metadata as object).length > 0 && <div><p className="text-xs font-semibold text-foreground mb-1">Metadata</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.metadata, null, 2)}</pre></div>}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-lg font-heading font-bold text-foreground">{selected.latency_ms ? (selected.latency_ms / 1000).toFixed(1) + 's' : '—'}</p><p className="text-[11px] text-muted-foreground">Latência</p></div>
                      <div><p className="text-lg font-heading font-bold text-foreground">{selected.tokens_used?.toLocaleString() || '—'}</p><p className="text-[11px] text-muted-foreground">Tokens</p></div>
                      <div><p className="text-lg font-heading font-bold text-foreground">{selected.cost_usd != null ? `$${Number(selected.cost_usd).toFixed(3)}` : '—'}</p><p className="text-[11px] text-muted-foreground">Custo</p></div>
                    </div>
                  </div>
                )}
              </div>
            </>}
        </TabsContent>

        <TabsContent value="sessions">
          {loadingSessions ? <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          : sessions.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center"><Layers className="h-12 w-12 text-muted-foreground mb-4" /><h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma sessão registrada</h2></div>
          : <div className="space-y-3">
              {sessions.map((session) => (
                <div key={session.id} className="nexus-card">
                  <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedSessionId(expandedSessionId === session.id ? null : session.id)}>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-foreground font-mono">{session.id.substring(0, 12)}...</p>
                        <Badge variant={session.status === 'active' ? 'default' : 'secondary'} className="text-[11px]">{session.status}</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Agente: {agentName(session.agent_id)} • Início: {session.started_at ? new Date(session.started_at).toLocaleString('pt-BR') : '—'}</p>
                    </div>
                  </div>
                  {expandedSessionId === session.id && (
                    <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
                      {sessionTraces.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4">Nenhum trace nesta sessão</p>
                      : sessionTraces.map((st) => (
                        <div key={st.id} className="rounded-lg bg-secondary/20 p-2.5">
                          <div className="flex items-center gap-3 text-xs cursor-pointer" onClick={() => setExpandedTraceId(expandedTraceId === st.id ? null : st.id)}>
                            <Badge variant="outline" className="text-[11px] shrink-0">{st.trace_type}</Badge>
                            <span className="text-foreground truncate flex-1">{st.latency_ms ? `${st.latency_ms}ms` : ''} {st.tokens_used ? `• ${st.tokens_used}t` : ''}</span>
                            <span className="text-muted-foreground shrink-0 font-mono">{new Date(st.created_at || '').toLocaleTimeString('pt-BR')}</span>
                          </div>
                          {expandedTraceId === st.id && traceEvents.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-border/20 space-y-1 pl-4">
                              {traceEvents.map((ev) => (
                                <div key={ev.id} className="flex items-center gap-2 text-[11px]">
                                  <span className="text-muted-foreground font-mono w-[55px] shrink-0">{new Date(ev.created_at || '').toLocaleTimeString('pt-BR')}</span>
                                  <Badge variant="outline" className="text-[8px] shrink-0">{ev.event_type}</Badge>
                                  {ev.data && <span className="text-muted-foreground truncate">{JSON.stringify(ev.data).substring(0, 80)}</span>}
                                </div>
                              ))}
                            </div>
                          )}
                          {expandedTraceId === st.id && (
                            <div className="mt-2 space-y-2">
                              {st.input ? <div><p className="text-[11px] font-semibold text-foreground">Input</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-2 rounded max-h-[120px] overflow-auto">{String(typeof st.input === 'string' ? st.input : JSON.stringify(st.input as Record<string, unknown>, null, 2))}</pre></div> : null}
                              {st.output ? <div><p className="text-[11px] font-semibold text-foreground">Output</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-2 rounded max-h-[120px] overflow-auto">{String(typeof st.output === 'string' ? st.output : JSON.stringify(st.output as Record<string, unknown>, null, 2))}</pre></div> : null}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>}
        </TabsContent>

        <TabsContent value="alerts">
          {loadingAlerts ? <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          : alerts.length === 0 ? <div className="flex flex-col items-center justify-center py-20 text-center"><Bell className="h-12 w-12 text-muted-foreground mb-4" /><h2 className="text-lg font-semibold text-foreground mb-1">Nenhum alerta</h2></div>
          : <div className="space-y-3">
              {alerts.map((alert: any) => (
                <div key={alert.id} className={`nexus-card flex items-start gap-3 ${alert.is_resolved ? 'opacity-60' : ''}`}>
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${alert.severity === 'critical' ? 'bg-destructive/10' : alert.severity === 'warning' ? 'bg-nexus-amber/10' : 'bg-primary/10'}`}>
                    <Bell className={`h-4 w-4 ${alert.severity === 'critical' ? 'text-destructive' : alert.severity === 'warning' ? 'text-nexus-amber' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1"><p className="text-sm font-medium text-foreground">{alert.title}</p><Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'} className="text-[11px]">{alert.severity}</Badge>{alert.is_resolved && <Badge variant="secondary" className="text-[11px] gap-1"><CheckCircle className="h-2.5 w-2.5" /> Resolvido</Badge>}</div>
                    {alert.message && <p className="text-xs text-muted-foreground">{alert.message}</p>}
                  </div>
                  {!alert.is_resolved && <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => handleResolveAlert(alert.id)}>Resolver</Button>}
                </div>
              ))}
            </div>}
          <AlertRulesPanel />
        </TabsContent>

        <TabsContent value="tracing"><TracingPanel /></TabsContent>
        <TabsContent value="vitals"><WebVitalsPanel /></TabsContent>
      </Tabs>
    </div>
  );
}
