/**
 * Cost Anomalies Page — Sprint 30
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, RefreshCw, TrendingUp, Eye } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { listAlerts, acknowledgeAlert, runDetectionNow, type CostAlert } from "@/services/costAnomalyService";

const severityVariant: Record<string, "destructive" | "default" | "secondary"> = {
  critical: "destructive",
  warning: "default",
  info: "secondary",
};

export default function CostAnomaliesPage() {
  const qc = useQueryClient();
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [showAck, setShowAck] = useState(false);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["cost-alerts", severityFilter, showAck],
    queryFn: () =>
      listAlerts({
        onlyActive: !showAck,
        severity: severityFilter === "all" ? undefined : (severityFilter as "info" | "warning" | "critical"),
      }),
  });

  const ackMut = useMutation({
    mutationFn: acknowledgeAlert,
    onSuccess: () => {
      toast.success("Alerta marcado como tratado");
      qc.invalidateQueries({ queryKey: ["cost-alerts"] });
    },
  });

  const detectMut = useMutation({
    mutationFn: runDetectionNow,
    onSuccess: (r) => {
      toast.success(`Detecção executada — ${r.alerts_created} anomalia(s) encontrada(s)`);
      qc.invalidateQueries({ queryKey: ["cost-alerts"] });
    },
  });

  return (
    <div className="container mx-auto p-6 space-y-6 page-enter">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold gradient-text">Anomalias de Custo</h1>
          <p className="text-muted-foreground mt-1">
            Detecção proativa de spikes anormais de spend (z-score &gt; 2σ)
          </p>
        </div>
        <Button onClick={() => detectMut.mutate()} disabled={detectMut.isPending} variant="outline">
          <RefreshCw className={`h-4 w-4 mr-2 ${detectMut.isPending ? "animate-spin" : ""}`} />
          Detectar agora
        </Button>
      </div>

      <div className="flex gap-3 flex-wrap">
        <Select value={severityFilter} onValueChange={setSeverityFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas severidades</SelectItem>
            <SelectItem value="critical">Crítico</SelectItem>
            <SelectItem value="warning">Atenção</SelectItem>
            <SelectItem value="info">Info</SelectItem>
          </SelectContent>
        </Select>
        <Button variant={showAck ? "default" : "outline"} size="sm" onClick={() => setShowAck((v) => !v)}>
          {showAck ? "Mostrando tratados" : "Apenas ativos"}
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : !alerts || alerts.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <CheckCircle2 className="h-12 w-12 text-success mx-auto mb-4" />
            <p className="text-lg font-medium">Sem anomalias detectadas</p>
            <p className="text-sm text-muted-foreground mt-1">
              Custos dentro do esperado ✅
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {alerts.map((alert) => <AlertCard key={alert.id} alert={alert} onAck={(id) => ackMut.mutate(id)} />)}
        </div>
      )}
    </div>
  );
}

function AlertCard({ alert, onAck }: { alert: CostAlert; onAck: (id: string) => void }) {
  const delta = alert.observed_cost_usd - alert.baseline_cost_usd;
  const pct = alert.baseline_cost_usd > 0 ? (delta / alert.baseline_cost_usd) * 100 : 0;
  return (
    <Card className={alert.acknowledged_at ? "opacity-60" : ""}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className={`h-5 w-5 mt-0.5 ${alert.severity === "critical" ? "text-destructive" : "text-warning"}`} />
            <div>
              <CardTitle className="text-base">
                {alert.scope_label ?? `${alert.scope}`}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Disparado {new Date(alert.triggered_at).toLocaleString("pt-BR")}
              </p>
            </div>
          </div>
          <Badge variant={severityVariant[alert.severity]}>{alert.severity.toUpperCase()}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs">Observado</p>
            <p className="font-mono font-bold text-lg">${alert.observed_cost_usd.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Baseline</p>
            <p className="font-mono text-lg">${alert.baseline_cost_usd.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs">Z-score</p>
            <p className="font-mono font-bold text-lg flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              {alert.z_score.toFixed(1)}σ
            </p>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          +${delta.toFixed(2)} ({pct > 0 ? "+" : ""}{pct.toFixed(0)}%) acima do esperado para esta hora/dia
        </div>
        {!alert.acknowledged_at && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onAck(alert.id)}>
              <CheckCircle2 className="h-3 w-3 mr-1.5" />
              Acknowledge
            </Button>
            {alert.scope === "agent" && alert.scope_id && (
              <Button size="sm" variant="ghost" asChild>
                <Link to={`/traces?agent_id=${alert.scope_id}`}>
                  <Eye className="h-3 w-3 mr-1.5" />
                  Investigar traces
                </Link>
              </Button>
            )}
          </div>
        )}
        {alert.acknowledged_at && (
          <p className="text-xs text-muted-foreground">
            ✓ Tratado em {new Date(alert.acknowledged_at).toLocaleString("pt-BR")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
