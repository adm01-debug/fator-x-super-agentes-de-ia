/**
 * SyntheticAlertsMounter — global toast on synthetic check failures.
 * Subscribes to realtime inserts on `synthetic_results` with success=false.
 */
import { useEffect } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function SyntheticAlertsMounter() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("synthetic-alerts")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "synthetic_results", filter: "success=eq.false" },
        (payload) => {
          const row = payload.new as { check_id: string; error_message: string | null; latency_ms: number | null };
          toast.error("Synthetic check falhou", {
            description: row.error_message ?? `Latência ${row.latency_ms}ms acima do threshold`,
            duration: 8000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return null;
}
