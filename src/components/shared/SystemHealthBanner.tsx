/**
 * Nexus Agents Studio — System Health Banner
 * Compact health snapshot for the top of MonitoringPage and other dashboards.
 * Polls the health-check Edge Function every 30s via React Query.
 */
import { useQuery } from "@tanstack/react-query";
import { Activity, AlertTriangle, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  getSystemHealth,
  statusColor,
  statusLabel,
  type HealthStatus,
} from "@/services/healthService";

const POLL_INTERVAL_MS = 30_000;

function StatusIcon({ status }: { status: HealthStatus }) {
  const color = statusColor(status);
  const props = { className: "h-5 w-5", style: { color } };
  switch (status) {
    case "healthy":
      return <CheckCircle2 {...props} />;
    case "degraded":
      return <AlertTriangle {...props} />;
    case "down":
      return <XCircle {...props} />;
    default:
      return <Activity {...props} />;
  }
}

export function SystemHealthBanner() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["system-health"],
    queryFn: getSystemHealth,
    refetchInterval: POLL_INTERVAL_MS,
    staleTime: POLL_INTERVAL_MS / 2,
  });

  if (isLoading) {
    return (
      <div className="bg-card rounded-xl border border-border p-4 flex items-center gap-3">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Verificando saúde do sistema…</span>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-card rounded-xl border border-[#FF6B6B]/40 p-4 flex items-center gap-3">
        <XCircle className="h-5 w-5 text-destructive" />
        <div className="flex-1">
          <p className="text-sm font-medium text-foreground">Health-check indisponível</p>
          <p className="text-xs text-muted-foreground">
            Não foi possível invocar a Edge Function de health-check.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs px-3 py-1 rounded-md border border-border hover:bg-background transition"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  const overall = data.status;
  const checkEntries = Object.entries(data.checks);

  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          <StatusIcon status={overall} />
          <div>
            <p className="text-sm font-semibold text-foreground">
              Sistema: {statusLabel(overall)}
            </p>
            <p className="text-xs text-muted-foreground">
              Versão {data.version} · atualizado{" "}
              {new Date(data.timestamp).toLocaleTimeString("pt-BR")}
            </p>
          </div>
        </div>
        <Badge
          variant="outline"
          className="text-xs"
          style={{ borderColor: statusColor(overall), color: statusColor(overall) }}
        >
          {overall.toUpperCase()}
        </Badge>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {checkEntries.map(([name, info]) => (
          <div
            key={name}
            className="bg-background rounded-lg border border-border px-3 py-2"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-muted-foreground capitalize">
                {name}
              </span>
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusColor(info.status as HealthStatus) }}
              />
            </div>
            <p className="text-xs text-foreground">
              {info.latency_ms != null ? `${info.latency_ms}ms` : statusLabel(info.status as HealthStatus)}
            </p>
            {info.error && (
              <p className="text-[10px] text-destructive truncate" title={info.error}>
                {info.error}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
