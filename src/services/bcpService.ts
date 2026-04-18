import { supabase } from "@/integrations/supabase/client";

export type BcpCategory = "core" | "supporting" | "analytical" | "external";
export type BcpCriticality = "tier_1" | "tier_2" | "tier_3" | "tier_4";
export type BcpSystemStatus = "operational" | "degraded" | "down" | "retired";
export type BcpTestType = "tabletop" | "walkthrough" | "simulation" | "full_failover";

export interface BusinessSystem {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  category: BcpCategory;
  criticality: BcpCriticality;
  rto_minutes: number;
  rpo_minutes: number;
  mtpd_hours: number;
  dependencies: string[];
  owner_id: string | null;
  recovery_strategy: string | null;
  status: BcpSystemStatus;
  last_tested_at: string | null;
  next_test_due: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BcpTestRun {
  id: string;
  system_id: string;
  test_type: BcpTestType;
  executed_by: string;
  executed_at: string;
  scenario: string;
  actual_rto_minutes: number | null;
  actual_rpo_minutes: number | null;
  success: boolean;
  gaps: string[];
  action_items: string | null;
  notes: string | null;
  created_at: string;
}

export interface BcpSummary {
  total: number;
  tier_1: number;
  tier_2: number;
  tier_3: number;
  tier_4: number;
  down: number;
  degraded: number;
  tests_overdue: number;
  never_tested: number;
  rto_breaches: number;
}

export async function listBusinessSystems(workspaceId: string): Promise<BusinessSystem[]> {
  const { data, error } = await supabase
    .from("business_systems")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("criticality", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as BusinessSystem[];
}

export async function listSystemTests(systemId: string): Promise<BcpTestRun[]> {
  const { data, error } = await supabase
    .from("bcp_test_runs")
    .select("*")
    .eq("system_id", systemId)
    .order("executed_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BcpTestRun[];
}

export async function getBcpSummary(workspaceId: string): Promise<BcpSummary> {
  const { data, error } = await supabase.rpc("get_bcp_summary", { p_workspace_id: workspaceId });
  if (error) throw error;
  return (data ?? {}) as unknown as BcpSummary;
}

export async function registerBusinessSystem(input: {
  workspace_id: string;
  name: string;
  description?: string | null;
  category?: BcpCategory;
  criticality?: BcpCriticality;
  rto_minutes?: number;
  rpo_minutes?: number;
  mtpd_hours?: number;
  dependencies?: string[];
  owner_id?: string | null;
  recovery_strategy?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("register_business_system", {
    p_workspace_id: input.workspace_id,
    p_name: input.name,
    p_description: input.description ?? undefined,
    p_category: input.category ?? "core",
    p_criticality: input.criticality ?? "tier_3",
    p_rto_minutes: input.rto_minutes ?? 240,
    p_rpo_minutes: input.rpo_minutes ?? 60,
    p_mtpd_hours: input.mtpd_hours ?? 24,
    p_dependencies: input.dependencies ?? [],
    p_owner_id: input.owner_id ?? undefined,
    p_recovery_strategy: input.recovery_strategy ?? undefined,
  });
  if (error) throw error;
  return data as string;
}
  const { data, error } = await supabase.rpc("register_business_system", {
    p_workspace_id: input.workspace_id,
    p_name: input.name,
    p_description: input.description ?? null,
    p_category: input.category ?? "core",
    p_criticality: input.criticality ?? "tier_3",
    p_rto_minutes: input.rto_minutes ?? 240,
    p_rpo_minutes: input.rpo_minutes ?? 60,
    p_mtpd_hours: input.mtpd_hours ?? 24,
    p_dependencies: input.dependencies ?? [],
    p_owner_id: input.owner_id ?? null,
    p_recovery_strategy: input.recovery_strategy ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function recordBcpTest(input: {
  system_id: string;
  test_type: BcpTestType;
  scenario: string;
  actual_rto_minutes?: number | null;
  actual_rpo_minutes?: number | null;
  success?: boolean;
  gaps?: string[];
  action_items?: string | null;
  notes?: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("record_bcp_test", {
    p_system_id: input.system_id,
    p_test_type: input.test_type,
    p_scenario: input.scenario,
    p_actual_rto_minutes: input.actual_rto_minutes ?? undefined,
    p_actual_rpo_minutes: input.actual_rpo_minutes ?? undefined,
    p_success: input.success ?? true,
    p_gaps: input.gaps ?? [],
    p_action_items: input.action_items ?? undefined,
    p_notes: input.notes ?? undefined,
  });
  if (error) throw error;
  return data as string;
}
  const { data, error } = await supabase.rpc("record_bcp_test", {
    p_system_id: input.system_id,
    p_test_type: input.test_type,
    p_scenario: input.scenario,
    p_actual_rto_minutes: input.actual_rto_minutes ?? null,
    p_actual_rpo_minutes: input.actual_rpo_minutes ?? null,
    p_success: input.success ?? true,
    p_gaps: input.gaps ?? [],
    p_action_items: input.action_items ?? null,
    p_notes: input.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function updateSystemStatus(systemId: string, status: BcpSystemStatus): Promise<void> {
  const { error } = await supabase
    .from("business_systems")
    .update({ status })
    .eq("id", systemId);
  if (error) throw error;
}

// ============ Helpers ============
export function isTestOverdue(system: Pick<BusinessSystem, "next_test_due" | "status">): boolean {
  if (system.status === "retired") return false;
  if (!system.next_test_due) return true;
  return new Date(system.next_test_due) < new Date();
}

export function daysUntilTest(system: Pick<BusinessSystem, "next_test_due">): number | null {
  if (!system.next_test_due) return null;
  const ms = new Date(system.next_test_due).getTime() - Date.now();
  return Math.round(ms / 86_400_000);
}

export function isRtoBreach(test: Pick<BcpTestRun, "actual_rto_minutes">, system: Pick<BusinessSystem, "rto_minutes">): boolean {
  return test.actual_rto_minutes != null && test.actual_rto_minutes > system.rto_minutes;
}

export function isRpoBreach(test: Pick<BcpTestRun, "actual_rpo_minutes">, system: Pick<BusinessSystem, "rpo_minutes">): boolean {
  return test.actual_rpo_minutes != null && test.actual_rpo_minutes > system.rpo_minutes;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : `${h}h${m}m`;
}

export const TIER_LABEL: Record<BcpCriticality, string> = {
  tier_1: "Tier 1 — Crítico",
  tier_2: "Tier 2 — Alto",
  tier_3: "Tier 3 — Médio",
  tier_4: "Tier 4 — Baixo",
};

export const TIER_CADENCE_DAYS: Record<BcpCriticality, number> = {
  tier_1: 90,
  tier_2: 180,
  tier_3: 365,
  tier_4: 730,
};

export const CATEGORY_LABEL: Record<BcpCategory, string> = {
  core: "Core",
  supporting: "Suporte",
  analytical: "Analítico",
  external: "Externo",
};

export const STATUS_LABEL: Record<BcpSystemStatus, string> = {
  operational: "Operacional",
  degraded: "Degradado",
  down: "Indisponível",
  retired: "Aposentado",
};

export const TEST_TYPE_LABEL: Record<BcpTestType, string> = {
  tabletop: "Tabletop",
  walkthrough: "Walkthrough",
  simulation: "Simulação",
  full_failover: "Failover completo",
};
