import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Bot, Loader2, GitCompare, GitBranch, Activity, Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAgentById, getAgentVersions } from "@/services/agentsService";
import { VersionDiffDialog } from "@/components/agents/VersionDiffDialog";
import { AgentCardViewer } from "@/components/agents/AgentCardViewer";
import { AgentRichMetrics } from "@/components/agents/detail/AgentRichMetrics";

export default function AgentDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: agent, isLoading, error } = useQuery({
    queryKey: ['agent', id],
    queryFn: () => getAgentById(id!),
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
          <div className="flex items-center gap-2">
            <AgentCardViewer agentId={agent.id} agentName={agent.name} />
            <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${agent.id}/traces`)}>
              <Activity className="h-3.5 w-3.5 mr-1.5" /> Ver traces
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/agents/${agent.id}/alerts`)}>
              <Bell className="h-3.5 w-3.5 mr-1.5" /> Alertas
            </Button>
            <Button variant="outline" size="sm" onClick={() => navigate(`/builder/${agent.id}`)}>
              Editar no Builder
            </Button>
          </div>
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
            <span>{String(agent.model ?? '')}</span>
            <span>•</span>
            <span>{String(agent.persona ?? '')}</span>
            <span>•</span>
            <span>v{String(agent.version ?? '')}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="nexus-card">
          <h3 className="text-sm font-heading font-semibold text-foreground mb-3">Configuração</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-muted-foreground">Modelo</span><span className="text-foreground">{String(agent.model ?? '')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Persona</span><span className="text-foreground">{String(agent.persona ?? '')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Raciocínio</span><span className="text-foreground">{String(agent.reasoning ?? '')}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Versão</span><span className="text-foreground">v{String(agent.version ?? '')}</span></div>
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

      {/* Agent Metrics — rich panel with charts, SLO and daily history */}
      <AgentRichMetrics agentId={id!} days={14} />
      <VersionHistory agentId={id!} />
    </div>
  );
}

function VersionHistory({ agentId }: { agentId: string }) {
  const navigate = useNavigate();
  const [diffOpen, setDiffOpen] = useState(false);
  const { data: versions = [], isLoading } = useQuery({
    queryKey: ['agent_versions', agentId],
    queryFn: () => getAgentVersions(agentId, 20),
  });

  if (isLoading || versions.length === 0) return null;

  return (
    <div className="nexus-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-heading font-semibold text-foreground">Histórico de Versões</h3>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-7" onClick={() => navigate(`/agents/${agentId}/versions`)}>
            <GitBranch className="h-3 w-3" /> Gerenciar versões
          </Button>
          {versions.length >= 2 && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" onClick={() => setDiffOpen(true)}>
              <GitCompare className="h-3 w-3" /> Comparar
            </Button>
          )}
        </div>
      </div>
      <div className="space-y-2 max-h-[250px] overflow-y-auto">
        {versions.map((v, i) => (
          <div key={v.id} className={`flex items-center justify-between py-2 px-3 rounded-lg text-xs ${i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-secondary/30'}`}>
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-foreground">v{v.version}</span>
              <span className="text-muted-foreground">{String(v.model ?? '')}</span>
              {v.change_summary && <span className="text-muted-foreground truncate max-w-[200px]">{String(v.change_summary)}</span>}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-[11px]">{new Date(v.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        ))}
      </div>
      <VersionDiffDialog open={diffOpen} onOpenChange={setDiffOpen} agentId={agentId} versions={versions as unknown as Array<{ id: string; version: number; model: string | null; persona: string | null; mission: string | null; config: Record<string, unknown>; change_summary: string | null; created_at: string }>} />
    </div>
  );
}
