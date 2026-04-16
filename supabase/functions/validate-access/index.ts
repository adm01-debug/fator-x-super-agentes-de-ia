/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Validate Access (IP + Geo)
 * ═══════════════════════════════════════════════════════════════
 * Checks whether the caller's IP and country are allowed for a
 * given workspace. Returns { allowed, reason }.
 *
 * Uses Cloudflare / standard headers:
 *   - cf-connecting-ip, x-forwarded-for, x-real-ip
 *   - cf-ipcountry, x-vercel-ip-country
 *
 * Logs blocked attempts to access_blocked_log.
 *
 * NOTE: This is a "best-effort" check intended for app-level
 * defence-in-depth — production deployments should also enforce
 * IP/Geo rules at the edge/CDN/WAF layer.
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function extractIp(req: Request): string | null {
  const h = req.headers;
  return (
    h.get("cf-connecting-ip") ||
    h.get("x-real-ip") ||
    (h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null)
  );
}

function extractCountry(req: Request): string | null {
  const h = req.headers;
  const c =
    h.get("cf-ipcountry") ||
    h.get("x-vercel-ip-country") ||
    h.get("x-country-code");
  return c ? c.toUpperCase() : null;
}

/** Naive CIDR match (IPv4) — supports `1.2.3.4` and `1.2.3.0/24`. */
function ipMatches(ip: string, rule: string): boolean {
  if (!ip || !rule) return false;
  if (!rule.includes("/")) return ip === rule;
  const [base, bitsStr] = rule.split("/");
  const bits = parseInt(bitsStr, 10);
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return false;
  const toInt = (s: string) =>
    s.split(".").reduce((acc, p) => (acc << 8) | (parseInt(p, 10) & 0xff), 0) >>> 0;
  const ipInt = toInt(ip);
  const baseInt = toInt(base);
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response(null, { headers: corsHeaders });

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const workspaceId: string | null = body?.workspace_id ?? null;
    const userId: string | null = body?.user_id ?? null;

    const ip = extractIp(req);
    const country = extractCountry(req);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // If no workspace context, only signal what we detected.
    if (!workspaceId) {
      return new Response(
        JSON.stringify({ allowed: true, ip, country, reason: "no workspace context" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── 1. IP whitelist check ────────────────────────────────────
    const { data: ipRules } = await supabase
      .from("ip_whitelist")
      .select("ip_address")
      .eq("workspace_id", workspaceId)
      .eq("is_active", true);

    const hasIpRules = (ipRules?.length ?? 0) > 0;
    if (hasIpRules) {
      const allowed = ip
        ? ipRules!.some((r: { ip_address: string }) => ipMatches(ip, r.ip_address))
        : false;
      if (!allowed) {
        await supabase.from("access_blocked_log").insert({
          workspace_id: workspaceId,
          user_id: userId,
          ip_address: ip,
          country_code: country,
          reason: "ip_not_whitelisted",
          user_agent: req.headers.get("user-agent"),
        });
        return new Response(
          JSON.stringify({ allowed: false, reason: "ip_not_whitelisted", ip, country }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    // ── 2. Geo check ─────────────────────────────────────────────
    const { data: geoRules } = await supabase
      .from("geo_allowed_countries")
      .select("country_code")
      .eq("workspace_id", workspaceId);

    const hasGeoRules = (geoRules?.length ?? 0) > 0;
    if (hasGeoRules) {
      const allowed = country
        ? geoRules!.some(
            (g: { country_code: string }) =>
              g.country_code.toUpperCase() === country,
          )
        : false;
      if (!allowed) {
        await supabase.from("access_blocked_log").insert({
          workspace_id: workspaceId,
          user_id: userId,
          ip_address: ip,
          country_code: country,
          reason: "country_not_allowed",
          user_agent: req.headers.get("user-agent"),
        });
        return new Response(
          JSON.stringify({ allowed: false, reason: "country_not_allowed", ip, country }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(
      JSON.stringify({ allowed: true, ip, country }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("validate-access error", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
