/**
 * Sprint 33 — Incident Response Automation service
 */
import { supabase } from '@/integrations/supabase/client';

export type TriggerType = 'slo_breach' | 'synthetic_fail' | 'cost_anomaly' | 'budget_block' | 'manual';
export type ActionType = 'notify' | 'disable_chaos' | 'pause_agent' | 'switch_provider' | 'page_oncall';

export interface PlaybookAction {
  type: ActionType;
  config?: Record<string, unknown>;
}

export interface IncidentPlaybook {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  actions: PlaybookAction[];
  enabled: boolean;
  cooldown_minutes: number;
  last_triggered_at?: string | null;
  run_count: number;
  created_at: string;
  updated_at: string;
}

export interface IncidentRun {
  id: string;
  playbook_id: string;
  workspace_id: string;
  triggered_by?: string | null;
  trigger_event: Record<string, unknown>;
  status: 'running' | 'succeeded' | 'failed' | 'partial';
  started_at: string;
  ended_at?: string | null;
  action_results: Array<Record<string, unknown>>;
  notes?: string | null;
}

export interface OncallEntry {
  id: string;
  workspace_id: string;
  user_id: string;
  user_name?: string | null;
  user_email?: string | null;
  starts_at: string;
  ends_at: string;
  escalation_order: number;
  notes?: string | null;
}

export async function listPlaybooks(workspaceId: string): Promise<IncidentPlaybook[]> {
  const { data, error } = await supabase
    .from('incident_playbooks')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as IncidentPlaybook[];
}

export async function createPlaybook(input: Omit<IncidentPlaybook, 'id' | 'created_at' | 'updated_at' | 'run_count' | 'last_triggered_at'> & { created_by: string }): Promise<string> {
  const payload = {
    workspace_id: input.workspace_id,
    name: input.name,
    description: input.description,
    trigger_type: input.trigger_type,
    trigger_config: input.trigger_config as never,
    actions: input.actions as never,
    enabled: input.enabled,
    cooldown_minutes: input.cooldown_minutes,
    created_by: input.created_by,
  };
  const { data, error } = await (supabase.from('incident_playbooks') as never as { insert: (p: typeof payload) => { select: (c: string) => { single: () => Promise<{ data: { id: string } | null; error: unknown }> } } })
    .insert(payload).select('id').single();
  if (error) throw error;
  return data!.id;
}

export async function togglePlaybook(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.from('incident_playbooks').update({ enabled }).eq('id', id);
  if (error) throw error;
}

export async function deletePlaybook(id: string): Promise<void> {
  const { error } = await supabase.from('incident_playbooks').delete().eq('id', id);
  if (error) throw error;
}

export async function listRuns(workspaceId: string, limit = 50): Promise<IncidentRun[]> {
  const { data, error } = await supabase
    .from('incident_runs')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('started_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as IncidentRun[];
}

export async function triggerPlaybookManually(playbookId: string): Promise<{ run_id?: string; status?: string; skipped?: boolean }> {
  const { data, error } = await supabase.functions.invoke('incident-orchestrator', {
    body: { playbook_id: playbookId, triggered_by: 'manual', trigger_event: { source: 'ui' } },
  });
  if (error) throw error;
  return data;
}

export async function listOncall(workspaceId: string): Promise<OncallEntry[]> {
  const { data, error } = await supabase
    .from('oncall_schedule')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('starts_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OncallEntry[];
}

export async function getCurrentOncall(workspaceId: string): Promise<Array<{ user_id: string; user_name?: string; user_email?: string; escalation_order: number; ends_at: string }>> {
  const { data, error } = await supabase.rpc('get_current_oncall', { p_workspace_id: workspaceId });
  if (error) throw error;
  return (data ?? []) as never;
}

export async function addOncallEntry(input: Omit<OncallEntry, 'id'> & { created_by: string }): Promise<string> {
  const { data, error } = await supabase
    .from('oncall_schedule')
    .insert(input)
    .select('id')
    .single();
  if (error) throw error;
  return data!.id;
}

export async function deleteOncallEntry(id: string): Promise<void> {
  const { error } = await supabase.from('oncall_schedule').delete().eq('id', id);
  if (error) throw error;
}

export const PLAYBOOK_TEMPLATES: Array<Omit<IncidentPlaybook, 'id' | 'workspace_id' | 'created_at' | 'updated_at' | 'run_count' | 'last_triggered_at'>> = [
  {
    name: 'Provider down → switch + notify',
    description: 'When SLO breaches due to provider errors, switch LLM provider and notify team.',
    trigger_type: 'slo_breach',
    trigger_config: { metric: 'success_rate', threshold: 95 },
    actions: [
      { type: 'switch_provider', config: { provider: 'fallback' } },
      { type: 'notify', config: { message: 'Primary LLM provider degraded — switched to fallback.' } },
    ],
    enabled: true,
    cooldown_minutes: 10,
  },
  {
    name: 'Cost spike → notify + pause runaway',
    description: 'When cost anomaly is critical, notify and pause runaway agents.',
    trigger_type: 'cost_anomaly',
    trigger_config: { severity: 'critical' },
    actions: [
      { type: 'notify', config: { message: 'Critical cost anomaly detected.' } },
      { type: 'pause_agent', config: {} },
    ],
    enabled: true,
    cooldown_minutes: 15,
  },
  {
    name: 'Synthetic fail → page on-call',
    description: 'When synthetic check fails repeatedly, page on-call engineer.',
    trigger_type: 'synthetic_fail',
    trigger_config: { consecutive_failures: 3 },
    actions: [
      { type: 'page_oncall', config: { severity: 'high' } },
      { type: 'notify', config: { message: 'Synthetic monitoring failure — on-call paged.' } },
    ],
    enabled: true,
    cooldown_minutes: 5,
  },
];
