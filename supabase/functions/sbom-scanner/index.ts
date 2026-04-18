import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ScanRequest {
  workspace_id: string;
  snapshot_id: string;
}

interface OSVVuln {
  id: string;
  summary?: string;
  details?: string;
  severity?: Array<{ type: string; score: string }>;
  affected?: Array<{
    package: { name: string; ecosystem: string };
    ranges?: Array<{ events: Array<{ fixed?: string }> }>;
  }>;
  references?: Array<{ url: string }>;
  database_specific?: { severity?: string; cvss_score?: number };
}

function severityFromCvss(score: number | null): "critical" | "high" | "medium" | "low" {
  if (score === null) return "medium";
  if (score >= 9) return "critical";
  if (score >= 7) return "high";
  if (score >= 4) return "medium";
  return "low";
}

function parseCvssScore(severity?: Array<{ type: string; score: string }>): number | null {
  if (!severity?.length) return null;
  const cvss = severity.find((s) => s.type.startsWith("CVSS"));
  if (!cvss) return null;
  const match = cvss.score.match(/CVSS:[\d.]+\/.*?\/.*?(\d+\.\d+)/);
  if (match) return parseFloat(match[1]);
  // sometimes score is just a number
  const num = parseFloat(cvss.score);
  return isNaN(num) ? null : num;
}

function ecosystemMap(eco: string): string {
  const map: Record<string, string> = {
    npm: "npm",
    deno: "npm",
    pypi: "PyPI",
    cargo: "crates.io",
    go: "Go",
    maven: "Maven",
    rubygems: "RubyGems",
  };
  return map[eco] || "npm";
}

function getFixedVersion(vuln: OSVVuln, pkgName: string): string | null {
  const aff = vuln.affected?.find((a) => a.package.name === pkgName);
  if (!aff?.ranges) return null;
  for (const range of aff.ranges) {
    for (const event of range.events) {
      if (event.fixed) return event.fixed;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "missing auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: ScanRequest = await req.json();
    if (!body.workspace_id || !body.snapshot_id) {
      return new Response(JSON.stringify({ error: "workspace_id and snapshot_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify admin via RLS-aware query
    const { data: snap, error: snapErr } = await userClient
      .from("sbom_snapshots")
      .select("id, workspace_id")
      .eq("id", body.snapshot_id)
      .single();
    if (snapErr || !snap) {
      return new Response(JSON.stringify({ error: "snapshot not found or forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch components
    const { data: components, error: compErr } = await supabase
      .from("sbom_components")
      .select("id, name, version, ecosystem")
      .eq("snapshot_id", body.snapshot_id);
    if (compErr) throw compErr;

    const counts = { scanned: 0, found_critical: 0, found_high: 0, found_medium: 0, found_low: 0 };

    for (const comp of components || []) {
      counts.scanned += 1;
      try {
        const osvRes = await fetch("https://api.osv.dev/v1/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            package: { name: comp.name, ecosystem: ecosystemMap(comp.ecosystem) },
            version: comp.version,
          }),
        });
        if (!osvRes.ok) continue;
        const osvData = await osvRes.json();
        const vulns: OSVVuln[] = osvData.vulns || [];

        for (const v of vulns) {
          const cvss = parseCvssScore(v.severity) ?? v.database_specific?.cvss_score ?? null;
          const sev = severityFromCvss(cvss);
          const fixedVer = getFixedVersion(v, comp.name);
          const refUrl = v.references?.[0]?.url || `https://osv.dev/vulnerability/${v.id}`;

          await supabase.rpc("record_vulnerability", {
            p_snapshot_id: body.snapshot_id,
            p_component_id: comp.id,
            p_cve_id: v.id,
            p_severity: sev,
            p_cvss_score: cvss,
            p_summary: (v.summary || v.details || "").slice(0, 500),
            p_fixed_version: fixedVer,
            p_reference_url: refUrl,
          });

          counts[`found_${sev}` as keyof typeof counts] += 1;
        }
      } catch (e) {
        console.error(`scan failed for ${comp.name}@${comp.version}:`, e);
      }
    }

    return new Response(JSON.stringify({ ok: true, ...counts }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("sbom-scanner error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
