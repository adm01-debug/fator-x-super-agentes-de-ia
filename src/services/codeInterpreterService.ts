import { supabase } from "@/integrations/supabase/client";

export type CodeRuntime = "python" | "node" | "deno";

export interface CodeExecution {
  id: string;
  user_id: string;
  workspace_id: string | null;
  runtime: CodeRuntime;
  code: string;
  stdout: string;
  stderr: string;
  exit_code: number | null;
  files: Array<{ name: string; size: number }>;
  duration_ms: number;
  memory_mb: number;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  simulated: boolean;
  error_message: string | null;
  created_at: string;
}

export const codeInterpreterService = {
  async execute(runtime: CodeRuntime, code: string, workspace_id?: string): Promise<CodeExecution> {
    const { data, error } = await supabase.functions.invoke("code-interpreter-execute", {
      body: { runtime, code, workspace_id },
    });
    if (error) throw error;
    return data as CodeExecution;
  },

  async list(limit = 20): Promise<CodeExecution[]> {
    const { data, error } = await supabase
      .from("code_executions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as unknown as CodeExecution[];
  },

  async remove(id: string): Promise<void> {
    const { error } = await supabase.from("code_executions").delete().eq("id", id);
    if (error) throw error;
  },

  async clearAll(): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.from("code_executions").delete().eq("user_id", user.id);
    if (error) throw error;
  },
};
