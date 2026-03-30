import { useState, useEffect } from "react";
import { MetricCard } from "@/components/shared/MetricCard";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { DashboardSkeleton } from "@/components/shared/DashboardSkeleton";
import { Button } from "@/components/ui/button";
import {
  Bot, Zap, Clock, DollarSign, CheckCircle, Target, FileText, Database,
  Plus, ArrowRight, AlertTriangle, XCircle, Info,
} from "lucide-react";
import { agents, alerts, activities, costByModelData, sessionsPerDayData, latencyByAgentData, errorRateData } from "@/lib/mock-data";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, CartesianGrid, Cell } from "recharts";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const kpis = [
  { title: "Agentes ativos", value: "4", icon: Bot, trend: { value: "+1 esta semana", positive: true } },
  { title: "Sessões hoje", value: "2.216", icon: Zap, trend: { value: "+12% vs ontem", positive: true } },
  { title: "Latência média", value: "2.3s", icon: Clock, trend: { value: "-0.4s vs semana", positive: true } },
  { title: "Custo total hoje", value: "R$ 133,70", icon: DollarSign, trend: { value: "+8% vs média", positive: false } },
  { title: "Taxa de sucesso", value: "91.2%", icon: CheckCircle, trend: { value: "+1.5pp", positive: true } },
  { title: "Precisão (eval)", value: "94.2%", icon: Target, subtitle: "Atlas v2.4 — última avaliação" },
  { title: "Documentos indexados", value: "1.869", icon: FileText, trend: { value: "+142 hoje", positive: true } },
  { title: "Vetores armazenados", value: "32.150", icon: Database, subtitle: "12.4 GB utilizados" },
];

export default function DashboardPage() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);

  // Simulate data loading
  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  if (isLoading) return <DashboardSkeleton />;

  const topAgents = agents.filter(a => a.status === 'active').sort((a, b) => b.sessions24h - a.sessions24h);

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
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="nexus-card">
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
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="nexus-card">
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
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="nexus-card">
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
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="nexus-card">
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
        </motion.div>
      </div>

      {/* Bottom section */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Top agents */}
        <div className="nexus-card md:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Agentes mais ativos</h3>
          <div className="space-y-3">
            {topAgents.slice(0, 4).map((agent) => (
              <div key={agent.id} className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/agents/${agent.id}`)}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{agent.name.split('—')[0].trim()}</p>
                    <p className="text-[11px] text-muted-foreground">{agent.sessions24h.toLocaleString()} sessões</p>
                  </div>
                </div>
                <StatusBadge status={agent.maturity} />
              </div>
            ))}
          </div>
        </div>

        {/* Alerts */}
        <div className="nexus-card md:col-span-1">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Alertas recentes</h3>
          <div className="space-y-2.5">
            {alerts.slice(0, 4).map((alert) => (
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
