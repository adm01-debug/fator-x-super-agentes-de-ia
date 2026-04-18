/**
 * Sprint 44 — Incident Response Playbooks service
 */
import { supabase } from '@/integrations/supabase/client';

export type IRIncidentType = 'data_breach' | 'ddos' | 'ransomware' | 'account_takeover' | 'insider_threat' | 'service_outage' | 'supply_chain' | 'other';
export type IRSeverity = 'low' | 'medium' | 'high' | 'critical';
export type IRPlaybookStatus = 'draft' | 'active' | 'archived';
export type IRPhase = 'detect' | 'contain' | 'eradicate' | 'recover' | 'postmortem';
export type IRTabletopOutcome = 'pass' | 'partial' | 'fail' | 'scheduled';

export interface IRPlaybook {
  id: string;
  workspace_id: string;
  name: string;
  incident_type: IRIncidentType;
  severity_default: IRSeverity;
  description: string | null;
  owner_id: string | null;
  version: number;
  status: IRPlaybookStatus;
  last_reviewed_at: string | null;
  next_review_due: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface IRPlaybookStep {
  id: string;
  playbook_id: string;
  step_order: number;
  phase: IRPhase;
  title: string;
  instructions: string | null;
  expected_duration_minutes: number | null;
  responsible_role: string | null;
  automation_hint: string | null;
  created_at: string;
}

export interface IRTabletopExercise {
  id: string;
  playbook_id: string;
  workspace_id: string;
  scheduled_for: string;
  executed_at: string | null;
  scenario: string;
  participants: string[];
  facilitator_id: string | null;
  outcome: IRTabletopOutcome;
  gaps: string[];
  action_items: string | null;
  mttr_actual_minutes: number | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface IRSummary {
  active_playbooks: number;
  reviews_overdue: number;
  avg_mttr_minutes: number;
  open_gaps: number;
  by_type: Record<string, number>;
}

export const INCIDENT_TYPE_LABELS: Record<IRIncidentType, string> = {
  data_breach: 'Vazamento de dados',
  ddos: 'DDoS',
  ransomware: 'Ransomware',
  account_takeover: 'Conta comprometida',
  insider_threat: 'Ameaça interna',
  service_outage: 'Indisponibilidade',
  supply_chain: 'Supply chain',
  other: 'Outro',
};

export const PHASE_LABELS: Record<IRPhase, string> = {
  detect: '1. Detectar',
  contain: '2. Conter',
  eradicate: '3. Erradicar',
  recover: '4. Recuperar',
  postmortem: '5. Postmortem',
};

export const SEVERITY_LABELS: Record<IRSeverity, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
  critical: 'Crítica',
};

export const OUTCOME_LABELS: Record<IRTabletopOutcome, string> = {
  pass: 'Aprovado',
  partial: 'Parcial',
  fail: 'Falhou',
  scheduled: 'Agendado',
};

export function isReviewOverdue(p: IRPlaybook): boolean {
  return p.status === 'active' && !!p.next_review_due && new Date(p.next_review_due) < new Date();
}

export function severityVariant(s: IRSeverity): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (s === 'critical') return 'destructive';
  if (s === 'high') return 'destructive';
  if (s === 'medium') return 'default';
  return 'secondary';
}

export function outcomeVariant(o: IRTabletopOutcome): 'default' | 'secondary' | 'destructive' | 'outline' {
  if (o === 'pass') return 'default';
  if (o === 'partial') return 'secondary';
  if (o === 'fail') return 'destructive';
  return 'outline';
}

export async function listPlaybooks(workspaceId: string): Promise<IRPlaybook[]> {
  const { data, error } = await supabase.from('ir_playbooks').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IRPlaybook[];
}

export async function createPlaybook(input: {
  workspace_id: string;
  name: string;
  incident_type: IRIncidentType;
  severity_default: IRSeverity;
  description?: string;
  owner_id?: string;
  created_by: string;
}): Promise<string> {
  const { data, error } = await (supabase.from('ir_playbooks') as never as { insert: (p: typeof input) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } })
    .insert(input).select('id').single();
  if (error) throw error;
  return data!.id;
}

export async function activatePlaybook(playbookId: string): Promise<void> {
  const { error } = await supabase.rpc('activate_ir_playbook', { p_playbook_id: playbookId });
  if (error) throw error;
}

export async function archivePlaybook(playbookId: string): Promise<void> {
  const { error } = await supabase.from('ir_playbooks').update({ status: 'archived' }).eq('id', playbookId);
  if (error) throw error;
}

export async function deletePlaybook(playbookId: string): Promise<void> {
  const { error } = await supabase.from('ir_playbooks').delete().eq('id', playbookId);
  if (error) throw error;
}

export async function listSteps(playbookId: string): Promise<IRPlaybookStep[]> {
  const { data, error } = await supabase.from('ir_playbook_steps').select('*').eq('playbook_id', playbookId).order('step_order');
  if (error) throw error;
  return (data ?? []) as unknown as IRPlaybookStep[];
}

export async function addStep(input: Omit<IRPlaybookStep, 'id' | 'created_at'>): Promise<string> {
  const { data, error } = await (supabase.from('ir_playbook_steps') as never as { insert: (p: typeof input) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } })
    .insert(input).select('id').single();
  if (error) throw error;
  return data!.id;
}

export async function deleteStep(stepId: string): Promise<void> {
  const { error } = await supabase.from('ir_playbook_steps').delete().eq('id', stepId);
  if (error) throw error;
}

export async function listTabletops(workspaceId: string): Promise<IRTabletopExercise[]> {
  const { data, error } = await supabase.from('ir_tabletop_exercises').select('*').eq('workspace_id', workspaceId).order('scheduled_for', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IRTabletopExercise[];
}

export async function recordTabletop(input: {
  playbook_id: string;
  workspace_id: string;
  scheduled_for: string;
  executed_at?: string | null;
  scenario: string;
  participants: string[];
  facilitator_id?: string;
  outcome: IRTabletopOutcome;
  gaps: string[];
  action_items?: string;
  mttr_actual_minutes?: number;
  notes?: string;
  created_by: string;
}): Promise<string> {
  const { data, error } = await (supabase.from('ir_tabletop_exercises') as never as { insert: (p: typeof input) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } })
    .insert(input).select('id').single();
  if (error) throw error;
  return data!.id;
}

export async function getSummary(workspaceId: string): Promise<IRSummary> {
  const { data, error } = await supabase.rpc('get_ir_summary', { p_workspace_id: workspaceId });
  if (error) throw error;
  return data as unknown as IRSummary;
}
