import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoHint } from "@/components/shared/InfoHint";
import { Button } from "@/components/ui/button";
import { Bot, Plus, ArrowRight, Loader2, TrendingUp, DollarSign, Clock, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { UsageCharts } from "@/components/dashboard/UsageCharts";

export default function DashboardPage() {
  const navigate = useNavigate();

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

  const { data: usageData = [] } = useQuery({
    queryKey: ['dashboard_usage'],
    queryFn: async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const { data } = await supabase
        .from('agent_usage')
        .select('*')
        .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);
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

      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : agents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">⚡</div>
          <h2 className="text-xl font-heading font-bold text-foreground mb-2">Bem-vindo ao Fator X Studio!</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-md">
            Crie, configure, avalie e opere agentes de IA com governança completa. Comece criando seu primeiro agente.
          </p>
          <Button onClick={() => navigate('/agents/new')} className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90">
            <Plus className="h-4 w-4" /> Criar seu primeiro agente
          </Button>
          <div className="grid md:grid-cols-3 gap-4 mt-10 w-full max-w-2xl">
            {[
              { emoji: '🧠', title: 'Super Cérebro', desc: 'Memória centralizada para toda a empresa', path: '/brain' },
              { emoji: '🔮', title: 'Oráculo', desc: 'Conselho de múltiplas IAs para melhores respostas', path: '/oracle' },
              { emoji: '🛡️', title: 'Guardrails', desc: 'Segurança e compliance em tempo real', path: '/security' },
            ].map(card => (
              <div key={card.title} className="nexus-card text-center cursor-pointer hover:border-primary/30 transition-colors" onClick={() => navigate(card.path)}>
                <div className="text-3xl mb-2">{card.emoji}</div>
                <h3 className="text-sm font-semibold text-foreground">{card.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-1">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="nexus-card text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-heading font-bold text-foreground">{agents.length}</p>
              <p className="text-[11px] text-muted-foreground">Total de agentes</p>
            </div>
            <div className="nexus-card text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <Zap className="h-4 w-4 text-nexus-emerald" />
              </div>
              <p className="text-2xl font-heading font-bold text-nexus-emerald">{activeCount}</p>
              <p className="text-[11px] text-muted-foreground">Em produção</p>
            </div>
            <div className="nexus-card text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <DollarSign className="h-4 w-4 text-nexus-amber" />
              </div>
              <p className="text-2xl font-heading font-bold text-foreground">
                {usageStats ? `$${usageStats.totalCost.toFixed(2)}` : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">Custo (30d)</p>
            </div>
            <div className="nexus-card text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              <p className="text-2xl font-heading font-bold text-foreground">
                {usageStats ? usageStats.totalRequests.toLocaleString() : '—'}
              </p>
              <p className="text-[11px] text-muted-foreground">Requests (30d)</p>
            </div>
          </div>

          {/* Additional metrics row */}
          {usageStats && (
            <div className="grid grid-cols-3 gap-3">
              <div className="nexus-card py-3 text-center">
                <p className="text-sm font-heading font-bold text-foreground">{usageStats.avgLatency}ms</p>
                <p className="text-[10px] text-muted-foreground">Latência média</p>
              </div>
              <div className="nexus-card py-3 text-center">
                <p className="text-sm font-heading font-bold text-foreground">{(usageStats.totalTokens / 1000).toFixed(0)}k</p>
                <p className="text-[10px] text-muted-foreground">Tokens totais</p>
              </div>
              <div className="nexus-card py-3 text-center">
                <p className="text-sm font-heading font-bold text-foreground">{draftCount}</p>
                <p className="text-[10px] text-muted-foreground">Rascunhos</p>
              </div>
            </div>
          )}

          {/* Analytics Charts */}
          <UsageCharts data={usageData} />

            <div className="grid lg:grid-cols-2 gap-4">
            <div className="nexus-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Agentes recentes</h3>
              <div className="space-y-3">
                {agents.slice(0, 5).map(agent => (
                  <div key={agent.id} className="flex items-center justify-between cursor-pointer hover:bg-secondary/30 rounded-lg p-2 -mx-2 transition-colors" onClick={() => navigate(`/builder/${agent.id}`)}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-sm">{agent.avatar_emoji || '🤖'}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{agent.name}</p>
                        <p className="text-[11px] text-muted-foreground">{agent.model} • v{agent.version}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={agent.status || 'draft'} />
                      <ArrowRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Recent traces */}
            <div className="nexus-card">
              <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Atividade recente</h3>
              {recentTraces.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Nenhuma atividade registrada. Traces aparecerão quando agentes estiverem em uso.</p>
              ) : (
                <div className="space-y-2">
                  {recentTraces.map(trace => (
                    <div key={trace.id} className="flex items-center justify-between p-2 -mx-2 rounded-lg hover:bg-secondary/30 cursor-pointer" onClick={() => navigate('/monitoring')}>
                      <div className="flex items-center gap-2.5">
                        <StatusBadge status={trace.level || 'info'} />
                        <div>
                          <p className="text-xs font-medium text-foreground">{trace.event}</p>
                          <p className="text-[10px] text-muted-foreground">{new Date(trace.created_at).toLocaleString('pt-BR')}</p>
                        </div>
                      </div>
                      {trace.latency_ms && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" />{(trace.latency_ms / 1000).toFixed(1)}s</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <InfoHint title="O que são superagentes de IA?">
        Superagentes combinam modelos de linguagem, memória persistente, ferramentas externas e RAG para executar tarefas complexas de forma autônoma. Esta plataforma permite criar, treinar, avaliar e operar esses agentes com governança e observabilidade completas.
      </InfoHint>
    </div>
  );
}
