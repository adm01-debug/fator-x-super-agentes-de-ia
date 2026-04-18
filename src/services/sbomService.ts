import { supabase } from "@/integrations/supabase/client";

export type SBOMSnapshot = {
  id: string;
  workspace_id: string;
  name: string;
  format: string;
  source: string;
  total_components: number;
  generated_by: string;
  created_at: string;
  notes?: string | null;
};

export type SBOMComponent = {
  id: string;
  snapshot_id: string;
  name: string;
  version: string;
  ecosystem: string;
  license?: string | null;
  direct: boolean;
  supplier?: string | null;
  purl?: string | null;
};

export type VulnerabilityFinding = {
  id: string;
  workspace_id: string;
  snapshot_id: string;
  component_id: string | null;
  cve_id: string;
  severity: "critical" | "high" | "medium" | "low";
  cvss_score: number | null;
  summary: string | null;
  fixed_version: string | null;
  reference_url: string | null;
  status: "open" | "acknowledged" | "fixed" | "accepted_risk";
  notes: string | null;
  discovered_at: string;
  resolved_at: string | null;
};

export type ParsedComponent = {
  name: string;
  version: string;
  ecosystem: string;
  direct: boolean;
  license?: string;
  purl?: string;
};

export function parsePackageJson(content: string): ParsedComponent[] {
  const pkg = JSON.parse(content);
  const components: ParsedComponent[] = [];
  const cleanVer = (v: string) => v.replace(/^[\^~>=<]+/, "").split(" ")[0];

  for (const [name, version] of Object.entries((pkg.dependencies as Record<string, string>) || {})) {
    components.push({
      name,
      version: cleanVer(version),
      ecosystem: "npm",
      direct: true,
      purl: `pkg:npm/${name}@${cleanVer(version)}`,
    });
  }
  for (const [name, version] of Object.entries((pkg.devDependencies as Record<string, string>) || {})) {
    components.push({
      name,
      version: cleanVer(version),
      ecosystem: "npm",
      direct: false,
      purl: `pkg:npm/${name}@${cleanVer(version)}`,
    });
  }
  return components;
}

export async function listSnapshots(workspaceId: string): Promise<SBOMSnapshot[]> {
  const { data, error } = await supabase
    .from("sbom_snapshots")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []) as SBOMSnapshot[];
}

export async function createSnapshot(
  workspaceId: string,
  name: string,
  components: ParsedComponent[],
  source: "package.json" | "manual" | "upload" = "package.json",
): Promise<string> {
  const { data, error } = await supabase.rpc("create_sbom_snapshot", {
    p_workspace_id: workspaceId,
    p_name: name,
    p_format: "cyclonedx",
    p_source: source,
    p_components: components,
  });
  if (error) throw error;
  return data as string;
}

export async function getSnapshotComponents(snapshotId: string): Promise<SBOMComponent[]> {
  const { data, error } = await supabase
    .from("sbom_components")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("name");
  if (error) throw error;
  return (data || []) as SBOMComponent[];
}

export async function getSnapshotVulnerabilities(snapshotId: string): Promise<VulnerabilityFinding[]> {
  const { data, error } = await supabase
    .from("vulnerability_findings")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .order("severity", { ascending: true })
    .order("discovered_at", { ascending: false });
  if (error) throw error;
  return (data || []) as VulnerabilityFinding[];
}

export async function listWorkspaceVulnerabilities(workspaceId: string): Promise<VulnerabilityFinding[]> {
  const { data, error } = await supabase
    .from("vulnerability_findings")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("discovered_at", { ascending: false });
  if (error) throw error;
  return (data || []) as VulnerabilityFinding[];
}

export async function scanSnapshot(workspaceId: string, snapshotId: string) {
  const { data, error } = await supabase.functions.invoke("sbom-scanner", {
    body: { workspace_id: workspaceId, snapshot_id: snapshotId },
  });
  if (error) throw error;
  return data as { scanned: number; found_critical: number; found_high: number; found_medium: number; found_low: number };
}

export async function acknowledgeVulnerability(id: string, notes: string) {
  const { error } = await supabase.rpc("acknowledge_vulnerability", { p_finding_id: id, p_notes: notes });
  if (error) throw error;
}

export async function markVulnerabilityFixed(id: string, notes: string) {
  const { error } = await supabase.rpc("mark_vulnerability_fixed", { p_finding_id: id, p_notes: notes });
  if (error) throw error;
}

export async function deleteSnapshot(id: string) {
  const { error } = await supabase.from("sbom_snapshots").delete().eq("id", id);
  if (error) throw error;
}

export function severityCounts(findings: VulnerabilityFinding[]) {
  return {
    critical: findings.filter((f) => f.severity === "critical" && f.status === "open").length,
    high: findings.filter((f) => f.severity === "high" && f.status === "open").length,
    medium: findings.filter((f) => f.severity === "medium" && f.status === "open").length,
    low: findings.filter((f) => f.severity === "low" && f.status === "open").length,
  };
}
