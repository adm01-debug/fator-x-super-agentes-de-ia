/**
 * syntheticService — synthetic monitoring CRUD + summary.
 */
import { supabase } from "@/integrations/supabase/client";

export type SyntheticTarget = "llm-gateway" | "agent-workflow-runner" | "health";

export interface SyntheticCheck {
  id: string;
  workspace_id: string;
  name: string;
  target: SyntheticTarget;
  interval_minutes: number;
  expected_status_max_ms: number;
  enabled: boolean;
  last_run_at: string | null;
  consecutive_failures: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface SyntheticResult {
  id: string;
  check_id: string;
  ran_at: string;
  success: boolean;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
}

export interface SyntheticSummary {
  window_hours: number;
  total_runs: number;
  success_count: number;
  uptime_pct: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  recent: Array<{ ran_at: string; success: boolean; latency_ms: number | null }>;
}

export async function listSyntheticChecks(workspaceId: string): Promise<SyntheticCheck[]> {
  const { data, error } = await supabase
    .from("synthetic_checks")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SyntheticCheck[];
}

export async function createSyntheticCheck(input: {
  workspace_id: string;
  name: string;
  target: SyntheticTarget;
  interval_minutes: number;
  expected_status_max_ms: number;
}): Promise<SyntheticCheck> {
  const { data: userRes } = await supabase.auth.getUser();
  const uid = userRes.user?.id;
  if (!uid) throw new Error("not authenticated");

  if (input.interval_minutes < 1 || input.interval_minutes > 60) {
    throw new Error("interval must be between 1 and 60 minutes");
  }
  if (input.expected_status_max_ms < 100 || input.expected_status_max_ms > 30000) {
    throw new Error("threshold must be between 100ms and 30000ms");
  }

  const { data, error } = await supabase
    .from("synthetic_checks")
    .insert({ ...input, created_by: uid })
    .select()
    .single();
  if (error) throw error;
  return data as SyntheticCheck;
}

export async function toggleSyntheticCheck(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from("synthetic_checks").update({ enabled }).eq("id", id);
  if (error) throw error;
}

export async function deleteSyntheticCheck(id: string): Promise<void> {
  const { error } = await supabase.from("synthetic_checks").delete().eq("id", id);
  if (error) throw error;
}

export async function getSyntheticSummary(checkId: string, windowHours = 24): Promise<SyntheticSummary> {
  const { data, error } = await supabase.rpc("get_synthetic_summary", {
    p_check_id: checkId,
    p_window_hours: windowHours,
  });
  if (error) throw error;
  return data as unknown as SyntheticSummary;
}

export async function runSyntheticCheckNow(checkId: string): Promise<void> {
  const { error } = await supabase.functions.invoke("synthetic-runner", {
    body: { check_id: checkId },
  });
  if (error) throw error;
}
