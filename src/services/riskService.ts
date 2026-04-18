import { supabase } from "@/integrations/supabase/client";

export type RiskCategory = 'strategic' | 'operational' | 'technical' | 'security' | 'compliance' | 'financial' | 'reputational';
export type RiskTreatment = 'accept' | 'mitigate' | 'transfer' | 'avoid';
export type RiskStatus = 'identified' | 'assessed' | 'treated' | 'monitored' | 'closed';

export interface Risk {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  inherent_score: number;
  residual_score: number | null;
  treatment: RiskTreatment;
  mitigation_plan: string | null;
  owner_id: string | null;
  status: RiskStatus;
  identified_at: string;
  next_review_due: string;
  closed_at: string | null;
  related_finding_id: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface RiskReviewEvent {
  id: string;
  risk_id: string;
  reviewed_by: string;
  reviewed_at: string;
  previous_residual_score: number | null;
  new_residual_score: number | null;
  notes: string | null;
}

export interface RiskSummary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  overdue_reviews: number;
  untreated: number;
  closed: number;
  by_category: Record<string, number>;
  by_treatment: Record<string, number>;
  heatmap: { likelihood: number; impact: number; count: number }[];
}

export function getRiskLevel(score: number | null): 'critical' | 'high' | 'medium' | 'low' {
  if (score === null) return 'low';
  if (score >= 15) return 'critical';
  if (score >= 9) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

export function getRiskLevelColor(level: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (level) {
    case 'critical': return 'bg-destructive text-destructive-foreground';
    case 'high': return 'bg-nexus-amber/80 text-background';
    case 'medium': return 'bg-yellow-500/80 text-background';
    case 'low': return 'bg-emerald-500/80 text-background';
  }
}

export function isReviewOverdue(nextReviewDue: string): boolean {
  return new Date(nextReviewDue) < new Date();
}

export async function listRisks(workspaceId: string): Promise<Risk[]> {
  const { data, error } = await supabase
    .from('risk_register')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('residual_score', { ascending: false, nullsFirst: false })
    .order('inherent_score', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Risk[];
}

export async function getRisk(id: string): Promise<Risk | null> {
  const { data, error } = await supabase.from('risk_register').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as Risk | null;
}

export async function listRiskReviews(riskId: string): Promise<RiskReviewEvent[]> {
  const { data, error } = await supabase
    .from('risk_review_events')
    .select('*')
    .eq('risk_id', riskId)
    .order('reviewed_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RiskReviewEvent[];
}

export async function registerRisk(params: {
  workspaceId: string;
  title: string;
  description?: string;
  category: RiskCategory;
  likelihood: number;
  impact: number;
  treatment?: RiskTreatment;
  mitigationPlan?: string;
  ownerId?: string;
  relatedFindingId?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc('register_risk', {
    p_workspace_id: params.workspaceId,
    p_title: params.title,
    p_description: params.description ?? undefined,
    p_category: params.category,
    p_likelihood: params.likelihood,
    p_impact: params.impact,
    p_treatment: params.treatment ?? 'mitigate',
    p_mitigation_plan: params.mitigationPlan ?? undefined,
    p_owner_id: params.ownerId ?? undefined,
    p_related_finding_id: params.relatedFindingId ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function reviewRisk(riskId: string, newResidualScore: number, notes?: string): Promise<string> {
  const { data, error } = await supabase.rpc('review_risk', {
    p_risk_id: riskId,
    p_new_residual_score: newResidualScore,
    p_notes: notes ?? undefined,
  });
  if (error) throw error;
  return data as string;
}

export async function closeRisk(riskId: string, notes?: string): Promise<void> {
  const { error } = await supabase.rpc('close_risk', { p_risk_id: riskId, p_notes: notes ?? undefined });
  if (error) throw error;
}

export async function getRiskSummary(workspaceId: string): Promise<RiskSummary> {
  const { data, error } = await supabase.rpc('get_risk_summary', { p_workspace_id: workspaceId });
  if (error) throw error;
  return data as unknown as RiskSummary;
}
