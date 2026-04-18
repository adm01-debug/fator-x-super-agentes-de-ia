/**
 * Budget Widget — Dashboard summary card showing current spend vs limit.
 */
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Wallet, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useWorkspaceId } from "@/hooks/use-data";
import { budgetService } from "@/services/budgetService";

export function BudgetWidget() {
  const { data: workspaceId } = useWorkspaceId();

  const { data: status } = useQuery({
    queryKey: ["budget-status", workspaceId],
    queryFn: () => budgetService.checkBudget(workspaceId!),
    enabled: !!workspaceId,
    refetchInterval: 60_000,
  });

  if (!status?.configured) {
    return (
      <Link to="/settings/budget" className="block">
        <Card className="hover:border-primary/50 transition-colors">
          <CardContent className="p-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Wallet className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Orçamento</p>
                <p className="text-xs text-muted-foreground">Não configurado</p>
              </div>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </CardContent>
        </Card>
      </Link>
    );
  }

  const monthlyPct = Number(status.monthly_pct ?? 0);
  const colorClass =
    monthlyPct >= 100 ? "text-destructive" : monthlyPct >= (status.soft_threshold_pct ?? 80) ? "text-warning" : "text-success";

  return (
    <Link to="/settings/budget" className="block">
      <Card className="hover:border-primary/50 transition-colors">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className={`h-4 w-4 ${colorClass}`} />
              <p className="text-sm font-medium">Orçamento Mensal</p>
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="flex items-baseline justify-between">
            <span className={`text-lg font-semibold ${colorClass}`}>
              ${Number(status.monthly_spend ?? 0).toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">
              de ${Number(status.monthly_limit ?? 0).toFixed(2)}
            </span>
          </div>
          <Progress value={Math.min(monthlyPct, 100)} className="h-2" />
          <p className="text-xs text-muted-foreground">{monthlyPct.toFixed(1)}% utilizado</p>
        </CardContent>
      </Card>
    </Link>
  );
}
