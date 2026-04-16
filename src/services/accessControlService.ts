/**
 * Nexus — IP Restriction + Geo-Blocking Service
 * Manages allowed IPs/CIDRs and country whitelists per workspace,
 * plus reads the access_blocked_log audit trail.
 */
import { supabase } from "@/integrations/supabase/client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface IpWhitelistEntry {
  id: string;
  workspace_id: string;
  ip_address: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface GeoCountry {
  id: string;
  workspace_id: string;
  country_code: string;
  country_name: string | null;
  created_at: string;
}

export interface AccessBlockedEntry {
  id: string;
  workspace_id: string | null;
  user_id: string | null;
  ip_address: string | null;
  country_code: string | null;
  reason: string;
  user_agent: string | null;
  created_at: string;
}

// ─── IP Whitelist ───────────────────────────────────────────────
export async function listIpWhitelist(workspaceId: string): Promise<IpWhitelistEntry[]> {
  const { data, error } = await db
    .from("ip_whitelist")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as IpWhitelistEntry[];
}

export async function addIpWhitelist(
  workspaceId: string,
  ipAddress: string,
  label?: string,
): Promise<IpWhitelistEntry> {
  const { data, error } = await db
    .from("ip_whitelist")
    .insert({ workspace_id: workspaceId, ip_address: ipAddress, label: label ?? null })
    .select("*")
    .single();
  if (error) throw error;
  return data as IpWhitelistEntry;
}

export async function toggleIpWhitelist(id: string, isActive: boolean) {
  const { error } = await db
    .from("ip_whitelist")
    .update({ is_active: isActive })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteIpWhitelist(id: string) {
  const { error } = await db.from("ip_whitelist").delete().eq("id", id);
  if (error) throw error;
}

// ─── Geo Allowed Countries ──────────────────────────────────────
export async function listAllowedCountries(workspaceId: string): Promise<GeoCountry[]> {
  const { data, error } = await db
    .from("geo_allowed_countries")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("country_code");
  if (error) throw error;
  return (data ?? []) as GeoCountry[];
}

export async function addAllowedCountry(
  workspaceId: string,
  countryCode: string,
  countryName?: string,
): Promise<GeoCountry> {
  const { data, error } = await db
    .from("geo_allowed_countries")
    .insert({
      workspace_id: workspaceId,
      country_code: countryCode.toUpperCase(),
      country_name: countryName ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as GeoCountry;
}

export async function deleteAllowedCountry(id: string) {
  const { error } = await db.from("geo_allowed_countries").delete().eq("id", id);
  if (error) throw error;
}

// ─── Access Blocked Log ─────────────────────────────────────────
export async function listAccessBlockedLog(
  workspaceId: string,
  limit = 50,
): Promise<AccessBlockedEntry[]> {
  const { data, error } = await db
    .from("access_blocked_log")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as AccessBlockedEntry[];
}

// ─── Validation (server-side check) ─────────────────────────────
export async function validateAccess(workspaceId: string) {
  const { data, error } = await supabase.functions.invoke("validate-access", {
    body: { workspace_id: workspaceId },
  });
  if (error) throw error;
  return data as { allowed: boolean; reason?: string; ip?: string; country?: string };
}
