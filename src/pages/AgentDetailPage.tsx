import { useParams, useNavigate } from "react-router-dom";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { Bot, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
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
    </div>
  );
}
