import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  BarChart3,
  TrendingUp,
  DollarSign,
  Clock,
  Award,
  Activity,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchOracleHistory, type OracleHistoryEntry } from "@/lib/oracleHistory";
import { ORACLE_MODES, type OracleMode } from "@/stores/oracleStore";

interface ModeMetrics {
  mode: string;
  count: number;
  avg_confidence: number;
  avg_consensus: number;
  total_cost: number;
  avg_latency_s: number;
  total_tokens: number;
}

function aggregateByMode(history: OracleHistoryEntry[]): ModeMetrics[] {
  const byMode = new Map<string, OracleHistoryEntry[]>();
  for (const entry of history) {
    const key = entry.mode || 'unknown';
    if (!byMode.has(key)) byMode.set(key, []);
    byMode.get(key)!.push(entry);
  }

  const result: ModeMetrics[] = [];
  for (const [mode, entries] of byMode.entries()) {
    const validConf = entries.filter((e) => e.confidence_score != null);
    const validCons = entries.filter((e) => e.consensus_degree != null);
    result.push({
      mode,
      count: entries.length,
      avg_confidence:
        validConf.length > 0
          ? validConf.reduce((a, e) => a + (e.confidence_score ?? 0), 0) / validConf.length
          : 0,
      avg_consensus:
        validCons.length > 0
          ? validCons.reduce((a, e) => a + (e.consensus_degree ?? 0), 0) / validCons.length
          : 0,
      total_cost: entries.reduce((a, e) => a + (e.total_cost_usd ?? 0), 0),
      avg_latency_s:
        entries.reduce((a, e) => a + (e.total_latency_ms ?? 0), 0) / entries.length / 1000,
      total_tokens: entries.reduce((a, e) => a + (e.total_tokens ?? 0), 0),
    });
  }

  return result.sort((a, b) => b.count - a.count);
}

export function OracleAnalyticsPanel() {
  const { data: history = [], isLoading } = useQuery({
    queryKey: ['oracle-history-analytics'],
    queryFn: () => fetchOracleHistory({}),
  });

  const metrics = useMemo(() => aggregateByMode(history), [history]);

  const totals = useMemo(() => {
    const totalQueries = history.length;
    const totalCost = history.reduce((a, e) => a + (e.total_cost_usd ?? 0), 0);
    const avgConfidence =
      history.filter((e) => e.confidence_score != null).reduce((a, e) => a + (e.confidence_score ?? 0), 0) /
      Math.max(1, history.filter((e) => e.confidence_score != null).length);
    const avgLatencyS =
      history.reduce((a, e) => a + (e.total_latency_ms ?? 0), 0) / Math.max(1, history.length) / 1000;

    // Find best mode (highest avg confidence with at least 2 queries)
    const eligibleModes = metrics.filter((m) => m.count >= 2);
    const bestMode = eligibleModes.length > 0
      ? eligibleModes.reduce((max, m) => (m.avg_confidence > max.avg_confidence ? m : max))
      : null;

    return { totalQueries, totalCost, avgConfidence, avgLatencyS, bestMode };
  }, [history, metrics]);

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Oracle Analytics
        </h3>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          Métricas agregadas do histórico de consultas. Identifique o modo mais eficaz e o custo total acumulado.
        </p>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : history.length === 0 ? (
        <div className="nexus-card text-center py-12">
          <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum histórico de consulta disponível</p>
          <p className="text-[11px] text-muted-foreground/70 mt-1">
            Faça algumas consultas no Oráculo para ver as métricas aqui
          </p>
        </div>
      ) : (
        <>
          {/* Top stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="nexus-card text-center py-3">
              <Activity className="h-4 w-4 mx-auto text-primary mb-1" />
              <p className="text-xl font-bold text-primary">{totals.totalQueries}</p>
              <p className="text-[10px] text-muted-foreground">Consultas Totais</p>
            </div>
            <div className="nexus-card text-center py-3">
              <DollarSign className="h-4 w-4 mx-auto text-nexus-emerald mb-1" />
              <p className="text-xl font-bold text-nexus-emerald">${totals.totalCost.toFixed(4)}</p>
              <p className="text-[10px] text-muted-foreground">Custo Acumulado</p>
            </div>
            <div className="nexus-card text-center py-3">
              <TrendingUp className="h-4 w-4 mx-auto text-nexus-purple mb-1" />
              <p className="text-xl font-bold text-nexus-purple">{totals.avgConfidence.toFixed(0)}%</p>
              <p className="text-[10px] text-muted-foreground">Confiança Média</p>
            </div>
            <div className="nexus-card text-center py-3">
              <Clock className="h-4 w-4 mx-auto text-nexus-amber mb-1" />
              <p className="text-xl font-bold text-nexus-amber">{totals.avgLatencyS.toFixed(1)}s</p>
              <p className="text-[10px] text-muted-foreground">Latência Média</p>
            </div>
          </div>

          {/* Best mode highlight */}
          {totals.bestMode && (
            <div className="nexus-card bg-nexus-amber/5 border-nexus-amber/30">
              <div className="flex items-center gap-3">
                <Award className="h-8 w-8 text-nexus-amber" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Modo mais eficaz
                  </p>
                  <p className="text-sm font-semibold text-foreground">
                    {ORACLE_MODES[totals.bestMode.mode as OracleMode]?.icon}{' '}
                    {ORACLE_MODES[totals.bestMode.mode as OracleMode]?.label ?? totals.bestMode.mode}
                    <span className="text-[11px] text-nexus-amber font-mono ml-2">
                      {totals.bestMode.avg_confidence.toFixed(0)}% confiança
                    </span>
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {totals.bestMode.count} consultas · ${totals.bestMode.total_cost.toFixed(4)} gasto
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Per-mode breakdown */}
          <div className="nexus-card">
            <h4 className="text-xs font-semibold text-foreground mb-3">Performance por Modo</h4>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/30">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Modo</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Consultas</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Confiança</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Consenso</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Custo</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Latência</th>
                  </tr>
                </thead>
                <tbody>
                  {metrics.map((m) => {
                    const modeInfo = ORACLE_MODES[m.mode as OracleMode];
                    return (
                      <tr key={m.mode} className="border-b border-border/10 hover:bg-secondary/20">
                        <td className="py-2 px-2">
                          <div className="flex items-center gap-1.5">
                            <span>{modeInfo?.icon ?? '❓'}</span>
                            <span className="font-medium">{modeInfo?.label ?? m.mode}</span>
                          </div>
                        </td>
                        <td className="text-right py-2 px-2 font-mono">{m.count}</td>
                        <td className="text-right py-2 px-2">
                          <Badge
                            variant="outline"
                            className="text-[9px]"
                            style={{
                              borderColor:
                                m.avg_confidence >= 80 ? 'hsl(var(--nexus-emerald) / 0.5)' :
                                m.avg_confidence >= 60 ? 'hsl(var(--nexus-yellow) / 0.5)' : 'hsl(var(--nexus-red) / 0.5)',
                              color:
                                m.avg_confidence >= 80 ? 'hsl(var(--nexus-emerald))' :
                                m.avg_confidence >= 60 ? 'hsl(var(--nexus-yellow))' : 'hsl(var(--nexus-red))',
                            }}
                          >
                            {m.avg_confidence.toFixed(0)}%
                          </Badge>
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-muted-foreground">
                          {m.avg_consensus.toFixed(0)}%
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-nexus-emerald">
                          ${m.total_cost.toFixed(4)}
                        </td>
                        <td className="text-right py-2 px-2 font-mono text-nexus-amber">
                          {m.avg_latency_s.toFixed(1)}s
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
