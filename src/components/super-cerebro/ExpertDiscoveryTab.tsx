import { Loader2, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { invokeCerebroBrain } from "@/services/cerebroService";
import { useQuery } from "@tanstack/react-query";

interface Expert {
  id: string;
  type: string;
  name: string;
  emoji: string;
  mission?: string;
  domains?: string[];
  hasRAG?: boolean;
  toolCount?: number;
  status?: string;
}

export function ExpertDiscoveryTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['cerebro_experts'],
    queryFn: async () => {
      const data = await invokeCerebroBrain({ action: 'expert_discovery' });
      return (data?.experts || []) as Expert[];
      return (data?.experts || []) as Expert[];
    },
  });

  const agents = (data || []).filter(e => e.type === 'agent');
  const humans = (data || []).filter(e => e.type === 'human');

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" /> Descoberta de Especialistas
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">Descubra quem (agente ou humano) sabe o quê na organização</p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">🤖 Agentes Especialistas ({agents.length})</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {agents.map(expert => (
                <div key={expert.id} className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">{expert.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">{expert.name}</p>
                      {expert.mission && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{expert.mission}</p>}
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {expert.domains?.map((d, i) => (
                          <Badge key={i} variant="outline" className="text-[8px] px-1.5">{d}</Badge>
                        ))}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-[11px] text-muted-foreground">
                        {expert.hasRAG && <span className="text-nexus-emerald">📚 RAG</span>}
                        {(expert.toolCount ?? 0) > 0 && <span className="text-nexus-amber">🔧 {expert.toolCount}</span>}
                        <span className="capitalize">{expert.status}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {agents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum agente criado ainda</p>}
            </div>
          </div>

          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">👤 Equipe ({humans.length})</h4>
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {humans.map(expert => (
                <div key={expert.id} className="p-3 rounded-lg bg-secondary/30 border border-border/20">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{expert.emoji}</span>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-foreground">{expert.name}</p>
                      <div className="flex gap-1 mt-1">
                        {expert.domains?.map((d, i) => (
                          <Badge key={i} variant="outline" className="text-[8px] px-1.5 capitalize">{d}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {humans.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nenhum membro no workspace</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
