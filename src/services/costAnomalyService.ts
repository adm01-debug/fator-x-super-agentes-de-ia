/**
 * Cost Anomaly Service — Sprint 30
 * Wraps cost_alerts + cost_baselines with RLS-aware queries.
 */
import { supabase } from "@/integrations/supabase/client";

export interface CostAlert {
  id: string;
  workspace_id: string;
  scope: "workspace" | "agent" | "model";
  scope_id: string | null;
  scope_label: string | null;
  observed_cost_usd: number;
  baseline_cost_usd: number;
  z_score: number;
  severity: "info" | "warning" | "critical";
  triggered_at: string;
  acknowledged_at: string | null;
  acknowledged_by: string | null;
}

export async function listAlerts(opts?: {
  onlyActive?: boolean;
  severity?: "info" | "warning" | "critical";
  limit?: number;
}): Promise<CostAlert[]> {
  let q = supabase
    .from("cost_alerts")
    .select("*")
    .order("triggered_at", { ascending: false })
    .limit(opts?.limit ?? 100);
  if (opts?.onlyActive) q = q.is("acknowledged_at", null);
  if (opts?.severity) q = q.eq("severity", opts.severity);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as CostAlert[];
}

export async function countActiveAlerts(): Promise<number> {
  const { count, error } = await supabase
    .from("cost_alerts")
    .select("*", { count: "exact", head: true })
    .is("acknowledged_at", null);
  if (error) throw error;
  return count ?? 0;
}

export async function acknowledgeAlert(alertId: string): Promise<void> {
  const { error } = await supabase.rpc("acknowledge_cost_alert", { p_alert_id: alertId });
  if (error) throw error;
}

export async function runDetectionNow(): Promise<{ alerts_created: number; checked_at: string }> {
  const { data, error } = await supabase.rpc("detect_cost_anomalies");
  if (error) throw error;
  return data as { alerts_created: number; checked_at: string };
}

export async function recomputeBaselines(): Promise<void> {
  const { error } = await supabase.rpc("compute_cost_baselines");
  if (error) throw error;
}
