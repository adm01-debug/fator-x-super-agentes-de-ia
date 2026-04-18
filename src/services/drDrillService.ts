import { supabase } from "@/integrations/supabase/client";

export type DRDrill = {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  scope: "full" | "workspace" | "table";
  target_tables: string[];
  scheduled_at: string;
  started_at: string | null;
  ended_at: string | null;
  status: "scheduled" | "snapshotting" | "restoring" | "validating" | "completed" | "failed" | "cancelled";
  rto_target_seconds: number;
  rpo_target_seconds: number;
  actual_rto_seconds: number | null;
  actual_rpo_seconds: number | null;
  success: boolean | null;
  error_message: string | null;
  executor_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type DRSnapshot = {
  id: string;
  drill_id: string;
  table_name: string;
  row_count: number;
  checksum: string;
  size_bytes: number;
  captured_at: string;
};

export type DRRestoreLog = {
  id: string;
  drill_id: string;
  step: "snapshot" | "isolate" | "restore" | "validate" | "cleanup";
  status: "started" | "succeeded" | "failed" | "skipped";
  started_at: string;
  ended_at: string | null;
  duration_ms: number | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
};

export const DR_TEMPLATES = [
  {
    id: "critical-weekly",
    name: "Tabelas Críticas (Semanal)",
    description: "Validação semanal das tabelas críticas: agents, agent_traces, workspaces",
    scope: "table" as const,
    target_tables: ["agents", "agent_traces", "workspaces", "workspace_members"],
    rto_target_seconds: 300,
    rpo_target_seconds: 60,
  },
  {
    id: "workspace-monthly",
    name: "Workspace Completo (Mensal)",
    description: "Restore completo de um workspace com todas suas dependências",
    scope: "workspace" as const,
    target_tables: ["agents", "agent_traces", "workspace_members", "workspace_budgets", "automation_rules"],
    rto_target_seconds: 900,
    rpo_target_seconds: 300,
  },
  {
    id: "full-quarterly",
    name: "Full DR (Trimestral)",
    description: "Disaster recovery completo - simulação de perda total de região",
    scope: "full" as const,
    target_tables: ["agents", "agent_traces", "workspaces", "workspace_members", "workspace_budgets", "incident_runs", "game_days"],
    rto_target_seconds: 1800,
    rpo_target_seconds: 600,
  },
];

export async function listDrills(workspaceId: string): Promise<DRDrill[]> {
  const { data, error } = await supabase
    .from("dr_drills")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("scheduled_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as DRDrill[];
}

export async function createDrill(input: {
  workspace_id: string;
  name: string;
  description?: string;
  scope: "full" | "workspace" | "table";
  target_tables: string[];
  rto_target_seconds: number;
  rpo_target_seconds: number;
  scheduled_at?: string;
}): Promise<DRDrill> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("auth required");
  const { data, error } = await supabase
    .from("dr_drills")
    .insert({
      ...input,
      description: input.description ?? null,
      scheduled_at: input.scheduled_at ?? new Date().toISOString(),
      created_by: user.id,
    })
    .select()
    .single();
  if (error) throw error;
  return data as DRDrill;
}

export async function deleteDrill(drillId: string): Promise<void> {
  const { error } = await supabase.from("dr_drills").delete().eq("id", drillId);
  if (error) throw error;
}

export async function listSnapshots(drillId: string): Promise<DRSnapshot[]> {
  const { data, error } = await supabase
    .from("dr_snapshots")
    .select("*")
    .eq("drill_id", drillId)
    .order("captured_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DRSnapshot[];
}

export async function listRestoreLogs(drillId: string): Promise<DRRestoreLog[]> {
  const { data, error } = await supabase
    .from("dr_restore_logs")
    .select("*")
    .eq("drill_id", drillId)
    .order("started_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DRRestoreLog[];
}

export async function executeDrill(drillId: string): Promise<{ status: string; rto_actual?: number; rpo_actual?: number; error?: string }> {
  const { data, error } = await supabase.functions.invoke("dr-orchestrator", {
    body: { drill_id: drillId },
  });
  if (error) throw error;
  return data;
}
