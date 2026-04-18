/**
 * BudgetEventsMounter — global toast on new budget events.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function BudgetEventsMounter() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("budget-events")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "budget_events" },
        (payload) => {
          const row = payload.new as {
            event_type: string;
            period: string;
            period_spend_usd: number;
            period_limit_usd: number;
            pct_used: number;
          };
          const desc = `Gasto $${Number(row.period_spend_usd).toFixed(2)} de $${Number(row.period_limit_usd).toFixed(2)} (${row.pct_used}%) — período ${row.period === "daily" ? "diário" : "mensal"}`;
          switch (row.event_type) {
            case "hard_block":
              toast.error("Orçamento esgotado — chamadas bloqueadas", { description: desc, duration: 12000 });
              break;
            case "agent_paused":
              toast.error("Agentes pausados automaticamente", { description: desc, duration: 12000 });
              break;
            case "soft_warning":
              toast.warning("Aviso de orçamento", { description: desc, duration: 8000 });
              break;
            case "reset":
              toast.success("Orçamento reiniciado", { duration: 5000 });
              break;
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
