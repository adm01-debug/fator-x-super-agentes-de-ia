/**
 * Cost Anomaly Widget — Dashboard summary card
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { countActiveAlerts } from "@/services/costAnomalyService";

export function CostAnomalyWidget() {
  const { data: count = 0 } = useQuery({
    queryKey: ["cost-alerts-count"],
    queryFn: countActiveAlerts,
    refetchInterval: 60_000,
  });

  return (
    <Link to="/observability/cost-anomalies" className="block">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {count > 0 ? (
              <AlertTriangle className="h-5 w-5 text-warning" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-success" />
            )}
            <div>
              <p className="text-sm font-medium">Anomalias de Custo (24h)</p>
              <p className="text-xs text-muted-foreground">
                {count > 0 ? `${count} alerta(s) ativo(s)` : "Sem anomalias"}
              </p>
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
        </CardContent>
      </Card>
    </Link>
  );
}
