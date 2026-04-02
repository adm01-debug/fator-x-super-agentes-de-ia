import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, DollarSign, Wrench, Activity, Loader2, Bell, CheckCircle, Trash2 } from "lucide-react";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--nexus-emerald, 142 71% 45%))', 'hsl(var(--nexus-amber, 38 92% 50%))', 'hsl(var(--nexus-cyan, 190 90% 50%))', 'hsl(var(--destructive))'];

export default function MonitoringPage() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<string>('all');

  // Load agents for filter
  const { data: agentsList = [] } = useQuery({
    queryKey: ['agents_list_monitoring'],
    queryFn: async () => {
      const { data } = await supabase.from('agents').select('id, name').order('name');
      return data ?? [];
    },
  });

  const { data: traces = [], isLoading } = useQuery({
    queryKey: ['agent_traces', agentFilter],
    queryFn: async () => {
      let query = supabase
        .from('agent_traces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (agentFilter !== 'all') query = query.eq('agent_id', agentFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Alerts
  const { data: alerts = [], isLoading: loadingAlerts } = useQuery({
    queryKey: ['alerts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = traces.find(t => t.id === selectedId) || traces[0];

  const stats = {
    total: traces.length,
    errors: traces.filter(t => t.level === 'error' || t.level === 'critical').length,
    avgLatency: traces.length ? Math.round(traces.reduce((s, t) => s + (t.latency_ms || 0), 0) / traces.length) : 0,
    totalCost: traces.reduce((s, t) => s + Number(t.cost_usd || 0), 0),
  };

  const levelCounts = traces.reduce((acc, t) => {
    const level = t.level || 'info';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

  const latencyData = traces.slice(0, 20).reverse().map(t => ({
    time: new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    latency: t.latency_ms || 0,
  }));

  const handleResolveAlert = async (id: string) => {
    const { error } = await supabase.from('alerts').update({ is_resolved: true, resolved_at: new Date().toISOString() }).eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Alerta resolvido');
    queryClient.invalidateQueries({ queryKey: ['alerts'] });
  };

  const unresolvedCount = alerts.filter(a => !a.is_resolved).length;

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Monitoring" description="Traces, alertas e observabilidade em tempo real" />

      {/* Agent filter */}
      <div className="flex items-center gap-3">
        <Select value={agentFilter} onValueChange={setAgentFilter}>
          <SelectTrigger className="w-[220px] bg-secondary/50 text-xs"><SelectValue placeholder="Filtrar por agente" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os agentes</SelectItem>
            {agentsList.map((a: any) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        {agentFilter !== 'all' && <Badge variant="outline" className="text-[10px]">Filtrado</Badge>}
      </div>

      <Tabs defaultValue="traces" className="space-y-4">
        <TabsList>
          <TabsTrigger value="traces">Traces</TabsTrigger>
          <TabsTrigger value="sessions">Sessões</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5">
            Alertas {unresolvedCount > 0 && <Badge variant="destructive" className="text-[9px] h-4 px-1">{unresolvedCount}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="traces">
          {isLoading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : traces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum trace registrado</h2>
              <p className="text-sm text-muted-foreground">Traces aparecerão aqui quando agentes estiverem em produção.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-foreground">{stats.total}</p><p className="text-[10px] text-muted-foreground">Total de traces</p></div>
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-destructive">{stats.errors}</p><p className="text-[10px] text-muted-foreground">Erros</p></div>
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-foreground">{stats.avgLatency}ms</p><p className="text-[10px] text-muted-foreground">Latência média</p></div>
                <div className="nexus-card text-center py-3"><p className="text-xl font-heading font-bold text-foreground">${stats.totalCost.toFixed(3)}</p><p className="text-[10px] text-muted-foreground">Custo total</p></div>
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="nexus-card">
                  <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Latência por evento</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={latencyData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="time" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}ms`} />
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} formatter={(v: number) => `${v}ms`} />
                      <Bar dataKey="latency" radius={[3, 3, 0, 0]} fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="nexus-card">
                  <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Distribuição por nível</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                        {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="grid lg:grid-cols-3 gap-4">
                <div className="space-y-2 max-h-[500px] overflow-y-auto">
                  <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Eventos recentes</h3>
                  {traces.map(trace => (
                    <div key={trace.id}
                      className={`nexus-card cursor-pointer p-3 ${selected?.id === trace.id ? 'border-primary/40 nexus-glow-sm' : ''}`}
                      onClick={() => setSelectedId(trace.id)}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs font-medium text-foreground truncate">{trace.event}</p>
                        <StatusBadge status={trace.level || 'info'} />
                      </div>
                      <p className="text-[11px] text-muted-foreground">{trace.session_id || trace.id.slice(0, 8)}</p>
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        {trace.latency_ms && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {(trace.latency_ms / 1000).toFixed(1)}s</span>}
                        {trace.cost_usd != null && <span className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> ${Number(trace.cost_usd).toFixed(3)}</span>}
                        {trace.tokens_used && <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {trace.tokens_used}</span>}
                      </div>
                    </div>
                  ))}
                </div>

                {selected && (
                  <div className="lg:col-span-2 nexus-card">
                    <div className="flex items-center justify-between mb-4 pb-3 border-b border-border/50">
                      <div>
                        <h3 className="text-sm font-heading font-semibold text-foreground">{selected.event}</h3>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{selected.session_id} • {new Date(selected.created_at).toLocaleString('pt-BR')}</p>
                      </div>
                      <StatusBadge status={selected.level || 'info'} />
                    </div>
                    <div className="space-y-3">
                      {selected.input && (
                        <div><p className="text-xs font-semibold text-foreground mb-1">Input</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.input, null, 2)}</pre></div>
                      )}
                      {selected.output && (
                        <div><p className="text-xs font-semibold text-foreground mb-1">Output</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.output, null, 2)}</pre></div>
                      )}
                      {selected.metadata && Object.keys(selected.metadata as object).length > 0 && (
                        <div><p className="text-xs font-semibold text-foreground mb-1">Metadata</p><pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.metadata, null, 2)}</pre></div>
                      )}
                    </div>
                    <div className="mt-4 pt-4 border-t border-border/50 grid grid-cols-3 gap-4 text-center">
                      <div><p className="text-lg font-heading font-bold text-foreground">{selected.latency_ms ? (selected.latency_ms / 1000).toFixed(1) + 's' : '—'}</p><p className="text-[10px] text-muted-foreground">Latência</p></div>
                      <div><p className="text-lg font-heading font-bold text-foreground">{selected.tokens_used?.toLocaleString() || '—'}</p><p className="text-[10px] text-muted-foreground">Tokens</p></div>
                      <div><p className="text-lg font-heading font-bold text-foreground">{selected.cost_usd != null ? `$${Number(selected.cost_usd).toFixed(3)}` : '—'}</p><p className="text-[10px] text-muted-foreground">Custo</p></div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* Sessions - grouped traces */}
        <TabsContent value="sessions">
          <SessionsPanel traces={traces} />
        </TabsContent>

        <TabsContent value="alerts">
          {loadingAlerts ? (
            <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : alerts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Bell className="h-12 w-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum alerta</h2>
              <p className="text-sm text-muted-foreground">Alertas aparecerão quando limites forem ultrapassados.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert, i) => (
                <div key={alert.id}
                  className={`nexus-card flex items-start gap-3 ${alert.is_resolved ? 'opacity-60' : ''}`}
                >
                  <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${alert.severity === 'critical' ? 'bg-destructive/10' : alert.severity === 'warning' ? 'bg-amber-500/10' : 'bg-primary/10'}`}>
                    <Bell className={`h-4 w-4 ${alert.severity === 'critical' ? 'text-destructive' : alert.severity === 'warning' ? 'text-amber-400' : 'text-primary'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-medium text-foreground">{alert.title}</p>
                      <Badge variant={alert.severity === 'critical' ? 'destructive' : 'outline'} className="text-[9px]">{alert.severity}</Badge>
                      {alert.is_resolved && <Badge variant="secondary" className="text-[9px] gap-1"><CheckCircle className="h-2.5 w-2.5" /> Resolvido</Badge>}
                    </div>
                    {alert.message && <p className="text-xs text-muted-foreground">{alert.message}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{alert.created_at ? new Date(alert.created_at).toLocaleString('pt-BR') : ''}</p>
                  </div>
                  {!alert.is_resolved && (
                    <Button variant="outline" size="sm" className="text-xs shrink-0" onClick={() => handleResolveAlert(alert.id)}>
                      Resolver
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Alert Rules Management */}
          <AlertRulesPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ═══ P2-10: Alert Rules Management ═══
function AlertRulesPanel() {
  const queryClient = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [ruleMetric, setRuleMetric] = useState('cost_usd');
  const [ruleOp, setRuleOp] = useState('>');
  const [ruleThreshold, setRuleThreshold] = useState('10');
  const [ruleSeverity, setRuleSeverity] = useState('warning');

  const { data: rules = [] } = useQuery({
    queryKey: ['alert_rules'],
    queryFn: async () => {
      const { data: member } = await supabase.from('workspace_members').select('workspace_id').limit(1).single();
      if (!member?.workspace_id) return [];
      const { data } = await (supabase as any).from('alert_rules').select('*').eq('workspace_id', member.workspace_id).order('created_at', { ascending: false });
      return data ?? [];
    },
  });

  const handleCreateRule = async () => {
    if (!ruleName.trim()) { toast.error('Nome é obrigatório'); return; }
    setCreating(true);
    try {
      const { data: member } = await supabase.from('workspace_members').select('workspace_id').limit(1).single();
      await (supabase as any).from('alert_rules').insert({
        workspace_id: member?.workspace_id, name: ruleName.trim(),
        metric: ruleMetric, operator: ruleOp,
        threshold: parseFloat(ruleThreshold) || 0, severity: ruleSeverity,
      });
      toast.success('Regra criada!');
      setRuleName('');
      queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
    } catch (e: any) { toast.error(e.message); }
    finally { setCreating(false); }
  };

  const handleDeleteRule = async (id: string) => {
    await (supabase as any).from('alert_rules').delete().eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
    toast.success('Regra removida');
  };

  const handleToggleRule = async (id: string, enabled: boolean) => {
    await (supabase as any).from('alert_rules').update({ is_enabled: enabled }).eq('id', id);
    queryClient.invalidateQueries({ queryKey: ['alert_rules'] });
  };

  return (
    <div className="nexus-card mt-6">
      <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Regras de Alerta Automático</h3>
      <p className="text-xs text-muted-foreground mb-4">Crie regras que disparam alertas quando métricas ultrapassam limites.</p>

      {/* Create form */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2 mb-4 items-end">
        <div><label className="text-[10px] text-muted-foreground">Nome</label><input value={ruleName} onChange={e => setRuleName(e.target.value)} placeholder="Ex: Custo alto" className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs" /></div>
        <div><label className="text-[10px] text-muted-foreground">Métrica</label>
          <select value={ruleMetric} onChange={e => setRuleMetric(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
            <option value="cost_usd">Custo (USD)</option><option value="latency_ms">Latência (ms)</option><option value="tokens_used">Tokens</option><option value="error_count">Erros</option>
          </select></div>
        <div><label className="text-[10px] text-muted-foreground">Operador</label>
          <select value={ruleOp} onChange={e => setRuleOp(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
            <option value=">">&gt;</option><option value=">=">&gt;=</option><option value="<">&lt;</option><option value="<=">&lt;=</option><option value="==">=</option>
          </select></div>
        <div><label className="text-[10px] text-muted-foreground">Threshold</label><input type="number" value={ruleThreshold} onChange={e => setRuleThreshold(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs" /></div>
        <div><label className="text-[10px] text-muted-foreground">Severidade</label>
          <select value={ruleSeverity} onChange={e => setRuleSeverity(e.target.value)} className="w-full rounded-lg border border-border bg-secondary/50 px-2 py-1.5 text-xs">
            <option value="info">Info</option><option value="warning">Warning</option><option value="critical">Critical</option>
          </select></div>
        <Button size="sm" onClick={handleCreateRule} disabled={creating} className="nexus-gradient-bg text-primary-foreground text-xs">
          {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Criar regra'}
        </Button>
      </div>

      {/* Rules list */}
      {rules.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">Nenhuma regra criada. Alertas de budget são automáticos via trigger.</p>
      ) : (
        <div className="space-y-2">
          {rules.map((rule: any) => (
            <div key={rule.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-secondary/30 text-xs">
              <div className="flex items-center gap-3">
                <input type="checkbox" checked={rule.is_enabled} onChange={e => handleToggleRule(rule.id, e.target.checked)} className="rounded" />
                <div>
                  <span className="font-medium text-foreground">{rule.name}</span>
                  <span className="text-muted-foreground ml-2">{rule.metric} {rule.operator} {rule.threshold}</span>
                </div>
                <Badge variant={rule.severity === 'critical' ? 'destructive' : 'outline'} className="text-[9px]">{rule.severity}</Badge>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => handleDeleteRule(rule.id)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══ P3-11: Sessions Tracking ═══

function SessionsPanel({ traces }: { traces: any[] }) {
  // Group traces by session_id
  const sessions = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const t of traces) {
      const sid = t.session_id || 'no-session';
      if (!map.has(sid)) map.set(sid, []);
      map.get(sid)!.push(t);
    }
    return Array.from(map.entries())
      .map(([sessionId, sessionTraces]) => ({
        sessionId,
        traces: sessionTraces.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
        totalTokens: sessionTraces.reduce((s: number, t: any) => s + (t.tokens_used || 0), 0),
        totalCost: sessionTraces.reduce((s: number, t: any) => s + (t.cost_usd || 0), 0),
        startedAt: sessionTraces[0]?.created_at,
        events: sessionTraces.length,
      }))
      .sort((a, b) => new Date(b.startedAt || 0).getTime() - new Date(a.startedAt || 0).getTime());
  }, [traces]);

  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Activity className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Nenhuma sessão</h2>
        <p className="text-sm text-muted-foreground">Sessões são agrupamentos de traces por session_id.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((session, i) => (
        <div key={session.sessionId} className="nexus-card">
          <div className="flex items-center justify-between cursor-pointer" onClick={() => setExpandedSession(expandedSession === session.sessionId ? null : session.sessionId)}>
            <div>
              <p className="text-sm font-semibold text-foreground font-mono">{session.sessionId === 'no-session' ? '(sem sessão)' : session.sessionId.substring(0, 12) + '...'}</p>
              <p className="text-[11px] text-muted-foreground">{session.events} eventos • {session.totalTokens} tokens • ${session.totalCost.toFixed(4)}</p>
            </div>
            <div className="text-xs text-muted-foreground">
              {session.startedAt ? new Date(session.startedAt).toLocaleString('pt-BR') : ''}
            </div>
          </div>
          {expandedSession === session.sessionId && (
            <div className="mt-3 pt-3 border-t border-border/30 space-y-2">
              {session.traces.map((t: any) => (
                <div key={t.id} className="flex items-center gap-3 text-xs py-1">
                  <span className="text-muted-foreground w-[60px] shrink-0 font-mono">{new Date(t.created_at).toLocaleTimeString('pt-BR')}</span>
                  <Badge variant="outline" className={`text-[9px] shrink-0 ${t.level === 'error' ? 'border-destructive text-destructive' : t.level === 'warning' ? 'border-amber-500 text-amber-400' : ''}`}>{t.level || 'info'}</Badge>
                  <span className="text-foreground truncate">{t.event}</span>
                  <span className="text-muted-foreground ml-auto shrink-0">{t.latency_ms || 0}ms • {t.tokens_used || 0}t</span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
