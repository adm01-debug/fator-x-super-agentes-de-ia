import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, GitCompare } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { VersionDiffDialog } from "@/components/agents/VersionDiffDialog";
// Self-Evolution: available via agentEvolutionService (getSkillbook, buildSkillbookPrompt)

export default function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['agent', id],
    queryFn: async () => {
      const { data, error } = await supabase.from('agents').select('*').eq('id', id!).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  if (!agent || error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center">
        <Bot className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-semibold text-foreground mb-1">Agente não encontrado</h2>
        <p className="text-sm text-muted-foreground mb-4">O agente pode ter sido removido.</p>
        <Button onClick={() => navigate('/agents')}>Voltar para agentes</Button>
      </div>
    );
  }

  return (
    <div className="p-6 sm:p-8 lg:p-10 space-y-6 max-w-[1400px] mx-auto animate-page-enter">
      <PageHeader
        title={agent.name}
        description={agent.mission || 'Sem descrição'}
        backTo="/agents"
        actions={
          <Button variant="outline" size="sm" onClick={() => navigate(`/builder/${agent.id}`)}>
            Editar no Builder
          </Button>
        }
      />

      <div className="flex items-center gap-4">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
          {agent.avatar_emoji || '🤖'}
        </div>
        <div>
          <div className="flex items-center gap-2.5">
            <StatusBadge status={agent.status || 'draft'} />
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span>{agent.model}</span>
            <span>•</span>
            <span>{agent.persona}</span>
            <span>•</span>
            <span>v{agent.version}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Configuração</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="text-foreground">{agent.model}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Persona</span><span className="text-foreground">{agent.persona}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Raciocínio</span><span className="text-foreground">{agent.reasoning}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Versão</span><span className="text-foreground">v{agent.version}</span></div>
          </div>
        </div>
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Tags</h3>
          <div className="flex flex-wrap gap-1.5">
            {(agent.tags ?? []).map(tag => (
              <span key={tag} className="nexus-badge-primary">{tag}</span>
            ))}
            {(agent.tags ?? []).length === 0 && <p className="text-xs text-muted-foreground">Nenhuma tag</p>}
          </div>
        </div>
      </div>

      {/* Agent Metrics */}
      <AgentMetrics agentId={id!} />
      <VersionHistory agentId={id!} />
    </div>
  );
}

function AgentMetrics({ agentId }: { agentId: string }) {
  const { data: traces = [] } = useQuery({
    queryKey: ['agent_detail_traces', agentId],
    queryFn: async () => {
      const { data } = await supabase.from('agent_traces').select('latency_ms, tokens_used, cost_usd, level, created_at').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50);
      return data ?? [];
    },
  });

  const { data: usage = [] } = useQuery({
    queryKey: ['agent_detail_usage', agentId],
    queryFn: async () => {
      const sevenDays = new Date(); sevenDays.setDate(sevenDays.getDate() - 7);
      const { data } = await supabase.from('agent_usage').select('*').eq('agent_id', agentId).gte('date', sevenDays.toISOString().split('T')[0]).order('date');
      return data ?? [];
    },
  });

  const { data: recentAlerts = [] } = useQuery({
    queryKey: ['agent_detail_alerts', agentId],
    queryFn: async () => {
      const { data } = await supabase.from('alerts').select('title, severity, created_at, is_resolved').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(5);
      return data ?? [];
    },
  });

  const totalRequests = usage.reduce((s, u) => s + (u.requests || 0), 0);
  const totalCost = usage.reduce((s, u) => s + (u.total_cost_usd || 0), 0);
  const avgLatency = traces.length > 0 ? Math.round(traces.reduce((s, t) => s + (t.latency_ms || 0), 0) / traces.length) : 0;
  const errorRate = traces.length > 0 ? traces.filter(t => t.level === 'error' || t.level === 'critical').length / traces.length : 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="nexus-card text-center">
          <p className="text-lg font-bold text-foreground">{totalRequests}</p>
          <p className="text-[11px] text-muted-foreground">Requests (7d)</p>
        </div>
        <div className="nexus-card text-center">
          <p className="text-lg font-bold text-foreground">${totalCost.toFixed(4)}</p>
          <p className="text-[11px] text-muted-foreground">Custo (7d)</p>
        </div>
        <div className="nexus-card text-center">
          <p className="text-lg font-bold text-foreground">{avgLatency}ms</p>
          <p className="text-[11px] text-muted-foreground">Latência média</p>
        </div>
        <div className="nexus-card text-center">
          <p className={`text-lg font-bold ${errorRate > 0.1 ? 'text-destructive' : 'text-nexus-emerald'}`}>{(errorRate * 100).toFixed(1)}%</p>
          <p className="text-[11px] text-muted-foreground">Taxa de erro</p>
        </div>
      </div>

      {traces.length > 0 && (
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Traces Recentes</h3>
          <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
            {traces.slice(0, 10).map(t => (
              <div key={t.created_at} className="flex items-center gap-3 text-xs py-1">
                <span className="text-muted-foreground font-mono text-[11px] w-[70px] shrink-0">{new Date(t.created_at).toLocaleTimeString('pt-BR')}</span>
                <span className={`w-2 h-2 rounded-full shrink-0 ${t.level === 'error' ? 'bg-destructive' : t.level === 'warning' ? 'bg-nexus-amber' : 'bg-nexus-emerald'}`} />
                <span className="text-foreground">{t.tokens_used || 0}t</span>
                <span className="text-muted-foreground">{t.latency_ms || 0}ms</span>
                <span className="text-muted-foreground ml-auto">${(t.cost_usd || 0).toFixed(6)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {recentAlerts.length > 0 && (
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Alertas</h3>
          {recentAlerts.map((a, i) => (
            <div key={i} className="flex items-center gap-2 text-xs py-1">
              <span className={`w-2 h-2 rounded-full shrink-0 ${a.severity === 'critical' ? 'bg-destructive' : 'bg-nexus-amber'}`} />
              <span className="text-foreground">{a.title}</span>
              {a.is_resolved && <span className="text-nexus-emerald text-[11px]">✓ resolvido</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function VersionHistory({ agentId }: { agentId: string }) {
  const [diffOpen, setDiffOpen] = useState(false);
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['agent_versions', agentId],
    queryFn: async () => {
      const { data } = await supabase.from('agent_versions').select('*').eq('agent_id', agentId).order('version', { ascending: false }).limit(20);
      return data ?? [];
    },
  });

  if (isLoading || versions.length === 0) return null;

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Histórico de Versões</h3>
        {versions.length >= 2 && (
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setDiffOpen(true)}>
            <GitCompare className="h-3 w-3" /> Comparar
          </Button>
        )}
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {versions.map((v, i) => (
          <div key={v.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'}`}>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-foreground">v{v.version}</span>
              <span className="text-muted-foreground">{v.model}</span>
              {v.change_summary && <span className="text-muted-foreground truncate max-w-[200px]">{v.change_summary}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px]">{new Date(v.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        ))}
      </div>
      <VersionDiffDialog open={diffOpen} onOpenChange={setDiffOpen} agentId={agentId} versions={versions as Array<{ id: string; version: number; model: string | null; persona: string | null; mission: string | null; config: Record<string, unknown>; change_summary: string | null; created_at: string }>} />
    </div>
  );
}
