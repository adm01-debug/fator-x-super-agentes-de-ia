import { supabase } from "@/integrations/supabase/client";

export interface WorkspaceBudget {
  id: string;
  workspace_id: string;
  monthly_limit_usd: number | null;
  daily_limit_usd: number | null;
  hard_stop: boolean;
  soft_threshold_pct: number;
  notify_emails: string[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface BudgetEvent {
  id: string;
  workspace_id: string;
  event_type: "soft_warning" | "hard_block" | "agent_paused" | "reset";
  period: "daily" | "monthly";
  period_spend_usd: number;
  period_limit_usd: number;
  pct_used: number;
  triggered_at: string;
  metadata: Record<string, unknown>;
}

export interface BudgetStatus {
  allowed: boolean;
  configured: boolean;
  warning?: boolean;
  hard_stop?: boolean;
  reason?: string | null;
  monthly_spend?: number;
  monthly_limit?: number | null;
  monthly_pct?: number;
  daily_spend?: number;
  daily_limit?: number | null;
  daily_pct?: number;
  soft_threshold_pct?: number;
}

export const budgetService = {
  async getBudget(workspaceId: string): Promise<WorkspaceBudget | null> {
    const { data, error } = await supabase
      .from("workspace_budgets")
      .select("*")
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    if (error) throw error;
    return data as WorkspaceBudget | null;
  },

  async upsertBudget(
    workspaceId: string,
    payload: Partial<Omit<WorkspaceBudget, "id" | "workspace_id" | "created_at" | "updated_at">>
  ): Promise<WorkspaceBudget> {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("Não autenticado");

    const existing = await this.getBudget(workspaceId);
    if (existing) {
      const { data, error } = await supabase
        .from("workspace_budgets")
        .update(payload)
        .eq("workspace_id", workspaceId)
        .select()
        .single();
      if (error) throw error;
      return data as WorkspaceBudget;
    }
    const { data, error } = await supabase
      .from("workspace_budgets")
      .insert({ workspace_id: workspaceId, created_by: userId, ...payload })
      .select()
      .single();
    if (error) throw error;
    return data as WorkspaceBudget;
  },

  async checkBudget(workspaceId: string): Promise<BudgetStatus> {
    const { data, error } = await supabase.rpc("check_budget", { p_workspace_id: workspaceId });
    if (error) throw error;
    return data as unknown as BudgetStatus;
  },

  async getCurrentSpend(workspaceId: string, period: "daily" | "monthly" = "monthly"): Promise<number> {
    const { data, error } = await supabase.rpc("get_current_spend", {
      p_workspace_id: workspaceId,
      p_period: period,
    });
    if (error) throw error;
    return Number(data ?? 0);
  },

  async listEvents(workspaceId: string, limit = 50): Promise<BudgetEvent[]> {
    const { data, error } = await supabase
      .from("budget_events")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("triggered_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as BudgetEvent[];
  },

  async resetBudget(workspaceId: string): Promise<void> {
    const { error } = await supabase.rpc("reset_workspace_budget", { p_workspace_id: workspaceId });
    if (error) throw error;
  },

  async enforceBudget(): Promise<{ blocked: number; warned: number; agents_paused: number }> {
    const { data, error } = await supabase.rpc("enforce_budget");
    if (error) throw error;
    return data as unknown as { blocked: number; warned: number; agents_paused: number };
  },
};
