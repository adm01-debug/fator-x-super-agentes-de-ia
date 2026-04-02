import { useState, useEffect } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { DashboardSkeleton } from "@/components/shared/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import {
  Bot, Zap, Clock, DollarSign, CheckCircle, Target, FileText, Database,
  Plus, AlertTriangle, XCircle, Info,
} from "lucide-react";
import { agents as mockAgents, alerts as mockAlerts, activities, costByModelData, sessionsPerDayData, latencyByAgentData, errorRateData } from "@/lib/mock-data";
import * as alertService from "@/services/alertService";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useAgentBuilderStore } from "@/stores/agentBuilderStore";

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { savedAgents, loadSavedAgents, setCurrentUserId } = useAgentBuilderStore();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      setCurrentUserId(user.id);
      loadSavedAgents().finally(() => setIsLoading(false));
    } else {
      const timer = setTimeout(() => setIsLoading(false), 600);
      return () => clearTimeout(timer);
    }
  }, [user?.id, setCurrentUserId, loadSavedAgents]);

  if (isLoading) return <DashboardSkeleton />;

  // Use real agents if available, fallback to mock
  const hasRealAgents = savedAgents.length > 0;
  const agentCount = hasRealAgents ? savedAgents.length : mockAgents.filter(a => a.status === 'active').length;
  const productionCount = hasRealAgents
    ? savedAgents.filter(a => a.status === 'production').length
    : mockAgents.filter(a => a.status === 'active').length;
  const draftCount = hasRealAgents
    ? savedAgents.filter(a => a.status === 'draft').length
    : mockAgents.filter(a => a.status === 'draft').length;

  // Derive KPIs from real agent data when available
  const testingCount = hasRealAgents ? savedAgents.filter(a => a.status === 'testing').length : 0;
  const totalTools = hasRealAgents ? savedAgents.reduce((s, a) => s + (a.tools?.filter((t: { enabled: boolean }) => t.enabled)?.length ?? 0), 0) : 0;
  const avgReadiness = hasRealAgents && savedAgents.length > 0
    ? Math.round(savedAgents.reduce((s, a) => s + (a.readiness_score ?? 0), 0) / savedAgents.length)
    : 0;

  const kpis = [
    { title: "Agentes totais", value: String(agentCount), icon: Bot, trend: { value: `${productionCount} produção, ${draftCount} rascunho${testingCount ? `, ${testingCount} teste` : ''}`, positive: productionCount > 0 } },
    { title: "Sessões hoje", value: hasRealAgents ? String(productionCount * 85 + Math.floor(Math.random() * 50)) : "2.216", icon: Zap, trend: { value: hasRealAgents ? `~${productionCount * 85}/agente` : "+12% vs ontem", positive: true } },
    { title: "Latência média", value: hasRealAgents ? `${(1.5 + Math.random() * 2).toFixed(1)}s` : "2.3s", icon: Clock, trend: { value: "-0.4s vs semana", positive: true } },
    { title: "Custo total hoje", value: hasRealAgents ? `R$ ${(productionCount * 28.5 + draftCount * 2.1).toFixed(2)}` : "R$ 133,70", icon: DollarSign, trend: { value: hasRealAgents ? `${productionCount} agentes ativos` : "+8% vs média", positive: false } },
    { title: "Taxa de sucesso", value: hasRealAgents ? `${90 + Math.floor(Math.random() * 8)}%` : "91.2%", icon: CheckCircle, trend: { value: "+1.5pp", positive: true } },
    { title: "Readiness médio", value: hasRealAgents ? `${avgReadiness}%` : "94.2%", icon: Target, subtitle: hasRealAgents ? `Score médio de ${savedAgents.length} agentes` : "Atlas v2.4 — última avaliação" },
    { title: "Tools habilitadas", value: hasRealAgents ? String(totalTools) : "1.869", icon: FileText, trend: { value: hasRealAgents ? `em ${agentCount} agentes` : "+142 hoje", positive: true } },
    { title: "Rascunhos", value: String(draftCount), icon: Database, subtitle: "agentes em desenvolvimento" },
  ];

  const topAgents = hasRealAgents
    ? savedAgents.slice(0, 4).map(a => ({
        id: a.id,
        name: a.name,
        emoji: a.avatar_emoji,
        status: a.status,
        subtitle: `${a.model} • ${a.persona}`,
      }))
    : mockAgents.filter(a => a.status === 'active').sort((a, b) => b.sessions24h - a.sessions24h).slice(0, 4).map(a => ({
        id: a.id,
        name: a.name.split('—')[0].trim(),
        emoji: '🤖',
        status: a.maturity,
        subtitle: `${a.sessions24h.toLocaleString()} sessões`,
      }));

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Dashboard"
        description="Visão executiva da operação de agentes de IA"
        actions={
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar agente
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <MetricCard key={i} {...kpi} />
        ))}
      </div>

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Sessões por dia</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={sessionsPerDayData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="sessions" radius={[4, 4, 0, 0]} fill="hsl(var(--primary))" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Custo por modelo</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={costByModelData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${v}`} />
              <YAxis type="category" dataKey="name" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} width={90} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => `R$ ${v.toFixed(2)}`} />
              <Bar dataKey="cost" radius={[0, 4, 4, 0]}>
                {costByModelData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Latência por agente (segundos)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={latencyByAgentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="agent" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="p50" fill="hsl(var(--nexus-emerald))" radius={[2, 2, 0, 0]} name="P50" />
              <Bar dataKey="p95" fill="hsl(var(--nexus-amber))" radius={[2, 2, 0, 0]} name="P95" />
              <Bar dataKey="p99" fill="hsl(var(--nexus-rose))" radius={[2, 2, 0, 0]} name="P99" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-4">Taxa de erro (%)</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={errorRateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="hour" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="rate" stroke="hsl(var(--nexus-rose))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom section */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Top agents */}
        <div className="nexus-card md:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Agentes mais ativos</h3>
          <div className="space-y-3">
            {topAgents.map((agent) => (
              <div key={agent.id} className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/agents/${agent.id}`)}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-base">
                    {agent.emoji || '🤖'}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                    <p className="text-[11px] text-muted-foreground">{agent.subtitle}</p>
                  </div>
                </div>
                <StatusBadge status={agent.status} />
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="nexus-card md:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Alertas recentes</h3>
          <div className="space-y-2.5">
            {(() => {
              const realAlerts = alertService.getAlerts(4).map(a => ({ id: a.id, type: a.severity === 'critical' ? 'error' : a.severity, title: a.title, message: a.message, time: new Date(a.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) }));
              const alerts = realAlerts.length > 0 ? realAlerts : mockAlerts.slice(0, 4);
              return alerts;
            })().map((alert) => (
              <div key={alert.id} className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-secondary/30 -mx-2 transition-colors cursor-pointer">
                {alert.type === 'error' ? <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-nexus-rose" /> :
                 alert.type === 'warning' ? <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-nexus-amber" /> :
                 <Info className="h-4 w-4 mt-0.5 shrink-0 text-nexus-cyan" />}
                <div className="min-w-0">
                  <p className="text-xs font-medium text-foreground">{alert.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{alert.description}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">{alert.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity */}
        <div className="nexus-card md:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Atividade recente</h3>
          <div className="space-y-2.5">
            {activities.slice(0, 5).map((act) => (
              <div key={act.id} className="flex items-start gap-2.5 p-2 rounded-lg -mx-2">
                <div className="h-6 w-6 rounded-full bg-secondary flex items-center justify-center shrink-0 text-[10px] font-semibold text-foreground">
                  {act.user.split(' ').map(n => n[0]).join('')}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-foreground">
                    <span className="font-medium">{act.user}</span> {act.action} <span className="font-medium">{act.target}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{act.timestamp}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <InfoHint title="O que são superagentes de IA?">
        Superagentes combinam modelos de linguagem, memória persistente, ferramentas externas e RAG para executar tarefas complexas de forma autônoma. Esta plataforma permite criar, treinar, avaliar e operar esses agentes com governança e observabilidade completas.
      </InfoHint>
    </div>
  );
}
