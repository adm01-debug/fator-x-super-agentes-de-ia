import { supabase } from '@/integrations/supabase/client';
import { fromTable, rpcCall } from '@/lib/supabaseExtended';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type ExperimentVariant = 'a' | 'b';
export type SuccessMetric = 'quality' | 'latency' | 'cost' | 'success_rate';

export interface PromptExperiment {
  id: string;
  workspace_id: string;
  agent_id: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variant_a_version_id: string;
  variant_b_version_id: string;
  variant_a_label: string;
  variant_b_label: string;
  traffic_split: number;
  success_metric: SuccessMetric;
  guardrails: { max_cost_increase_pct: number; max_latency_increase_ms: number; min_quality: number };
  winner: ExperimentVariant | null;
  started_at: string | null;
  ended_at: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ExperimentRun {
  id: string;
  experiment_id: string;
  variant: ExperimentVariant;
  prompt_version_id: string | null;
  session_key: string | null;
  latency_ms: number;
  cost_cents: number;
  tokens_input: number;
  tokens_output: number;
  quality_score: number | null;
  success: boolean;
  trace_id: string | null;
  created_at: string;
}

export interface VariantStats {
  runs: number;
  success: number;
  avg_latency_ms: number;
  avg_cost_cents: number;
  avg_quality: number;
  success_rate: number;
}

export interface ExperimentStats {
  variant_a: VariantStats;
  variant_b: VariantStats;
  p_value: number;
  z_score: number;
  significant: boolean;
  winner_candidate: ExperimentVariant;
  metric: SuccessMetric;
}

export const promptExperimentService = {
  async list(workspaceId: string): Promise<PromptExperiment[]> {
    const { data, error } = await fromTable('prompt_experiments')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as PromptExperiment[];
  },

  async get(id: string): Promise<PromptExperiment | null> {
    const { data, error } = await fromTable('prompt_experiments').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data as PromptExperiment) ?? null;
  },

  async create(input: {
    workspace_id: string;
    agent_id: string;
    name: string;
    description?: string;
    variant_a_version_id: string;
    variant_b_version_id: string;
    variant_a_label?: string;
    variant_b_label?: string;
    traffic_split?: number;
    success_metric?: SuccessMetric;
    guardrails?: PromptExperiment['guardrails'];
  }): Promise<PromptExperiment> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('Não autenticado');
    const { data, error } = await fromTable('prompt_experiments')
      .insert({ ...input, created_by: u.user.id })
      .select()
      .single();
    if (error) throw error;
    return data as PromptExperiment;
  },

  async setStatus(id: string, status: ExperimentStatus): Promise<void> {
    const patch: Record<string, unknown> = { status };
    if (status === 'running') patch.started_at = new Date().toISOString();
    if (status === 'completed') patch.ended_at = new Date().toISOString();
    const { error } = await fromTable('prompt_experiments').update(patch).eq('id', id);
    if (error) throw error;
  },

  async remove(id: string): Promise<void> {
    const { error } = await fromTable('prompt_experiments').delete().eq('id', id);
    if (error) throw error;
  },

  async listRuns(experimentId: string, limit = 500): Promise<ExperimentRun[]> {
    const { data, error } = await fromTable('prompt_experiment_runs')
      .select('*')
      .eq('experiment_id', experimentId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []) as ExperimentRun[];
  },

  async recordRun(input: {
    experiment_id: string;
    variant: ExperimentVariant;
    prompt_version_id?: string;
    session_key?: string;
    latency_ms: number;
    cost_cents?: number;
    tokens_input?: number;
    tokens_output?: number;
    quality_score?: number;
    success?: boolean;
    trace_id?: string;
  }): Promise<void> {
    const { error } = await fromTable('prompt_experiment_runs').insert(input);
    if (error) throw error;
  },

  async getStats(experimentId: string): Promise<ExperimentStats> {
    const { data, error } = await rpcCall('compute_experiment_stats', { p_experiment_id: experimentId });
    if (error) throw new Error(error.message);
    return data as ExperimentStats;
  },

  async assignVariant(experimentId: string, sessionKey?: string): Promise<ExperimentVariant> {
    const { data, error } = await rpcCall('assign_variant', {
      p_experiment_id: experimentId,
      p_session_key: sessionKey ?? null,
    });
    if (error) throw new Error(error.message);
    return data as ExperimentVariant;
  },

  async promoteWinner(experimentId: string, winner: ExperimentVariant): Promise<void> {
    const { error } = await rpcCall('promote_experiment_winner', {
      p_experiment_id: experimentId,
      p_winner: winner,
    });
    if (error) throw new Error(error.message);
  },
};
