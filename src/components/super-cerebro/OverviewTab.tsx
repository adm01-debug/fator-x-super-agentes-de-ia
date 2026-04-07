import { Loader2, Network, Activity, TrendingUp, Database, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { invokeCerebroBrain, getHealthScore } from "@/services/cerebroService";
import { useQuery } from "@tanstack/react-query";

interface CerebroStats {
  agents?: number;
  knowledge_bases?: number;
  chunks?: number;
  memories?: number;
  tools?: number;
  workflows?: number;
  traces?: number;
  today_traces?: number;
}

export function OverviewTab() {
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['cerebro_stats'],
    queryFn: async () => {
      const data = await invokeCerebroBrain({ action: 'stats' });
      return data as CerebroStats;
    },
  });

  const { data: health, isLoading: healthLoading } = useQuery({
    queryKey: ['cerebro_health'],
    queryFn: getHealthScore,
  });

  const isLoading = statsLoading || healthLoading;

  const metrics = [
    { label: 'Agentes', value: stats?.agents ?? 0, icon: '🤖', color: 'text-primary' },
    { label: 'Bases de Conhecimento', value: stats?.knowledge_bases ?? 0, icon: '📚', color: 'text-nexus-emerald' },
    { label: 'Chunks RAG', value: stats?.chunks ?? 0, icon: '🧩', color: 'text-cyan-400' },
    { label: 'Memórias', value: stats?.memories ?? 0, icon: '💾', color: 'text-nexus-purple' },
    { label: 'Ferramentas', value: stats?.tools ?? 0, icon: '🔧', color: 'text-nexus-amber' },
    { label: 'Workflows', value: stats?.workflows ?? 0, icon: '🔄', color: 'text-primary' },
    { label: 'Traces (total)', value: stats?.traces ?? 0, icon: '📊', color: 'text-nexus-rose' },
    { label: 'Consultas hoje', value: stats?.today_traces ?? 0, icon: '🔍', color: 'text-teal-400' },
  ];

  const healthScore = health?.score ?? 0;
  const healthColor =
    healthScore >= 80 ? 'text-nexus-emerald' :
    healthScore >= 60 ? 'text-nexus-amber' :
    healthScore >= 40 ? 'text-orange-500' :
    'text-destructive';
  const healthLabel =
    healthScore >= 80 ? 'Excelente' :
    healthScore >= 60 ? 'Saudável' :
    healthScore >= 40 ? 'Atenção' :
    'Crítico';

  return (
    <div className="space-y-4">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          {/* Health Score Hero */}
          <div className="nexus-card">
            <div className="flex items-center justify-between gap-6 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <svg width="80" height="80" viewBox="0 0 80 80" className="-rotate-90">
                    <circle cx="40" cy="40" r="34" stroke="currentColor" strokeWidth="6" fill="none" className="text-secondary/40" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      stroke="currentColor"
                      strokeWidth="6"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - healthScore / 100)}`}
                      className={healthColor}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className={`text-xl font-bold ${healthColor}`}>{healthScore}</span>
                  </div>
                </div>
                <div>
                  <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
                    <Activity className="h-4 w-4 text-primary" /> Health Score
                  </h3>
                  <p className={`text-xs font-medium mt-0.5 ${healthColor}`}>{healthLabel}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {health?.collections ?? 0} coleções · {health?.docs ?? 0} docs · {health?.chunks ?? 0} chunks
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-1.5 text-right">
                <Badge variant="outline" className="border-nexus-emerald/30 text-nexus-emerald gap-1">
                  <TrendingUp className="h-3 w-3" /> Cérebro online
                </Badge>
                <span className="text-[10px] text-muted-foreground">
                  {stats?.today_traces ?? 0} consultas nas últimas 24h
                </span>
              </div>
            </div>
          </div>

          {/* Metrics grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {metrics.map((m) => (
              <div key={m.label} className="nexus-card text-center py-4">
                <p className="text-2xl mb-1">{m.icon}</p>
                <p className={`text-xl font-heading font-bold ${m.color}`}>{m.value}</p>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>

          {/* Memory architecture */}
          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <Network className="h-4 w-4 text-primary" /> Arquitetura de Memória
            </h3>
            <div className="grid md:grid-cols-3 gap-3">
              {[
                { icon: '💾', title: 'Memória Semântica', desc: 'Embeddings vetoriais de documentos e conhecimento', count: stats?.chunks ?? 0, unit: 'chunks' },
                { icon: '🕸️', title: 'Grafo de Conhecimento', desc: 'Relações entre agentes, KBs, ferramentas e workflows', count: (stats?.agents ?? 0) + (stats?.knowledge_bases ?? 0) + (stats?.tools ?? 0) + (stats?.workflows ?? 0), unit: 'nós' },
                { icon: '🧠', title: 'Memórias Episódicas', desc: 'Histórico de interações e eventos por agente', count: stats?.memories ?? 0, unit: 'entradas' },
              ].map((l) => (
                <div key={l.title} className="p-3 rounded-lg bg-secondary/30 border border-border/30">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{l.icon}</span>
                    <span className="text-xs font-semibold text-foreground">{l.title}</span>
                    <Badge variant="outline" className="text-[10px] ml-auto border-nexus-emerald/30 text-nexus-emerald">Ativo</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mb-2">{l.desc}</p>
                  <p className="text-sm font-bold text-foreground">
                    {l.count.toLocaleString('pt-BR')} <span className="text-[10px] text-muted-foreground font-normal">{l.unit}</span>
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Quick insights */}
          <div className="nexus-card">
            <h3 className="text-sm font-heading font-semibold text-foreground mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-nexus-amber" /> Insights Rápidos
            </h3>
            <div className="grid md:grid-cols-2 gap-2">
              {(() => {
                const insights: Array<{ msg: string; type: 'good' | 'warn' | 'info' }> = [];
                if ((stats?.knowledge_bases ?? 0) === 0) {
                  insights.push({ msg: 'Nenhuma base de conhecimento criada ainda', type: 'warn' });
                } else if ((stats?.chunks ?? 0) === 0) {
                  insights.push({ msg: 'Bases criadas, mas sem documentos indexados', type: 'warn' });
                } else {
                  insights.push({ msg: `${stats?.chunks ?? 0} chunks indexados em ${stats?.knowledge_bases ?? 0} bases`, type: 'good' });
                }
                if ((stats?.agents ?? 0) === 0) {
                  insights.push({ msg: 'Nenhum agente criado — comece pela página Agentes', type: 'warn' });
                } else {
                  insights.push({ msg: `${stats?.agents ?? 0} agentes ativos no workspace`, type: 'good' });
                }
                if ((stats?.today_traces ?? 0) > 100) {
                  insights.push({ msg: `Alto volume hoje: ${stats?.today_traces ?? 0} consultas`, type: 'info' });
                }
                if ((stats?.memories ?? 0) > 0) {
                  insights.push({ msg: `Memórias episódicas: ${stats?.memories ?? 0}`, type: 'info' });
                }
                return insights.map((insight, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 p-2 rounded text-[11px] ${
                      insight.type === 'good' ? 'bg-nexus-emerald/10 border border-nexus-emerald/20 text-nexus-emerald' :
                      insight.type === 'warn' ? 'bg-nexus-amber/10 border border-nexus-amber/20 text-nexus-amber' :
                      'bg-primary/10 border border-primary/20 text-primary'
                    }`}
                  >
                    <Database className="h-3 w-3 shrink-0 mt-0.5" />
                    <span>{insight.msg}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
