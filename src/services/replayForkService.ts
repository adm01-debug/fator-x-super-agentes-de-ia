/**
 * Replay Fork Service — manages execution forks for time-travel debugging.
 * Forks live in the local Lovable Cloud DB; source snapshots live in the external DB.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export interface ReplayFork {
  id: string;
  workspace_id: string | null;
  user_id: string;
  name: string;
  parent_execution_id: string;
  parent_agent_id: string | null;
  fork_step_index: number;
  parent_chain_hash: string | null;
  override_input: unknown;
  state_snapshot: unknown;
  deterministic_seed: string | null;
  status: "pending" | "running" | "completed" | "failed";
  result: { steps?: unknown[]; summary?: string } | null;
  error_message: string | null;
  new_execution_id: string | null;
  total_steps: number;
  duration_ms: number | null;
  cost_usd: number;
  created_at: string;
  completed_at: string | null;
}

export interface CreateForkInput {
  name: string;
  parent_execution_id: string;
  parent_agent_id?: string;
  fork_step_index: number;
  parent_chain_hash?: string;
  override_input?: unknown;
  state_snapshot: unknown;
  deterministic_seed?: string;
  workspace_id?: string;
}

export const replayForkService = {
  async list(): Promise<ReplayFork[]> {
    const { data, error } = await supabase
      .from("replay_forks")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      logger.error("[replayForkService.list]", error);
      return [];
    }
    return (data as unknown as ReplayFork[]) ?? [];
  },

  async create(input: CreateForkInput): Promise<ReplayFork | null> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const seed = input.deterministic_seed ?? crypto.randomUUID();
    const { data, error } = await supabase
      .from("replay_forks")
      .insert({
        user_id: user.id,
        workspace_id: input.workspace_id ?? null,
        name: input.name,
        parent_execution_id: input.parent_execution_id,
        parent_agent_id: input.parent_agent_id ?? null,
        fork_step_index: input.fork_step_index,
        parent_chain_hash: input.parent_chain_hash ?? null,
        override_input: (input.override_input ?? null) as never,
        state_snapshot: (input.state_snapshot ?? null) as never,
        deterministic_seed: seed,
        status: "pending",
      })
      .select()
      .single();
    if (error) {
      logger.error("[replayForkService.create]", error);
      return null;
    }
    return data as unknown as ReplayFork;
  },

  async execute(forkId: string): Promise<{ success: boolean; error?: string }> {
    const { data, error } = await supabase.functions.invoke("replay-fork-execute", {
      body: { fork_id: forkId },
    });
    if (error) {
      logger.error("[replayForkService.execute]", error);
      return { success: false, error: error.message };
    }
    return { success: !!(data as { success?: boolean })?.success };
  },

  async remove(forkId: string): Promise<boolean> {
    const { error } = await supabase.from("replay_forks").delete().eq("id", forkId);
    if (error) {
      logger.error("[replayForkService.remove]", error);
      return false;
    }
    return true;
  },

  /**
   * Verify chain integrity of a sequence of snapshots.
   * Each snapshot's previous_hash must match the prior snapshot's chain_hash.
   */
  verifyChain(snapshots: Array<{ chain_hash: string; previous_hash: string; step_index: number }>): {
    valid: boolean;
    brokenAt: number | null;
  } {
    if (snapshots.length === 0) return { valid: true, brokenAt: null };
    const sorted = [...snapshots].sort((a, b) => a.step_index - b.step_index);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].previous_hash !== sorted[i - 1].chain_hash) {
        return { valid: false, brokenAt: sorted[i].step_index };
      }
    }
    return { valid: true, brokenAt: null };
  },
};
