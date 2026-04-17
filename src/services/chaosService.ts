/**
 * Chaos Engineering service — list, create, disable experiments
 */
import { supabase } from '@/integrations/supabase/client';

export type ChaosTarget = 'llm-gateway' | 'agent-workflow-runner';
export type ChaosFaultType = 'latency' | 'error_500' | 'error_429' | 'timeout';

export interface ChaosExperiment {
  id: string;
  workspace_id: string;
  name: string;
  target: ChaosTarget;
  fault_type: ChaosFaultType;
  probability: number;
  latency_ms: number | null;
  enabled: boolean;
  created_by: string;
  created_at: string;
  expires_at: string;
}

export interface CreateChaosInput {
  workspace_id: string;
  name: string;
  target: ChaosTarget;
  fault_type: ChaosFaultType;
  probability: number; // 0..0.5
  latency_ms?: number;
  duration_seconds: number; // 1..3600
}

const MAX_PROBABILITY = 0.5;
const MAX_DURATION_SEC = 3600;

export async function listChaosExperiments(workspaceId: string): Promise<ChaosExperiment[]> {
  const { data, error } = await supabase
    .from('chaos_experiments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return (data || []) as ChaosExperiment[];
}

export async function listActiveChaosExperiments(workspaceId: string): Promise<ChaosExperiment[]> {
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('chaos_experiments')
    .select('*')
    .eq('workspace_id', workspaceId)
    .eq('enabled', true)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data || []) as ChaosExperiment[];
}

export async function createChaosExperiment(input: CreateChaosInput): Promise<ChaosExperiment> {
  if (input.probability < 0 || input.probability > MAX_PROBABILITY) {
    throw new Error(`probability must be between 0 and ${MAX_PROBABILITY}`);
  }
  if (input.duration_seconds < 1 || input.duration_seconds > MAX_DURATION_SEC) {
    throw new Error(`duration must be between 1 and ${MAX_DURATION_SEC} seconds`);
  }
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error('not authenticated');

  const expires_at = new Date(Date.now() + input.duration_seconds * 1000).toISOString();
  const { data, error } = await supabase
    .from('chaos_experiments')
    .insert({
      workspace_id: input.workspace_id,
      name: input.name,
      target: input.target,
      fault_type: input.fault_type,
      probability: input.probability,
      latency_ms: input.latency_ms ?? 500,
      enabled: true,
      created_by: userData.user.id,
      expires_at,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ChaosExperiment;
}

export async function disableChaosExperiment(id: string): Promise<void> {
  const { error } = await supabase
    .from('chaos_experiments')
    .update({ enabled: false })
    .eq('id', id);
  if (error) throw error;
}

export async function disableAllChaos(workspaceId: string): Promise<number> {
  const { data, error } = await supabase.rpc('disable_all_chaos', { p_workspace_id: workspaceId });
  if (error) throw error;
  return Number(data ?? 0);
}
