import { Loader2, Activity, CheckCircle, Clock, AlertTriangle, Target, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface HealthItem {
  id: string;
  name: string;
  type: string;
  freshness: string;
  daysSinceUpdate: number;
  docs?: number;
  status?: string;
}

interface HealthData {
  summary?: { fresh: number; aging: number; stale: number };
  chunks?: { done: number; pending: number; failed: number };
  gaps?: string[];
  items?: HealthItem[];
}

export function KnowledgeHealthTab() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['cerebro_health'],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('cerebro-brain', {
        body: { action: 'knowledge_health' },
      });
      if (error) throw error;
      return data as HealthData;
    },
  });

  const freshnessIcon = (f: string) => {
    if (f === 'fresh') return <CheckCircle className="h-3.5 w-3.5 text-nexus-emerald" />;
    if (f === 'aging') return <Clock className="h-3.5 w-3.5 text-nexus-amber" />;
    return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
  };

  const freshnessLabel = (f: string) => {
    if (f === 'fresh') return 'Atualizado';
    if (f === 'aging') return 'Envelhecendo';
    return 'Desatualizado';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Saúde do Conhecimento
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">Detecção de degradação, gaps e frescor dos dados</p>
        </div>
        <Button size="sm" variant="outline" onClick={() => refetch()} className="gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" /> Analisar
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-nexus-emerald">{data.summary?.fresh || 0}</p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><CheckCircle className="h-3 w-3" /> Atualizados</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-nexus-amber">{data.summary?.aging || 0}</p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Envelhecendo</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-destructive">{data.summary?.stale || 0}</p>
              <p className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><AlertTriangle className="h-3 w-3" /> Desatualizados</p>
            </div>
            <div className="nexus-card text-center py-3">
              <p className="text-lg font-bold text-primary">{data.chunks?.done || 0}</p>
              <p className="text-[11px] text-muted-foreground">Chunks embeddados</p>
              {((data.chunks?.pending ?? 0) > 0 || (data.chunks?.failed ?? 0) > 0) && (
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {(data.chunks?.pending ?? 0) > 0 && <span className="text-nexus-amber">{data.chunks?.pending} pendentes</span>}
                  {(data.chunks?.pending ?? 0) > 0 && (data.chunks?.failed ?? 0) > 0 && ' • '}
                  {(data.chunks?.failed ?? 0) > 0 && <span className="text-destructive">{data.chunks?.failed} falhas</span>}
                </p>
              )}
            </div>
          </div>

          {(data.gaps?.length ?? 0) > 0 && (
            <div className="nexus-card border-nexus-amber/30">
              <h4 className="text-xs font-semibold text-nexus-amber mb-2 flex items-center gap-1.5">
                <Target className="h-3.5 w-3.5" /> Gaps Identificados ({data.gaps?.length})
              </h4>
              <div className="space-y-1.5">
                {data.gaps?.map((g, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <AlertTriangle className="h-3 w-3 text-nexus-amber mt-0.5 shrink-0" />
                    <span>{g}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">📋 Inventário de Conhecimento ({data.items?.length || 0})</h4>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {data.items?.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/20">
                  {freshnessIcon(item.freshness)}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {item.type === 'knowledge_base' ? '📚 Base de Conhecimento' : '🤖 Agente'}
                      {item.docs != null && ` • ${item.docs} docs`}
                      {item.status && ` • ${item.status}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant="outline" className={`text-[11px] ${
                      item.freshness === 'fresh' ? 'border-nexus-emerald/30 text-nexus-emerald' :
                      item.freshness === 'aging' ? 'border-nexus-amber/30 text-nexus-amber' :
                      'border-destructive/30 text-destructive'
                    }`}>{freshnessLabel(item.freshness)}</Badge>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{item.daysSinceUpdate}d atrás</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
