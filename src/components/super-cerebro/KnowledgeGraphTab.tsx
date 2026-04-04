import { Loader2, Network, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  emoji?: string;
  status?: string;
  docs?: number;
  chunks?: number;
  toolType?: string;
  enabled?: boolean;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

export function KnowledgeGraphTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cerebro_graph'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'knowledge_graph' },
      });
      if (error) throw error;
      return data as { nodes: GraphNode[]; edges: GraphEdge[] };
    },
  });

  const nodesByType = (type: string) => data?.nodes?.filter(n => n.type === type) || [];
  const typeConfig: Record<string, { emoji: string; label: string; color: string }> = {
    agent: { emoji: '🤖', label: 'Agentes', color: 'border-primary/50 bg-primary/5' },
    knowledge_base: { emoji: '📚', label: 'Bases de Conhecimento', color: 'border-nexus-emerald/50 bg-nexus-emerald/5' },
    tool: { emoji: '🔧', label: 'Ferramentas', color: 'border-nexus-amber/50 bg-nexus-amber/5' },
    workflow: { emoji: '🔄', label: 'Workflows', color: 'border-cyan-500/50 bg-cyan-500/5' },
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" /> Grafo de Conhecimento
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Mapa visual de entidades e suas relações no ecossistema</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(typeConfig).map(([type, cfg]) => (
              <div key={type} className={`nexus-card text-center py-3 border ${cfg.color}`}>
                <p className="text-xl mb-1">{cfg.emoji}</p>
                <p className="text-lg font-bold text-foreground">{nodesByType(type).length}</p>
                <p className="text-[11px] text-muted-foreground">{cfg.label}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {Object.entries(typeConfig).map(([type, cfg]) => {
              const nodes = nodesByType(type);
              if (nodes.length === 0) return null;
              return (
                <div key={type} className="nexus-card">
                  <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-1.5">
                    {cfg.emoji} {cfg.label} ({nodes.length})
                  </h4>
                  <div className="space-y-2 max-h-[200px] overflow-y-auto">
                    {nodes.map(n => (
                      <div key={n.id} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30 border border-border/20">
                        <span className="text-sm">{n.emoji || cfg.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{n.label}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {n.status && <span className="capitalize">{n.status}</span>}
                            {n.docs != null && ` • ${n.docs} docs`}
                            {n.chunks != null && ` • ${n.chunks} chunks`}
                            {n.toolType && ` • ${n.toolType}`}
                            {n.enabled === false && ' • Desabilitado'}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {data?.edges && data.edges.length > 0 && (
            <div className="nexus-card">
              <h4 className="text-xs font-semibold text-foreground mb-3">🔗 Relações ({data.edges.length})</h4>
              <div className="space-y-1.5 max-h-[150px] overflow-y-auto">
                {data.edges.map((e, i) => {
                  const source = data.nodes?.find(n => n.id === e.source);
                  const target = data.nodes?.find(n => n.id === e.target);
                  return (
                    <div key={i} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="text-foreground font-medium">{source?.label || '?'}</span>
                      <span className="text-primary">→ {e.label} →</span>
                      <span className="text-foreground font-medium">{target?.label || '?'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
