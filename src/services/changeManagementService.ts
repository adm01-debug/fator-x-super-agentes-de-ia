import { supabase } from "@/integrations/supabase/client";

export type ChangeType = "standard" | "normal" | "emergency";
export type ChangeRiskLevel = "low" | "medium" | "high" | "critical";
export type ChangeStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "rejected"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "rolled_back"
  | "failed";
export type ChangeDecision = "approve" | "reject" | "request_changes";

export interface ChangeRequest {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  change_type: ChangeType;
  risk_level: ChangeRiskLevel;
  affected_systems: string[];
  requested_by: string;
  assigned_to: string | null;
  status: ChangeStatus;
  scheduled_for: string | null;
  executed_at: string | null;
  completed_at: string | null;
  rollback_plan: string | null;
  validation_steps: string | null;
  post_mortem_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChangeApproval {
  id: string;
  change_id: string;
  approver_id: string;
  decision: ChangeDecision;
  comment: string | null;
  decided_at: string;
}

export interface FreezeWindow {
  id: string;
  workspace_id: string;
  name: string;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  allow_emergency: boolean;
  created_by: string;
  created_at: string;
}

export interface ChangeSummary {
  pending: number;
  scheduled_7d: number;
  in_freeze: number;
  success_rate_30d: number;
  total_30d: number;
  completed_30d: number;
}

export async function listChangeRequests(workspaceId: string): Promise<ChangeRequest[]> {
  const { data, error } = await supabase
    .from("change_requests")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChangeRequest[];
}

export async function listFreezeWindows(workspaceId: string): Promise<FreezeWindow[]> {
  const { data, error } = await supabase
    .from("freeze_windows")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("starts_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as FreezeWindow[];
}

export async function listApprovals(changeId: string): Promise<ChangeApproval[]> {
  const { data, error } = await supabase
    .from("change_approvals")
    .select("*")
    .eq("change_id", changeId)
    .order("decided_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as ChangeApproval[];
}

export async function submitChangeRequest(input: {
  workspace_id: string;
  title: string;
  description: string | null;
  change_type: ChangeType;
  risk_level: ChangeRiskLevel;
  affected_systems: string[];
  scheduled_for: string | null;
  rollback_plan: string | null;
  validation_steps: string | null;
}): Promise<string> {
  const { data, error } = await supabase.rpc("submit_change_request", {
    p_workspace_id: input.workspace_id,
    p_title: input.title,
    p_description: input.description,
    p_change_type: input.change_type,
    p_risk_level: input.risk_level,
    p_affected_systems: input.affected_systems,
    p_scheduled_for: input.scheduled_for,
    p_rollback_plan: input.rollback_plan,
    p_validation_steps: input.validation_steps,
  });
  if (error) throw error;
  return data as string;
}

export async function decideChange(changeId: string, decision: ChangeDecision, comment: string | null) {
  const { error } = await supabase.rpc("decide_change", {
    p_change_id: changeId,
    p_decision: decision,
    p_comment: comment,
  });
  if (error) throw error;
}

export async function executeChange(changeId: string, success: boolean) {
  const { error } = await supabase.rpc("execute_change", {
    p_change_id: changeId,
    p_success: success,
  });
  if (error) throw error;
}

export async function rollbackChange(changeId: string, postMortemUrl: string) {
  const { error } = await supabase.rpc("rollback_change", {
    p_change_id: changeId,
    p_post_mortem_url: postMortemUrl,
  });
  if (error) throw error;
}

export async function getChangeSummary(workspaceId: string): Promise<ChangeSummary> {
  const { data, error } = await supabase.rpc("get_change_summary", {
    p_workspace_id: workspaceId,
  });
  if (error) throw error;
  return data as unknown as ChangeSummary;
}

export async function createFreezeWindow(input: {
  workspace_id: string;
  name: string;
  reason: string | null;
  starts_at: string;
  ends_at: string;
  allow_emergency: boolean;
}): Promise<FreezeWindow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Não autenticado");
  const { data, error } = await supabase
    .from("freeze_windows")
    .insert({ ...input, created_by: user.id })
    .select()
    .single();
  if (error) throw error;
  return data as FreezeWindow;
}

// Helpers
export function isInActiveFreeze(scheduledFor: string | null, freezes: FreezeWindow[], changeType: ChangeType): boolean {
  if (!scheduledFor) return false;
  const t = new Date(scheduledFor).getTime();
  return freezes.some((f) => {
    const inWindow = t >= new Date(f.starts_at).getTime() && t <= new Date(f.ends_at).getTime();
    if (!inWindow) return false;
    if (changeType === "emergency" && f.allow_emergency) return false;
    return true;
  });
}

export function statusVariant(status: ChangeStatus): { label: string; className: string } {
  const map: Record<ChangeStatus, { label: string; className: string }> = {
    draft: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
    pending_approval: { label: "Aguardando aprovação", className: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30" },
    approved: { label: "Aprovada", className: "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30" },
    rejected: { label: "Rejeitada", className: "bg-destructive/15 text-destructive border-destructive/30" },
    scheduled: { label: "Agendada", className: "bg-primary/15 text-primary border-primary/30" },
    in_progress: { label: "Em execução", className: "bg-primary/15 text-primary border-primary/30" },
    completed: { label: "Concluída", className: "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30" },
    rolled_back: { label: "Revertida", className: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30" },
    failed: { label: "Falhou", className: "bg-destructive/15 text-destructive border-destructive/30" },
  };
  return map[status];
}

export function riskVariant(risk: ChangeRiskLevel): string {
  const map: Record<ChangeRiskLevel, string> = {
    low: "bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/30",
    medium: "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30",
    high: "bg-destructive/15 text-destructive border-destructive/30",
    critical: "bg-destructive/25 text-destructive border-destructive/50",
  };
  return map[risk];
}

export function typeLabel(t: ChangeType): string {
  return t === "standard" ? "Standard" : t === "normal" ? "Normal" : "Emergency";
}
