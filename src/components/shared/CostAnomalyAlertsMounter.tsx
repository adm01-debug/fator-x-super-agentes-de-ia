/**
 * CostAnomalyAlertsMounter — global toast on new cost anomaly inserts.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function CostAnomalyAlertsMounter() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("cost-anomaly-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "cost_alerts" },
        (payload) => {
          const row = payload.new as {
            severity: string;
            scope_label: string | null;
            observed_cost_usd: number;
            baseline_cost_usd: number;
            z_score: number;
          };
          const label = row.scope_label ?? "Workspace";
          const desc = `Custo observado $${Number(row.observed_cost_usd).toFixed(2)} vs baseline $${Number(row.baseline_cost_usd).toFixed(2)} (z=${Number(row.z_score).toFixed(1)})`;
          if (row.severity === "critical") {
            toast.error(`Anomalia crítica de custo — ${label}`, { description: desc, duration: 10000 });
          } else {
            toast.warning(`Anomalia de custo — ${label}`, { description: desc, duration: 8000 });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
