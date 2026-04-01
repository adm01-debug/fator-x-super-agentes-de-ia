import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Clock, DollarSign, Wrench, Activity, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

const stepColors: Record<string, string> = {
  input: 'bg-nexus-cyan',
  retrieval: 'bg-nexus-amber',
  tool_call: 'bg-primary',
  model: 'bg-nexus-glow',
  guardrail: 'bg-nexus-emerald',
  output: 'bg-nexus-emerald',
};

const PIE_COLORS = ['hsl(var(--primary))', 'hsl(var(--nexus-emerald, 142 71% 45%))', 'hsl(var(--nexus-amber, 38 92% 50%))', 'hsl(var(--nexus-cyan, 190 90% 50%))', 'hsl(var(--destructive))'];

export default function MonitoringPage() {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: traces = [], isLoading } = useQuery({
    queryKey: ['agent_traces'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_traces')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  const selected = traces.find(t => t.id === selectedId) || traces[0];

  // Stats
  const stats = {
    total: traces.length,
    errors: traces.filter(t => t.level === 'error' || t.level === 'critical').length,
    avgLatency: traces.length ? Math.round(traces.reduce((s, t) => s + (t.latency_ms || 0), 0) / traces.length) : 0,
    totalCost: traces.reduce((s, t) => s + Number(t.cost_usd || 0), 0),
  };

  // Level distribution for pie chart
  const levelCounts = traces.reduce((acc, t) => {
    const level = t.level || 'info';
    acc[level] = (acc[level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const pieData = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

  // Latency over time (last 20)
  const latencyData = traces.slice(0, 20).reverse().map(t => ({
    time: new Date(t.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    latency: t.latency_ms || 0,
  }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader title="Monitoring" description="Traces, sessões e observabilidade em tempo real" />

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
          {/* Stats bar */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="nexus-card text-center py-3">
              <p className="text-xl font-heading font-bold text-foreground">{stats.total}</p>
              <p className="text-[10px] text-muted-foreground">Total de traces</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-xl font-heading font-bold text-destructive">{stats.errors}</p>
              <p className="text-[10px] text-muted-foreground">Erros</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-xl font-heading font-bold text-foreground">{stats.avgLatency}ms</p>
              <p className="text-[10px] text-muted-foreground">Latência média</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-xl font-heading font-bold text-foreground">${stats.totalCost.toFixed(3)}</p>
              <p className="text-[10px] text-muted-foreground">Custo total</p>
            </div>
          </div>

          {/* Charts */}
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

          {/* Trace list + detail */}
          <div className="grid lg:grid-cols-3 gap-4">
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              <h3 className="text-xs font-heading font-semibold text-muted-foreground uppercase tracking-wider mb-2">Eventos recentes</h3>
              {traces.map(trace => (
                <motion.div
                  key={trace.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
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
                </motion.div>
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
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Input</p>
                      <pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.input, null, 2)}</pre>
                    </div>
                  )}
                  {selected.output && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Output</p>
                      <pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.output, null, 2)}</pre>
                    </div>
                  )}
                  {selected.metadata && Object.keys(selected.metadata as object).length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-1">Metadata</p>
                      <pre className="text-[11px] text-muted-foreground bg-secondary/30 p-3 rounded-lg overflow-x-auto max-h-[200px]">{JSON.stringify(selected.metadata, null, 2)}</pre>
                    </div>
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
    </div>
  );
}
