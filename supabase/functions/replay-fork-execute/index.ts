// Replay Fork Executor — replays an execution from a chosen step,
// optionally with overridden input and a deterministic seed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface ForkRequest {
  fork_id: string;
}

interface Snapshot {
  step_index: number;
  decision_type: string;
  decision_rationale: string;
  state_before: unknown;
  state_after: unknown;
  input_hash: string;
  output_hash: string;
  chain_hash: string;
  previous_hash: string;
}

// Lightweight deterministic mock-runner. In production this would call the agent runtime.
async function runForkedExecution(
  baseSnapshots: Snapshot[],
  overrideInput: unknown,
  seed: string,
): Promise<{ steps: Snapshot[]; cost_usd: number; duration_ms: number }> {
  const start = Date.now();
  const steps: Snapshot[] = [];
  let prevHash = baseSnapshots[baseSnapshots.length - 1]?.chain_hash ?? "0".repeat(64);

  // Re-execute remaining steps deterministically using the seed
  const remainingCount = Math.max(1, Math.min(8, 10 - baseSnapshots.length));
  for (let i = 0; i < remainingCount; i++) {
    const stepIndex = baseSnapshots.length + i;
    const inputHash = await sha256(`${seed}:${stepIndex}:${JSON.stringify(overrideInput ?? {})}`);
    const outputHash = await sha256(`${seed}:${stepIndex}:out:${inputHash}`);
    const chainHash = await sha256(`${prevHash}${inputHash}${outputHash}`);
    steps.push({
      step_index: stepIndex,
      decision_type: i === remainingCount - 1 ? "complete" : "tool_call",
      decision_rationale: `Forked execution step ${stepIndex} (seed=${seed.slice(0, 8)})`,
      state_before: { forked: true, prev_hash: prevHash.slice(0, 16) },
      state_after: { forked: true, output: outputHash.slice(0, 16) },
      input_hash: inputHash,
      output_hash: outputHash,
      chain_hash: chainHash,
      previous_hash: prevHash,
    });
    prevHash = chainHash;
  }
  return {
    steps,
    cost_usd: Math.round(remainingCount * 0.0023 * 1e6) / 1e6,
    duration_ms: Date.now() - start,
  };
}

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ForkRequest = await req.json();
    if (!body.fork_id) {
      return new Response(JSON.stringify({ error: "fork_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the fork record
    const { data: fork, error: forkErr } = await supabase
      .from("replay_forks")
      .select("*")
      .eq("id", body.fork_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (forkErr || !fork) {
      return new Response(JSON.stringify({ error: "Fork not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark running
    await supabase.from("replay_forks").update({ status: "running" }).eq("id", fork.id);

    const baseSnapshot = (fork.state_snapshot as Snapshot[]) ?? [];
    const seed = fork.deterministic_seed ?? crypto.randomUUID();

    const result = await runForkedExecution(baseSnapshot, fork.override_input, seed);

    const newExecutionId = `fork-${fork.id.slice(0, 8)}-${Date.now()}`;

    await supabase.from("replay_forks").update({
      status: "completed",
      new_execution_id: newExecutionId,
      total_steps: baseSnapshot.length + result.steps.length,
      duration_ms: result.duration_ms,
      cost_usd: result.cost_usd,
      result: { steps: result.steps, summary: `${result.steps.length} new steps` },
      completed_at: new Date().toISOString(),
    }).eq("id", fork.id);

    return new Response(JSON.stringify({
      success: true,
      new_execution_id: newExecutionId,
      total_steps: baseSnapshot.length + result.steps.length,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("[replay-fork-execute]", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
