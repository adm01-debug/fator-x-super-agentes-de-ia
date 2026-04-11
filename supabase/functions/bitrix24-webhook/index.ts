/**
 * ════════════════════════════════════════════════════════════════════
 * Bitrix24 Webhook Receiver — Nexus Agents Studio (next-frontier #3)
 * ════════════════════════════════════════════════════════════════════
 *
 * Receives outbound webhooks from Bitrix24, validates the HMAC signature
 * (when configured), looks up the routing target via agent_routing_config,
 * inserts an audit row in bitrix24_webhook_events, and dispatches the
 * payload to the correct agent.
 *
 * Supported event types (Bitrix24 outbound events):
 *   - ONCRMDEALADD          New deal created in CRM
 *   - ONCRMDEALUPDATE       Deal updated
 *   - ONCRMCONTACTADD       New contact created
 *   - ONCRMCONTACTUPDATE    Contact updated
 *   - ONCRMLEADADD          New lead
 *   - ONIMBOTMESSAGEADD     Bot message in chat
 *   - ONTASKADD             New task
 *
 * Bitrix24 sends events as application/x-www-form-urlencoded with this
 * shape:
 *   event=ONCRMDEALADD
 *   event_handler_id=42
 *   data[FIELDS][ID]=1234
 *   auth[domain]=mycompany.bitrix24.com
 *   auth[application_token]=...    <- this is the HMAC secret
 *
 * The application_token is set by Bitrix24 when registering the webhook
 * and acts as a shared secret. We validate it against BITRIX24_APP_TOKEN
 * env var. Mismatched tokens are logged with signature_valid=false but
 * still recorded for forensics.
 *
 * verify_jwt: false (Bitrix24 cannot send JWT — auth is via app_token)
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

// ─── CORS ───
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type, authorization",
};

// ─── Supabase client (service role to bypass RLS) ───
function getServiceClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key);
}

// ─── Form-urlencoded parser with nested keys (data[FIELDS][ID]) ───
function parseFormBody(body: string): Record<string, unknown> {
  const params = new URLSearchParams(body);
  const result: Record<string, unknown> = {};
  for (const [rawKey, value] of params.entries()) {
    // Convert "data[FIELDS][ID]" → ["data","FIELDS","ID"]
    const path = rawKey.replace(/\]/g, "").split("[");
    let cursor: Record<string, unknown> = result;
    for (let i = 0; i < path.length; i++) {
      const seg = path[i];
      if (i === path.length - 1) {
        cursor[seg] = value;
      } else {
        if (typeof cursor[seg] !== "object" || cursor[seg] === null) {
          cursor[seg] = {};
        }
        cursor = cursor[seg] as Record<string, unknown>;
      }
    }
  }
  return result;
}

// ─── HMAC validation (Bitrix24 sends application_token in payload) ───
function validateSignature(parsed: Record<string, unknown>): boolean {
  const expectedToken = Deno.env.get("BITRIX24_APP_TOKEN");
  if (!expectedToken) {
    // No token configured = treat as valid (dev mode); operators should
    // configure BITRIX24_APP_TOKEN before going live.
    return true;
  }
  const auth = parsed.auth as Record<string, unknown> | undefined;
  const received = auth?.application_token;
  if (typeof received !== "string") return false;
  // Constant-time comparison to defeat timing attacks
  if (received.length !== expectedToken.length) return false;
  let diff = 0;
  for (let i = 0; i < received.length; i++) {
    diff |= received.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Resolve workspace from auth.domain or fall back to default ───
async function resolveWorkspace(
  client: ReturnType<typeof createClient>,
  domain?: string
): Promise<string | null> {
  if (!domain) return null;
  // Look up workspace_secrets where bitrix24_domain matches
  const { data } = await client
    .from("workspace_secrets")
    .select("workspace_id")
    .eq("key_name", "bitrix24_domain")
    .eq("key_value", domain)
    .maybeSingle();
  return (data as { workspace_id?: string } | null)?.workspace_id ?? null;
}

// ─── Find routing target ───
async function findAgentRoute(
  client: ReturnType<typeof createClient>,
  workspaceId: string,
  eventType: string
): Promise<string | null> {
  const { data } = await client
    .from("agent_routing_config")
    .select("agent_id")
    .eq("workspace_id", workspaceId)
    .eq("source", "bitrix24")
    .eq("event_type", eventType)
    .eq("is_enabled", true)
    .maybeSingle();
  return (data as { agent_id?: string } | null)?.agent_id ?? null;
}

// ─── Trace ID generator (lightweight, OTel-shaped) ───
function generateTraceId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// ─── Audit log writer ───
interface AuditRow {
  workspace_id: string | null;
  event_type: string;
  bitrix_event_id: string | null;
  raw_payload: Record<string, unknown>;
  signature_valid: boolean;
  routed_agent_id: string | null;
  routing_status: "pending" | "routed" | "no_route" | "failed" | "invalid_signature";
  routing_error: string | null;
  trace_id: string;
  processed_at: string;
}

async function writeAudit(
  client: ReturnType<typeof createClient>,
  row: AuditRow
): Promise<void> {
  const { error } = await client.from("bitrix24_webhook_events").insert(row as Record<string, unknown>);
  if (error) {
    console.error("Audit write failed:", error.message);
  }
}

// ─── Main handler ───
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const traceId = generateTraceId();
  const startTime = Date.now();
  let client: ReturnType<typeof createClient>;
  try {
    client = getServiceClient();
  } catch (err) {
    console.error("Service client init failed", err);
    return new Response(JSON.stringify({ error: "Server configuration error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Bitrix24 sends form-urlencoded; some installations send JSON
  const contentType = req.headers.get("content-type") ?? "";
  let parsed: Record<string, unknown>;
  try {
    if (contentType.includes("application/json")) {
      parsed = await req.json();
    } else {
      const text = await req.text();
      parsed = parseFormBody(text);
    }
  } catch (err) {
    console.error("Body parse failed", err);
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const eventType = String(parsed.event ?? "UNKNOWN");
  const auth = (parsed.auth ?? {}) as Record<string, unknown>;
  const domain = typeof auth.domain === "string" ? auth.domain : undefined;
  const data = (parsed.data ?? {}) as Record<string, unknown>;
  const fields = (data.FIELDS ?? {}) as Record<string, unknown>;
  const bitrixEventId = typeof fields.ID === "string" || typeof fields.ID === "number"
    ? String(fields.ID)
    : null;

  const signatureValid = validateSignature(parsed);
  const workspaceId = await resolveWorkspace(client, domain);

  // Audit base — populated incrementally
  const audit: AuditRow = {
    workspace_id: workspaceId,
    event_type: eventType,
    bitrix_event_id: bitrixEventId,
    raw_payload: parsed,
    signature_valid: signatureValid,
    routed_agent_id: null,
    routing_status: "pending",
    routing_error: null,
    trace_id: traceId,
    processed_at: new Date().toISOString(),
  };

  // ─── 1. Reject if signature invalid ───
  if (!signatureValid) {
    audit.routing_status = "invalid_signature";
    audit.routing_error = "HMAC validation failed";
    await writeAudit(client, audit);
    console.warn("Bitrix24 webhook signature mismatch", { event: eventType, domain });
    return new Response(JSON.stringify({
      error: "Invalid signature",
      trace_id: traceId,
    }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── 2. No workspace = no-op (still log) ───
  if (!workspaceId) {
    audit.routing_status = "no_route";
    audit.routing_error = `Domain "${domain ?? "unknown"}" not registered in workspace_secrets`;
    await writeAudit(client, audit);
    return new Response(JSON.stringify({
      ok: true,
      message: "Logged but no workspace matched",
      trace_id: traceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── 3. Look up routing target ───
  let agentId: string | null = null;
  try {
    agentId = await findAgentRoute(client, workspaceId, eventType);
  } catch (err) {
    audit.routing_status = "failed";
    audit.routing_error = err instanceof Error ? err.message : String(err);
    await writeAudit(client, audit);
    return new Response(JSON.stringify({
      error: "Routing lookup failed",
      trace_id: traceId,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!agentId) {
    audit.routing_status = "no_route";
    audit.routing_error = `No agent_routing_config for event ${eventType}`;
    await writeAudit(client, audit);
    return new Response(JSON.stringify({
      ok: true,
      message: `No agent configured for ${eventType}`,
      trace_id: traceId,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── 4. Dispatch (placeholder — integration with agent runtime is
  //   the responsibility of the next layer; for now we just persist
  //   the routing decision so a downstream worker can pick it up). ───
  audit.routed_agent_id = agentId;
  audit.routing_status = "routed";
  await writeAudit(client, audit);

  // Also create a trace_event entry so the new TracingPanel shows it
  try {
    await (client.from("trace_events").insert as Function)({
      event_type: "bitrix24_webhook",
      data: {
        trace_id: traceId,
        agent_id: agentId,
        workspace_id: workspaceId,
        bitrix_event_id: bitrixEventId,
        bitrix_event_type: eventType,
        duration_ms: Date.now() - startTime,
        status: "ok",
        spans: [{
          span_id: generateTraceId(),
          parent_span_id: null,
          trace_id: traceId,
          name: `bitrix24.${eventType}`,
          kind: "http",
          start_time: startTime,
          end_time: Date.now(),
          duration_ms: Date.now() - startTime,
          status: "ok",
          attributes: {
            "http.method": "POST",
            "bitrix24.domain": domain,
            "bitrix24.event": eventType,
            "bitrix24.event_id": bitrixEventId,
          },
          events: [],
        }],
      },
    });
  } catch (err) {
    console.error("trace_events insert failed", err);
  }

  return new Response(JSON.stringify({
    ok: true,
    routed_to: agentId,
    trace_id: traceId,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
