import { Loader2, Network } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { invokeCerebroBrain } from "@/services/cerebroService";
import { useQuery } from "@tanstack/react-query";

export function OverviewTab() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['cerebro_stats'],
    queryFn: async () => {
      const data = await invokeCerebroBrain({ action: 'stats' });
      return data;
    },
  });

  const metrics = [
    { label: 'Agentes', value: stats?.agents ?? '—', icon: '🤖', color: 'text-primary' },
    { label: 'Bases de Conhecimento', value: stats?.knowledge_bases ?? '—', icon: '📚', color: 'text-nexus-emerald' },
    { label: 'Chunks RAG', value: stats?.chunks ?? '—', icon: '🧩', color: 'text-cyan-400' },
    { label: 'Memórias', value: stats?.memories ?? '—', icon: '💾', color: 'text-nexus-purple' },
    { label: 'Ferramentas', value: stats?.tools ?? '—', icon: '🔧', color: 'text-nexus-amber' },
    { label: 'Workflows', value: stats?.workflows ?? '—', icon: '🔄', color: 'text-primary' },
    { label: 'Traces (total)', value: stats?.traces ?? '—', icon: '📊', color: 'text-nexus-rose' },
    { label: 'Consultas hoje', value: stats?.today_traces ?? '—', icon: '🔍', color: 'text-teal-400' },
  ];

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map(m => (
              <div key={m.label} className="nexus-card text-center py-4">
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className={`text-xl font-heading font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> Arquitetura de Memória
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: '💾', title: 'Memória Semântica', desc: 'Embeddings vetoriais de documentos e conhecimento', status: 'active' },
                { icon: '🕸️', title: 'Grafo de Conhecimento', desc: 'Relações entre agentes, KBs, ferramentas e workflows', status: 'active' },
                { icon: '🔄', title: 'Sync Contínuo', desc: 'Atualização automática via Edge Functions', status: 'active' },
              ].map(l => (
                <div key={l.title} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{l.icon}</span>
                    <span className="text-xs font-semibold text-foreground">{l.title}</span>
                    <Badge variant="outline" className="text-[11px] ml-auto border-nexus-emerald/30 text-nexus-emerald">Ativo</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{l.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
