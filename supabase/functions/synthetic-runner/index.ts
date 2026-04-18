/**
 * synthetic-runner — executa checks sintéticos pendentes (cron 1min).
 *
 * Lê `synthetic_checks` enabled cujo last_run_at + interval <= now(),
 * pinga o target, mede latência, insere `synthetic_results` e atualiza
 * `consecutive_failures`. Pode também rodar 1 check on-demand via POST { check_id }.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Check {
  id: string;
  workspace_id: string;
  target: string;
  interval_minutes: number;
  expected_status_max_ms: number;
  consecutive_failures: number;
  last_run_at: string | null;
}

async function pingTarget(target: string): Promise<{ success: boolean; latency_ms: number; status_code: number | null; error: string | null }> {
  const start = performance.now();
  try {
    let url: string;
    let init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE}`,
        apikey: SERVICE_ROLE,
        "x-synthetic-probe": "1",
      },
      signal: AbortSignal.timeout(15_000),
    };

    if (target === "health") {
      url = `${SUPABASE_URL}/rest/v1/`;
      init = { method: "GET", headers: { apikey: SERVICE_ROLE }, signal: AbortSignal.timeout(15_000) };
    } else if (target === "llm-gateway") {
      url = `${SUPABASE_URL}/functions/v1/llm-gateway`;
      init.body = JSON.stringify({ synthetic: true, messages: [{ role: "user", content: "ping" }], model: "google/gemini-2.5-flash-lite" });
    } else if (target === "agent-workflow-runner") {
      url = `${SUPABASE_URL}/functions/v1/agent-workflow-runner`;
      init.body = JSON.stringify({ synthetic: true });
    } else {
      return { success: false, latency_ms: 0, status_code: null, error: `unknown target: ${target}` };
    }

    const resp = await fetch(url, init);
    const latency_ms = Math.round(performance.now() - start);
    // Synthetic probes accept 2xx OR 4xx (auth/validation = service alive); only 5xx + network = down
    const success = resp.status < 500;
    return {
      success,
      latency_ms,
      status_code: resp.status,
      error: success ? null : `HTTP ${resp.status}`,
    };
  } catch (e) {
    return {
      success: false,
      latency_ms: Math.round(performance.now() - start),
      status_code: null,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  try {
    let checks: Check[] = [];

    // On-demand mode: { check_id }
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      if (body?.check_id) {
        const { data } = await admin
          .from("synthetic_checks")
          .select("*")
          .eq("id", body.check_id)
          .eq("enabled", true)
          .maybeSingle();
        if (data) checks = [data as Check];
      }
    }

    // Cron mode: pick all due checks
    if (checks.length === 0) {
      const { data } = await admin
        .from("synthetic_checks")
        .select("*")
        .eq("enabled", true)
        .limit(50);
      const now = Date.now();
      checks = (data ?? []).filter((c: Check) => {
        if (!c.last_run_at) return true;
        const due = new Date(c.last_run_at).getTime() + c.interval_minutes * 60_000;
        return due <= now;
      });
    }

    const results: Array<{ check_id: string; success: boolean; latency_ms: number }> = [];

    for (const check of checks) {
      const ping = await pingTarget(check.target);
      const latencyOk = ping.latency_ms <= check.expected_status_max_ms;
      const finalSuccess = ping.success && latencyOk;
      const errorMsg = ping.error ?? (latencyOk ? null : `latency ${ping.latency_ms}ms > ${check.expected_status_max_ms}ms`);

      await admin.from("synthetic_results").insert({
        check_id: check.id,
        success: finalSuccess,
        latency_ms: ping.latency_ms,
        status_code: ping.status_code,
        error_message: errorMsg,
      });

      const newFailures = finalSuccess ? 0 : check.consecutive_failures + 1;
      await admin
        .from("synthetic_checks")
        .update({
          last_run_at: new Date().toISOString(),
          consecutive_failures: newFailures,
        })
        .eq("id", check.id);

      results.push({ check_id: check.id, success: finalSuccess, latency_ms: ping.latency_ms });
    }

    return new Response(JSON.stringify({ ran: results.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("synthetic-runner error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
