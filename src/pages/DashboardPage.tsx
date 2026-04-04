import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { AnimatedCounter } from "@/components/shared/AnimatedCounter";
import { DateRangePicker, getDateRangeDays, type DateRange } from "@/components/dashboard/DateRangePicker";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowRight, TrendingUp, DollarSign, Clock, Zap, Sparkles, BookOpen, Activity, GitBranch } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UsageCharts } from "@/components/dashboard/UsageCharts";


// ═══ Dashboard Skeleton ═══
function DashboardLoadingSkeleton() {
  return (
    <div className="p-4 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto" aria-busy="true" aria-label="Carregando dashboard">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <div className="h-7 w-40 rounded-md skeleton-shimmer" />
          <div className="h-4 w-64 rounded-md skeleton-shimmer" />
        </div>
        <div className="h-10 w-36 rounded-lg skeleton-shimmer" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="nexus-card text-center space-y-2" style={{ animationDelay: `${i * 100}ms` }}>
            <div className="h-8 w-8 mx-auto rounded-lg skeleton-shimmer" />
            <div className="h-7 w-16 mx-auto rounded skeleton-shimmer" />
            <div className="h-3 w-20 mx-auto rounded skeleton-shimmer" />
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="nexus-card space-y-3">
            <div className="h-4 w-32 rounded skeleton-shimmer" />
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg skeleton-shimmer shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-3/4 rounded skeleton-shimmer" />
                  <div className="h-2.5 w-1/2 rounded skeleton-shimmer" />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [dateRange, setDateRange] = useState<DateRange>('30d');

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agents')
        .select('id, name, mission, avatar_emoji, status, model, tags, version, updated_at')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const days = getDateRangeDays(dateRange);

  const { data: usageData = [] } = useQuery({
    queryKey: ['dashboard_usage', dateRange],
    queryFn: async () => {
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - days);
      const { data } = await supabase
        .from('agent_usage')
        .select('*')
        .gte('date', fromDate.toISOString().split('T')[0]);
      return data ?? [];
    },
  });

  const usageStats = usageData.length ? {
    totalCost: usageData.reduce((s, u) => s + Number(u.total_cost_usd || 0), 0),
    totalRequests: usageData.reduce((s, u) => s + (u.requests || 0), 0),
    avgLatency: Math.round(usageData.reduce((s, u) => s + (u.avg_latency_ms || 0), 0) / usageData.length),
    totalTokens: usageData.reduce((s, u) => s + (u.tokens_input || 0) + (u.tokens_output || 0), 0),
  } : null;

  const { data: recentTraces = [] } = useQuery({
    queryKey: ['dashboard_traces'],
    queryFn: async () => {
      const { data } = await supabase.from('agent_traces').select('id, event, level, latency_ms, created_at').order('created_at', { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const activeCount = agents.filter(a => a.status === 'production' || a.status === 'monitoring').length;
  const draftCount = agents.filter(a => a.status === 'draft').length;

  // Contextual greeting with user name
  const getGreeting = () => {
    const hour = new Date().getHours();
    const name = user?.email?.split('@')[0] || '';
    const prefix = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
    return name ? `${prefix}, ${name}` : prefix;
  };

  // Smart summary
  const getSummary = () => {
    if (agents.length === 0) return null;
    const parts: string[] = [];
    if (activeCount > 0) parts.push(`${activeCount} agente${activeCount > 1 ? 's' : ''} em produção`);
    if (draftCount > 0) parts.push(`${draftCount} rascunho${draftCount > 1 ? 's' : ''}`);
    if (usageStats) {
      parts.push(`$${usageStats.totalCost.toFixed(2)} de custo nos últimos ${days} dias`);
      if (usageStats.avgLatency > 0) parts.push(`latência média de ${usageStats.avgLatency}ms`);
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  };

  if (isLoading) return <DashboardLoadingSkeleton />;

  const summary = getSummary();

  return (
    <div className="p-4 sm:p-8 lg:p-10 space-y-5 sm:space-y-6 max-w-[1400px] mx-auto" role="main" aria-label="Dashboard principal">
      <div className="space-y-1">
        <PageHeader
          title={`${getGreeting()} 👋`}
          description="Visão executiva da operação de agentes de IA"
          actions={agents.length > 0 ? (
            <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90 min-h-[44px]">
              <Plus className="h-4 w-4" aria-hidden="true" /> Criar agente
            </Button>
          ) : undefined}
        />
        {summary && (
          <div className="flex items-center gap-2 mt-2">
            <Zap className="h-3.5 w-3.5 text-primary shrink-0" aria-hidden="true" />
            <p className="text-xs text-muted-foreground">{summary}</p>
          </div>
        )}
      </div>

      {agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 sm:py-20 text-center px-4">
          <div className="text-5xl sm:text-6xl mb-4" aria-hidden="true">⚡</div>
          <h2 className="text-lg sm:text-xl font-heading font-bold text-foreground mb-2">Bem-vindo ao Fator X!</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Crie, configure, avalie e opere agentes de IA com governança completa. Comece criando seu primeiro agente.
          </p>
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90 min-h-[44px]">
            <Plus className="h-4 w-4" aria-hidden="true" /> Criar seu primeiro agente
          </Button>
          <div className="grid sm:grid-cols-3 gap-3 sm:gap-4 mt-8 sm:mt-10 w-full max-w-2xl stagger-children">
            {[
              { emoji: '🧠', title: 'Super Cérebro', desc: 'Memória centralizada para toda a empresa', path: '/brain', accent: 'border-nexus-purple/30 hover:border-nexus-purple/50', iconBg: 'bg-nexus-purple/10' },
              { emoji: '🔮', title: 'Oráculo', desc: 'Conselho de múltiplas IAs para melhores respostas', path: '/oracle', accent: 'border-nexus-cyan/30 hover:border-nexus-cyan/50', iconBg: 'bg-nexus-cyan/10' },
              { emoji: '🛡️', title: 'Guardrails', desc: 'Segurança e compliance em tempo real', path: '/security', accent: 'border-nexus-emerald/30 hover:border-nexus-emerald/50', iconBg: 'bg-nexus-emerald/10' },
            ].map(card => (
              <button
                key={card.title}
                className={`nexus-card text-center cursor-pointer transition-all min-h-[44px] w-full ${card.accent}`}
                onClick={() => navigate(card.path)}
                aria-label={`Navegar para ${card.title}: ${card.desc}`}
              >
                <div className={`inline-flex items-center justify-center h-12 w-12 rounded-xl ${card.iconBg} mb-3 mx-auto`}>
                  <span className="text-2xl" aria-hidden="true">{card.emoji}</span>
                </div>
                <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{card.desc}</p>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Quick Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { label: 'Novo Agente', icon: Plus, path: '/agents/new' },
              { label: 'Knowledge', icon: BookOpen, path: '/knowledge' },
              { label: 'Monitoring', icon: Activity, path: '/monitoring' },
              { label: 'Workflows', icon: GitBranch, path: '/workflows' },
            ].map(action => (
              <button
                key={action.label}
                onClick={() => navigate(action.path)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border/50 bg-card text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5 transition-all"
              >
                <action.icon className="h-3.5 w-3.5" />
                {action.label}
              </button>
            ))}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 stagger-children" role="region" aria-label="Métricas principais">
            {[
              { icon: Bot, color: "text-primary", bgColor: "bg-primary/10", value: agents.length, label: "Total de agentes", hint: `${draftCount} rascunhos`, tooltip: "Número total de agentes criados no workspace" },
              { icon: Zap, color: "text-nexus-emerald", bgColor: "bg-nexus-emerald/10", value: activeCount, label: "Em produção", hint: activeCount > 0 ? "Operando normalmente" : "Nenhum ativo", tooltip: "Agentes com status 'production' ou 'monitoring'" },
              { icon: DollarSign, color: "text-nexus-amber", bgColor: "bg-nexus-amber/10", value: usageStats?.totalCost ?? 0, label: "Custo (30d)", prefix: "$", decimals: 2, noData: !usageStats, hint: usageStats ? `${usageStats.totalRequests} requests` : undefined, tooltip: "Custo acumulado dos últimos 30 dias" },
              { icon: TrendingUp, color: "text-primary", bgColor: "bg-primary/10", value: usageStats?.totalRequests ?? 0, label: "Requests (30d)", noData: !usageStats, hint: usageStats ? `~${usageStats.avgLatency}ms latência` : undefined, tooltip: "Total de requisições processadas nos últimos 30 dias" },
            ].map((metric, i) => (
             <div
                key={metric.label}
                className="nexus-card nexus-metric-card text-center group"
                title={metric.tooltip}
              >
                <div className={`inline-flex items-center justify-center h-8 w-8 rounded-lg ${metric.bgColor} mb-2`}>
                  <metric.icon className={`h-4 w-4 ${metric.color}`} aria-hidden="true" />
                </div>
                <p className={`text-xl sm:text-2xl font-heading font-bold ${i === 1 ? "text-nexus-emerald" : "text-foreground"}`}>
                  {metric.noData ? '—' : (
                    <AnimatedCounter
                      value={metric.value}
                      prefix={metric.prefix}
                      decimals={metric.decimals}
                    />
                  )}
                </p>
                <p className="text-[11px] text-muted-foreground font-medium">{metric.label}</p>
                {metric.hint && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{metric.hint}</p>}
              </div>
            ))}
          </div>

          {/* Additional metrics row */}
          {usageStats && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3 stagger-children">
              <div className="nexus-card nexus-metric-card py-2.5 sm:py-3 text-center">
                <p className="text-xs sm:text-sm font-heading font-bold text-foreground">{usageStats.avgLatency}ms</p>
                <p className="text-[11px] sm:text-[11px] text-muted-foreground">Latência média</p>
              </div>
              <div className="nexus-card nexus-metric-card py-2.5 sm:py-3 text-center">
                <p className="text-xs sm:text-sm font-heading font-bold text-foreground">{(usageStats.totalTokens / 1000).toFixed(0)}k</p>
                <p className="text-[11px] sm:text-[11px] text-muted-foreground">Tokens totais</p>
              </div>
              <div className="nexus-card nexus-metric-card py-2.5 sm:py-3 text-center">
                <p className="text-xs sm:text-sm font-heading font-bold text-foreground">{draftCount}</p>
                <p className="text-[11px] sm:text-[11px] text-muted-foreground">Rascunhos</p>
              </div>
            </div>
          )}

          {/* Analytics Charts */}
          <div className="animate-chart-reveal">
            <UsageCharts data={usageData} />
          </div>

          <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
            <div className="nexus-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3" id="recent-agents-heading">Agentes recentes</h3>
              <div className="stagger-list" role="list" aria-labelledby="recent-agents-heading">
                {agents.slice(0, 5).map(agent => (
                  <div
                    key={agent.id}
                    role="listitem"
                    className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-h-[44px]"
                    onClick={() => navigate(`/builder/${agent.id}`)}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/builder/${agent.id}`)}
                    tabIndex={0}
                    aria-label={`Agente ${agent.name}, status ${agent.status || 'draft'}`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm shrink-0" aria-hidden="true">{agent.avatar_emoji || '🤖'}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                        <p className="text-[11px] text-muted-foreground">{agent.model} • v{agent.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={agent.status || 'draft'} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent traces */}
            <div className="nexus-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3" id="recent-traces-heading">Atividade recente</h3>
              {recentTraces.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade registrada. Traces aparecerão quando agentes estiverem em uso.</p>
              ) : (
                <div className="stagger-list" role="list" aria-labelledby="recent-traces-heading">
                  {recentTraces.map(trace => (
                    <div
                      key={trace.id}
                      role="listitem"
                      className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-secondary/30 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none min-h-[44px]"
                      onClick={() => navigate('/monitoring')}
                      onKeyDown={(e) => e.key === 'Enter' && navigate('/monitoring')}
                      tabIndex={0}
                      aria-label={`Evento ${trace.event}, nível ${trace.level || 'info'}`}
                    >
                      <div className="flex items-center gap-2.5">
                        <StatusBadge status={trace.level || 'info'} />
                        <div>
                          <p className="text-xs font-medium text-foreground">{trace.event}</p>
                          <p className="text-[11px] text-muted-foreground">
                            <time dateTime={trace.created_at}>{new Date(trace.created_at).toLocaleString('pt-BR')}</time>
                          </p>
                        </div>
                      </div>
                      {trace.latency_ms && (
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" aria-hidden="true" />{(trace.latency_ms / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* AI Insight */}
          <DashboardInsight agents={agents} usageStats={usageStats} recentTraces={recentTraces} />

          {/* Alerts */}
          <DashboardAlerts />
        </>
      )}

      <InfoHint title="O que são superagentes de IA?">
        Superagentes combinam modelos de linguagem, memória persistente, ferramentas externas e RAG para executar tarefas complexas de forma autônoma. Esta plataforma permite criar, treinar, avaliar e operar esses agentes com governança e observabilidade completas.
      </InfoHint>
    </div>
  );
}

function DashboardAlerts() {
  const navigate = useNavigate();
  const { data: alerts = [] } = useQuery({
    queryKey: ['dashboard_alerts'],
    queryFn: async () => {
      const { data } = await supabase.from('alerts').select('id, title, severity, created_at, is_resolved').eq('is_resolved', false).order('created_at', { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  if (alerts.length === 0) return null;

  return (
    <div className="nexus-card border-nexus-amber/20">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-nexus-amber animate-pulse" />
          Alertas Ativos ({alerts.length})
        </h3>
        <button onClick={() => navigate('/monitoring')} className="text-[11px] text-primary hover:underline">Ver todos</button>
      </div>
      <div className="space-y-2">
        {alerts.map(a => (
          <div key={a.id} className="flex items-center gap-2 text-xs py-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${a.severity === 'critical' ? 'bg-destructive' : 'bg-nexus-amber'}`} />
            <span className="text-foreground truncate">{a.title}</span>
            <span className="text-muted-foreground ml-auto shrink-0 text-[11px]">{new Date(a.created_at || '').toLocaleDateString('pt-BR')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface InsightProps {
  agents: Array<{ status: string | null; name: string }>;
  usageStats: { totalCost: number; totalRequests: number; avgLatency: number; totalTokens: number } | null;
  recentTraces: Array<{ level: string | null; event: string }>;
}

function DashboardInsight({ agents, usageStats, recentTraces }: InsightProps) {
  const insights: Array<{ icon: string; text: string; type: 'info' | 'warning' | 'success' }> = [];

  // Generate contextual insights
  const errorTraces = recentTraces.filter(t => t.level === 'error' || t.level === 'critical');
  if (errorTraces.length > 0) {
    insights.push({
      icon: '⚠️',
      text: `${errorTraces.length} erro${errorTraces.length > 1 ? 's' : ''} detectado${errorTraces.length > 1 ? 's' : ''} recentemente — verifique o Monitoring para detalhes.`,
      type: 'warning',
    });
  }

  if (usageStats && usageStats.avgLatency > 2000) {
    insights.push({
      icon: '🐢',
      text: `Latência média de ${usageStats.avgLatency}ms está acima do ideal. Considere otimizar prompts ou trocar de modelo.`,
      type: 'warning',
    });
  }

  const draftAgents = agents.filter(a => a.status === 'draft');
  if (draftAgents.length > 2) {
    insights.push({
      icon: '📝',
      text: `Você tem ${draftAgents.length} agentes em rascunho. Considere finalizá-los ou arquivar os que não serão usados.`,
      type: 'info',
    });
  }

  const productionAgents = agents.filter(a => a.status === 'production' || a.status === 'monitoring');
  if (productionAgents.length > 0 && errorTraces.length === 0) {
    insights.push({
      icon: '✅',
      text: `${productionAgents.length} agente${productionAgents.length > 1 ? 's' : ''} em produção operando sem erros. Tudo funcionando bem!`,
      type: 'success',
    });
  }

  if (usageStats && usageStats.totalCost > 50) {
    insights.push({
      icon: '💰',
      text: `Custo de $${usageStats.totalCost.toFixed(2)} nos últimos 30 dias. Confira o Billing para detalhes por agente.`,
      type: 'info',
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="nexus-card border-primary/10 bg-gradient-to-r from-card to-primary/[0.02]">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="text-sm font-heading font-semibold text-foreground">Insights da IA</h3>
      </div>
      <div className="space-y-2">
        {insights.slice(0, 3).map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
            <span className="shrink-0 mt-0.5" aria-hidden="true">{insight.icon}</span>
            <p>{insight.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
