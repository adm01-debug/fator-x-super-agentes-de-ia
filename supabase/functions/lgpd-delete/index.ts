import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface DeleteResult {
  agent_traces: number;
  agent_execution_traces: number;
  agent_feedback: number;
  agent_test_results: number;
  agent_permissions: number;
  agent_usage: number;
  prompt_versions: number;
  agents: number;
  evaluation_runs: number;
  workspace_members: number;
  workspace_secrets: number;
  knowledge_bases: number;
  knowledge_base_chunks: number;
  workspaces: number;
  oracle_queries: number;
  audit_records_anonymized: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const responseHeaders = {
    ...corsHeaders,
    "Content-Type": "application/json",
  };

  try {
    // --- Authenticate via Supabase JWT ---
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: responseHeaders },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
      throw new Error("Missing Supabase environment variables");
    }

    // Verify the caller's JWT to extract their user id
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser();

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: responseHeaders },
      );
    }

    // Parse body — allow explicit user_id but it MUST match the authenticated user
    const body = await req.json();
    const requestedUserId: string | undefined = body.user_id;

    if (requestedUserId && requestedUserId !== user.id) {
      return new Response(
        JSON.stringify({
          error: "user_id does not match authenticated user",
        }),
        { status: 403, headers: responseHeaders },
      );
    }

    const userId = user.id;

    // --- Use service-role client to bypass RLS for deletion ---
    const admin = createClient(supabaseUrl, supabaseServiceKey);

    const deleted: DeleteResult = {
      agent_traces: 0,
      agent_execution_traces: 0,
      agent_feedback: 0,
      agent_test_results: 0,
      agent_permissions: 0,
      agent_usage: 0,
      prompt_versions: 0,
      agents: 0,
      evaluation_runs: 0,
      workspace_members: 0,
      workspace_secrets: 0,
      knowledge_bases: 0,
      knowledge_base_chunks: 0,
      workspaces: 0,
      oracle_queries: 0,
      audit_records_anonymized: 0,
    };

    // -------------------------------------------------------
    // Step 1: Gather the user's agent IDs and workspace IDs
    // -------------------------------------------------------
    const { data: userAgents } = await admin
      .from("agents")
      .select("id")
      .eq("user_id", userId);
    const agentIds = (userAgents ?? []).map((a: { id: string }) => a.id);

    const { data: userWorkspaces } = await admin
      .from("workspaces")
      .select("id")
      .eq("owner_id", userId);
    const workspaceIds = (userWorkspaces ?? []).map(
      (w: { id: string }) => w.id,
    );

    // -------------------------------------------------------
    // Step 2: Delete leaf tables first (FK-safe order)
    // -------------------------------------------------------

    // 2a. agent_traces — directly owned or via agent
    if (agentIds.length > 0) {
      const { count: c1 } = await admin
        .from("agent_traces")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.agent_traces += c1 ?? 0;
    }
    {
      const { count: c1b } = await admin
        .from("agent_traces")
        .delete({ count: "exact" })
        .eq("user_id", userId);
      deleted.agent_traces += c1b ?? 0;
    }

    // 2b. agent_execution_traces (via agent)
    if (agentIds.length > 0) {
      const { count: c2 } = await admin
        .from("agent_execution_traces")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.agent_execution_traces = c2 ?? 0;
    }

    // 2c. agent_feedback (via agent)
    if (agentIds.length > 0) {
      const { count: c3 } = await admin
        .from("agent_feedback")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.agent_feedback = c3 ?? 0;
    }

    // 2d. agent_test_results (via agent)
    if (agentIds.length > 0) {
      const { count: c4 } = await admin
        .from("agent_test_results")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.agent_test_results = c4 ?? 0;
    }

    // 2e. agent_permissions (via agent or user)
    if (agentIds.length > 0) {
      const { count: c5a } = await admin
        .from("agent_permissions")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.agent_permissions += c5a ?? 0;
    }
    {
      const { count: c5b } = await admin
        .from("agent_permissions")
        .delete({ count: "exact" })
        .eq("user_id", userId);
      deleted.agent_permissions += c5b ?? 0;
    }

    // 2f. agent_usage (via agent)
    if (agentIds.length > 0) {
      const { count: c6 } = await admin
        .from("agent_usage")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.agent_usage = c6 ?? 0;
    }

    // 2g. prompt_versions (via agent)
    if (agentIds.length > 0) {
      const { count: c7 } = await admin
        .from("prompt_versions")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.prompt_versions = c7 ?? 0;
    }

    // 2h. evaluation_runs (via agent)
    if (agentIds.length > 0) {
      const { count: c8 } = await admin
        .from("evaluation_runs")
        .delete({ count: "exact" })
        .in("agent_id", agentIds);
      deleted.evaluation_runs = c8 ?? 0;
    }

    // -------------------------------------------------------
    // Step 3: Delete agents themselves
    // -------------------------------------------------------
    if (agentIds.length > 0) {
      const { count: c9 } = await admin
        .from("agents")
        .delete({ count: "exact" })
        .eq("user_id", userId);
      deleted.agents = c9 ?? 0;
    }

    // -------------------------------------------------------
    // Step 4: Anonymize oracle_queries (keep for analytics but strip user)
    // -------------------------------------------------------
    {
      const { count: c10 } = await admin
        .from("oracle_queries")
        .update({ user_id: null })
        .eq("user_id", userId)
        .select("id");
      deleted.oracle_queries = c10 ?? 0;
    }

    // -------------------------------------------------------
    // Step 5: Delete workspace-owned resources
    // -------------------------------------------------------
    if (workspaceIds.length > 0) {
      // knowledge_base_chunks (via workspace)
      const { count: cKbc } = await admin
        .from("knowledge_base_chunks")
        .delete({ count: "exact" })
        .in("workspace_id", workspaceIds);
      deleted.knowledge_base_chunks = cKbc ?? 0;

      // knowledge_bases
      const { count: cKb } = await admin
        .from("knowledge_bases")
        .delete({ count: "exact" })
        .in("workspace_id", workspaceIds);
      deleted.knowledge_bases = cKb ?? 0;

      // workspace_secrets
      const { count: cSec } = await admin
        .from("workspace_secrets")
        .delete({ count: "exact" })
        .in("workspace_id", workspaceIds);
      deleted.workspace_secrets = cSec ?? 0;
    }

    // -------------------------------------------------------
    // Step 6: Remove workspace memberships
    // -------------------------------------------------------
    {
      const { count: c11 } = await admin
        .from("workspace_members")
        .delete({ count: "exact" })
        .eq("user_id", userId);
      deleted.workspace_members = c11 ?? 0;
    }

    // -------------------------------------------------------
    // Step 7: Delete owned workspaces (CASCADE handles remaining refs)
    // -------------------------------------------------------
    if (workspaceIds.length > 0) {
      const { count: c12 } = await admin
        .from("workspaces")
        .delete({ count: "exact" })
        .eq("owner_id", userId);
      deleted.workspaces = c12 ?? 0;
    }

    // -------------------------------------------------------
    // Step 8: Anonymize audit/operation logs for compliance
    // (keep records but remove PII reference)
    // -------------------------------------------------------
    {
      const { count: c13 } = await admin
        .from("db_operation_log")
        .update({ user_id: null })
        .eq("user_id", userId)
        .select("id");
      deleted.audit_records_anonymized = c13 ?? 0;
    }

    // -------------------------------------------------------
    // Step 9: Log the deletion event for compliance audit
    // -------------------------------------------------------
    const timestamp = new Date().toISOString();
    try {
      await admin.from("agent_traces").insert({
        agent_id: null,
        user_id: userId,
        session_id: null,
        event: "lgpd_data_deletion",
        level: "info",
        input: { action: "lgpd_right_to_deletion", requested_by: userId },
        output: { deleted, timestamp },
        metadata: {
          compliance: "LGPD Art. 18",
          ip: req.headers.get("x-forwarded-for") ?? "unknown",
        },
      });
    } catch {
      // If the compliance log insert fails (e.g. agent_id NOT NULL constraint),
      // we still return success — the deletion itself completed.
      console.error("Failed to insert compliance audit log");
    }

    return new Response(
      JSON.stringify({ deleted, timestamp }),
      { status: 200, headers: responseHeaders },
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: responseHeaders,
    });
  }
});
