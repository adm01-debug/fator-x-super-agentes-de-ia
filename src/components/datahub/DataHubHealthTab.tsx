import { useQuery } from "@tanstack/react-query";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  Activity,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getDatahubHealth,
  type DatahubProjectHealth,
} from "@/services/datahubService";

const STATUS_STYLES = {
  healthy: { color: '#6BCB77', label: 'Saudável', icon: CheckCircle2 },
  degraded: { color: '#FFD93D', label: 'Degradado', icon: AlertTriangle },
  critical: { color: '#FF6B6B', label: 'Crítico', icon: XCircle },
} as const;

function formatLatency(ms: number | null): string {
  if (ms == null) return '—';
  if (ms < 100) return `${ms}ms`;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function latencyColor(ms: number | null): string {
  if (ms == null) return '#9ca3af';
  if (ms < 200) return '#6BCB77';
  if (ms < 500) return '#FFD93D';
  if (ms < 1500) return '#E67E22';
  return '#FF6B6B';
}

export function DataHubHealthTab() {
  const { data: report, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['datahub-health'],
    queryFn: getDatahubHealth,
    refetchInterval: 60_000,
  });

  const overallCfg = report ? STATUS_STYLES[report.overall_status] : STATUS_STYLES.degraded;
  const OverallIcon = overallCfg.icon;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="text-sm font-heading font-semibold text-foreground flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" /> Health Metrics dos Bancos
          </h3>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Status, latência e contagem de tabelas/linhas para os 5 bancos do DataHub. Auto-refresh a cada 60s.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="gap-1.5"
        >
          {isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          Verificar Agora
        </Button>
      </div>

      {/* Overall status */}
      {report && (
        <div
          className="nexus-card flex items-center justify-between gap-4 flex-wrap"
          style={{ borderLeftColor: overallCfg.color, borderLeftWidth: '3px' }}
        >
          <div className="flex items-center gap-3">
            <OverallIcon className="h-6 w-6" style={{ color: overallCfg.color }} />
            <div>
              <p className="text-sm font-semibold" style={{ color: overallCfg.color }}>
                Status Geral: {overallCfg.label}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {report.reachable_count} de {report.total_count} bancos online
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Última verificação</p>
            <p className="text-xs font-mono">
              {new Date(report.timestamp).toLocaleString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
              })}
            </p>
          </div>
        </div>
      )}

      {/* Per-project cards */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {report?.projects.map((p: DatahubProjectHealth) => (
            <div
              key={p.ref}
              className={`nexus-card border-l-2 ${
                p.reachable ? 'border-l-nexus-emerald' : 'border-l-destructive'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                  {p.reachable ? (
                    <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <p className="text-xs font-semibold truncate">{p.project}</p>
                </div>
                <Badge
                  variant="outline"
                  className="text-[9px] shrink-0"
                  style={{
                    borderColor: p.reachable ? '#6BCB7780' : '#FF6B6B80',
                    color: p.reachable ? '#6BCB77' : '#FF6B6B',
                  }}
                >
                  {p.reachable ? 'Online' : 'Offline'}
                </Badge>
              </div>

              <code className="text-[9px] text-muted-foreground font-mono block mb-3 truncate">
                {p.ref}
              </code>

              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-1.5 rounded bg-secondary/30">
                  <p className="text-[9px] text-muted-foreground uppercase">Latência</p>
                  <p
                    className="text-xs font-bold mt-0.5"
                    style={{ color: latencyColor(p.latency_ms) }}
                  >
                    {formatLatency(p.latency_ms)}
                  </p>
                </div>
                <div className="p-1.5 rounded bg-secondary/30">
                  <p className="text-[9px] text-muted-foreground uppercase">Tabelas</p>
                  <p className="text-xs font-bold mt-0.5 text-primary">
                    {p.table_count ?? '—'}
                  </p>
                </div>
                <div className="p-1.5 rounded bg-secondary/30">
                  <p className="text-[9px] text-muted-foreground uppercase">Linhas</p>
                  <p className="text-xs font-bold mt-0.5 text-nexus-purple">
                    {p.total_rows != null ? p.total_rows.toLocaleString('pt-BR') : '—'}
                  </p>
                </div>
              </div>

              {p.error && (
                <p className="text-[10px] text-destructive mt-2 italic line-clamp-2">
                  {p.error}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Legend */}
      <div className="nexus-card">
        <h4 className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">
          Legenda — latência
        </h4>
        <div className="flex flex-wrap items-center gap-3 text-[10px]">
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-nexus-emerald" /> &lt; 200ms (excelente)
          </span>
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-nexus-amber" /> 200-500ms (bom)
          </span>
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-orange-500" /> 500-1500ms (lento)
          </span>
          <span className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-destructive" /> &gt; 1500ms (crítico)
          </span>
        </div>
      </div>
    </div>
  );
}
