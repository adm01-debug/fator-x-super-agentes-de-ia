import { supabase } from "@/integrations/supabase/client";

export interface BrowserStep {
  step_index: number;
  url: string;
  action: "click" | "type" | "navigate" | "extract" | "done";
  args: { idx?: number; text?: string; result?: string };
  reasoning: string;
  ts: string;
}

export interface BrowserSession {
  id: string;
  user_id: string;
  workspace_id: string | null;
  agent_id: string | null;
  goal: string;
  start_url: string;
  status: "running" | "completed" | "failed" | "cancelled";
  steps: BrowserStep[];
  steps_count: number;
  max_steps: number;
  final_result: string | null;
  error_message: string | null;
  cost_cents: number;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface RunAgentInput {
  goal: string;
  start_url: string;
  agent_id?: string;
  workspace_id?: string;
  max_steps?: number;
}

export const browserAgentService = {
  async runAgent(input: RunAgentInput) {
    const { data, error } = await supabase.functions.invoke("browser-agent-run", { body: input });
    if (error) throw error;
    return data as { session_id: string; status: string; steps_count: number; final_result: string | null; cost_cents: number; error?: string };
  },

  async cancelSession(session_id: string) {
    const { data, error } = await supabase.functions.invoke("browser-session-cancel", { body: { session_id } });
    if (error) throw error;
    return data;
  },

  async listSessions(limit = 50): Promise<BrowserSession[]> {
    const { data, error } = await supabase
      .from("browser_sessions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as BrowserSession[];
  },

  async getSession(id: string): Promise<BrowserSession | null> {
    const { data, error } = await supabase.from("browser_sessions").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data as unknown as BrowserSession | null;
  },

  async deleteSession(id: string) {
    const { error } = await supabase.from("browser_sessions").delete().eq("id", id);
    if (error) throw error;
  },
};
