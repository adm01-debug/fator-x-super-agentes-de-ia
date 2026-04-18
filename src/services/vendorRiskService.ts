import { supabase } from "@/integrations/supabase/client";

export type VendorType = "saas" | "processor" | "api" | "infra" | "consulting" | "other";
export type Criticality = "critical" | "high" | "medium" | "low";
export type DataClassification = "pii" | "phi" | "financial" | "confidential" | "public";
export type VendorStatus = "active" | "under_review" | "suspended" | "offboarded";
export type DocType = "dpa" | "soc2" | "iso27001" | "pentest_report" | "questionnaire" | "contract" | "other";

export interface Vendor {
  id: string;
  workspace_id: string;
  name: string;
  vendor_type: VendorType;
  website: string | null;
  contact_email: string | null;
  criticality: Criticality;
  data_classification: DataClassification;
  status: VendorStatus;
  onboarded_at: string;
  offboarded_at: string | null;
  dpa_signed: boolean;
  dpa_expires_at: string | null;
  soc2_valid_until: string | null;
  iso27001_valid_until: string | null;
  next_review_due: string | null;
  notes: string | null;
  owner_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface VendorAssessment {
  id: string;
  vendor_id: string;
  assessed_by: string;
  assessed_at: string;
  security_score: number;
  compliance_score: number;
  operational_score: number;
  risk_score: number;
  findings: string[];
  recommendations: string | null;
  next_review_due: string | null;
  created_at: string;
}

export interface VendorDocument {
  id: string;
  vendor_id: string;
  doc_type: DocType;
  title: string;
  file_url: string | null;
  valid_until: string | null;
  uploaded_by: string;
  uploaded_at: string;
  notes: string | null;
}

export interface VendorSummary {
  total: number;
  active: number;
  critical: number;
  dpa_expiring: number;
  dpa_expired: number;
  certs_expired: number;
  overdue_reviews: number;
  by_type: Record<string, number>;
  by_criticality: Record<string, number>;
}

export async function listVendors(workspaceId: string): Promise<Vendor[]> {
  const { data, error } = await (supabase as any)
    .from("vendors")
    .select("*")
    .eq("workspace_id", workspaceId)
    .order("criticality", { ascending: true })
    .order("name", { ascending: true });
  if (error) throw error;
  return (data || []) as Vendor[];
}

export async function getVendor(id: string): Promise<Vendor | null> {
  const { data, error } = await (supabase as any).from("vendors").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Vendor | null;
}

export async function listAssessments(vendorId: string): Promise<VendorAssessment[]> {
  const { data, error } = await (supabase as any)
    .from("vendor_assessments")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("assessed_at", { ascending: false });
  if (error) throw error;
  return (data || []) as VendorAssessment[];
}

export async function listDocuments(vendorId: string): Promise<VendorDocument[]> {
  const { data, error } = await (supabase as any)
    .from("vendor_documents")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("uploaded_at", { ascending: false });
  if (error) throw error;
  return (data || []) as VendorDocument[];
}

export interface RegisterVendorInput {
  workspaceId: string;
  name: string;
  vendorType: VendorType;
  criticality: Criticality;
  dataClassification: DataClassification;
  website?: string;
  contactEmail?: string;
  dpaSigned?: boolean;
  dpaExpiresAt?: string | null;
  soc2ValidUntil?: string | null;
  iso27001ValidUntil?: string | null;
  ownerId?: string | null;
  notes?: string;
}

export async function registerVendor(i: RegisterVendorInput): Promise<string> {
  const { data, error } = await (supabase as any).rpc("register_vendor", {
    p_workspace_id: i.workspaceId,
    p_name: i.name,
    p_vendor_type: i.vendorType,
    p_criticality: i.criticality,
    p_data_classification: i.dataClassification,
    p_website: i.website ?? null,
    p_contact_email: i.contactEmail ?? null,
    p_dpa_signed: i.dpaSigned ?? false,
    p_dpa_expires_at: i.dpaExpiresAt ?? null,
    p_soc2_valid_until: i.soc2ValidUntil ?? null,
    p_iso27001_valid_until: i.iso27001ValidUntil ?? null,
    p_owner_id: i.ownerId ?? null,
    p_notes: i.notes ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function assessVendor(input: {
  vendorId: string;
  securityScore: number;
  complianceScore: number;
  operationalScore: number;
  findings?: string[];
  recommendations?: string;
}): Promise<string> {
  const { data, error } = await (supabase as any).rpc("assess_vendor", {
    p_vendor_id: input.vendorId,
    p_security_score: input.securityScore,
    p_compliance_score: input.complianceScore,
    p_operational_score: input.operationalScore,
    p_findings: input.findings ?? [],
    p_recommendations: input.recommendations ?? null,
  });
  if (error) throw error;
  return data as string;
}

export async function offboardVendor(vendorId: string, notes?: string): Promise<void> {
  const { error } = await (supabase as any).rpc("offboard_vendor", {
    p_vendor_id: vendorId,
    p_notes: notes ?? null,
  });
  if (error) throw error;
}

export async function uploadVendorDocument(input: {
  vendorId: string;
  docType: DocType;
  title: string;
  fileUrl?: string;
  validUntil?: string | null;
  notes?: string;
}): Promise<VendorDocument> {
  const { data: u } = await supabase.auth.getUser();
  const userId = u.user?.id;
  if (!userId) throw new Error("not authenticated");

  const { data, error } = await (supabase as any)
    .from("vendor_documents")
    .insert({
      vendor_id: input.vendorId,
      doc_type: input.docType,
      title: input.title,
      file_url: input.fileUrl ?? null,
      valid_until: input.validUntil ?? null,
      notes: input.notes ?? null,
      uploaded_by: userId,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data as VendorDocument;
}

export async function getVendorSummary(workspaceId: string): Promise<VendorSummary> {
  const { data, error } = await (supabase as any).rpc("get_vendor_summary", { p_workspace_id: workspaceId });
  if (error) throw error;
  return data as VendorSummary;
}

// ============ Helpers ============

export function isDpaExpired(v: Vendor): boolean {
  return !!v.dpa_signed && !!v.dpa_expires_at && new Date(v.dpa_expires_at) < new Date();
}

export function isDpaExpiringSoon(v: Vendor, days = 30): boolean {
  if (!v.dpa_signed || !v.dpa_expires_at) return false;
  const exp = new Date(v.dpa_expires_at).getTime();
  const now = Date.now();
  return exp >= now && exp <= now + days * 86_400_000;
}

export function isCertExpired(date: string | null | undefined): boolean {
  return !!date && new Date(date) < new Date();
}

export function isReviewOverdue(v: Vendor): boolean {
  return v.status !== "offboarded" && !!v.next_review_due && new Date(v.next_review_due) < new Date();
}

export function criticalityColor(c: Criticality): string {
  switch (c) {
    case "critical": return "bg-destructive/15 text-destructive border-destructive/30";
    case "high": return "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30";
    case "medium": return "bg-primary/12 text-primary border-primary/30";
    default: return "bg-secondary text-muted-foreground border-border/40";
  }
}

export function statusColor(s: VendorStatus): string {
  switch (s) {
    case "active": return "bg-emerald-500/15 text-emerald-500 border-emerald-500/30";
    case "under_review": return "bg-primary/12 text-primary border-primary/30";
    case "suspended": return "bg-nexus-amber/15 text-nexus-amber border-nexus-amber/30";
    case "offboarded": return "bg-secondary text-muted-foreground border-border/40";
  }
}
