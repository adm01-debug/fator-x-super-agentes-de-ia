import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AssetType = Database["public"]["Enums"]["asset_type"];
export type AssetEnvironment = Database["public"]["Enums"]["asset_environment"];
export type AssetClassification = Database["public"]["Enums"]["asset_classification"];
export type AssetStatus = Database["public"]["Enums"]["asset_status"];

export type Asset = Database["public"]["Tables"]["assets"]["Row"];
export type AssetAudit = Database["public"]["Tables"]["asset_audits"]["Row"];

export interface AssetSummary {
  total: number;
  active: number;
  no_owner: number;
  audit_overdue: number;
  warranty_expiring: number;
  by_type: Record<string, number>;
  by_classification: Record<string, number>;
  by_environment: Record<string, number>;
}

export async function listAssets(workspaceId: string): Promise<Asset[]> {
  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getAssetSummary(workspaceId: string): Promise<AssetSummary> {
  const { data, error } = await supabase.rpc("get_asset_summary", { p_workspace_id: workspaceId });
  if (error) throw error;
  return data as unknown as AssetSummary;
}

export interface RegisterAssetInput {
  workspace_id: string;
  name: string;
  asset_type: AssetType;
  classification?: AssetClassification;
  environment?: AssetEnvironment;
  category?: string | null;
  owner_id?: string | null;
  vendor?: string | null;
  model?: string | null;
  serial_number?: string | null;
  hostname?: string | null;
  ip_address?: string | null;
  os?: string | null;
  version?: string | null;
  location?: string | null;
  purchased_at?: string | null;
  warranty_until?: string | null;
  tags?: string[];
}

export async function registerAsset(input: RegisterAssetInput): Promise<string> {
  const { data, error } = await supabase.rpc("register_asset", {
    p_workspace_id: input.workspace_id,
    p_name: input.name,
    p_asset_type: input.asset_type,
    p_classification: input.classification ?? "internal",
    p_environment: input.environment ?? "production",
    p_category: input.category ?? undefined,
    p_owner_id: input.owner_id ?? undefined,
    p_vendor: input.vendor ?? undefined,
    p_model: input.model ?? undefined,
    p_serial_number: input.serial_number ?? undefined,
    p_hostname: input.hostname ?? undefined,
    p_ip_address: input.ip_address ?? undefined,
    p_os: input.os ?? undefined,
    p_version: input.version ?? undefined,
    p_location: input.location ?? undefined,
    p_purchased_at: input.purchased_at ?? undefined,
    p_warranty_until: input.warranty_until ?? undefined,
    p_tags: input.tags ?? [],
  });
  if (error) throw error;
  return data as string;
}

export async function auditAsset(
  assetId: string,
  findings: string,
  statusAfter: AssetStatus = "active",
  notes?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc("audit_asset", {
    p_asset_id: assetId,
    p_findings: findings,
    p_status_after: statusAfter,
    p_notes: notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function decommissionAsset(assetId: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("decommission_asset", {
    p_asset_id: assetId,
    p_reason: reason,
  });
  if (error) throw error;
}

export async function listAssetAudits(assetId: string): Promise<AssetAudit[]> {
  const { data, error } = await supabase
    .from("asset_audits")
    .select("*")
    .eq("asset_id", assetId)
    .order("audited_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Helpers
export function isWarrantyExpiring(asset: Asset, daysAhead = 30): boolean {
  if (!asset.warranty_until) return false;
  const today = new Date();
  const warranty = new Date(asset.warranty_until);
  const diff = (warranty.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= daysAhead;
}

export function isAuditOverdue(asset: Asset, days = 90): boolean {
  if (asset.status === "decommissioned") return false;
  if (!asset.last_seen_at) return true;
  const last = new Date(asset.last_seen_at);
  const diff = (Date.now() - last.getTime()) / (1000 * 60 * 60 * 24);
  return diff > days;
}
