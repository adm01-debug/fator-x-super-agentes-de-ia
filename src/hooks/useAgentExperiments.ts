import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fromTable } from '@/lib/supabaseExtended';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';
export type ExperimentVariant = 'a' | 'b';

export interface AgentExperiment {
  id: string;
  agent_id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string;
  status: ExperimentStatus;
  variant_a_config: Record<string, unknown>;
  variant_b_config: Record<string, unknown>;
  traffic_split: number;
  winner: ExperimentVariant | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExperimentRun {
  id: string;
  experiment_id: string;
  variant: ExperimentVariant;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  latency_ms: number | null;
  tokens_input: number;
  tokens_output: number;
  cost_usd: number;
  score: number | null;
  feedback: string | null;
  created_at: string;
}

export interface VariantStats {
  runs: number;
  avgLatency: number;
  avgCost: number;
  avgScore: number;
  totalTokens: number;
}

export function useExperiments(agentId: string | undefined) {
  return useQuery({
    queryKey: ['agent_experiments', agentId],
    queryFn: async (): Promise<AgentExperiment[]> => {
      if (!agentId) return [];
      const { data, error } = await fromTable('agent_experiments')
        .select('*')
        .eq('agent_id', agentId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as AgentExperiment[];
    },
    enabled: !!agentId,
  });
}

export function useExperimentRuns(experimentId: string | undefined) {
  return useQuery({
    queryKey: ['agent_experiment_runs', experimentId],
    queryFn: async (): Promise<ExperimentRun[]> => {
      if (!experimentId) return [];
      const { data, error } = await fromTable('agent_experiment_runs')
        .select('*')
        .eq('experiment_id', experimentId)
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as ExperimentRun[];
    },
    enabled: !!experimentId,
    refetchInterval: 10000,
  });
}

export function computeVariantStats(runs: ExperimentRun[], variant: ExperimentVariant): VariantStats {
  const filtered = runs.filter((r) => r.variant === variant);
  if (filtered.length === 0) {
    return { runs: 0, avgLatency: 0, avgCost: 0, avgScore: 0, totalTokens: 0 };
  }
  const latencies = filtered.filter((r) => r.latency_ms != null).map((r) => r.latency_ms ?? 0);
  const costs = filtered.map((r) => Number(r.cost_usd) || 0);
  const scores = filtered.filter((r) => r.score != null).map((r) => Number(r.score));
  const tokens = filtered.reduce((s, r) => s + (r.tokens_input || 0) + (r.tokens_output || 0), 0);
  return {
    runs: filtered.length,
    avgLatency: latencies.length ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0,
    avgCost: costs.length ? costs.reduce((a, b) => a + b, 0) / costs.length : 0,
    avgScore: scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
    totalTokens: tokens,
  };
}

export function useCreateExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      agent_id: string;
      workspace_id: string;
      name: string;
      description?: string;
      variant_a_config: Record<string, unknown>;
      variant_b_config: Record<string, unknown>;
      traffic_split: number;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error('Não autenticado');
      const { data, error } = await fromTable('agent_experiments')
        .insert({ ...input, created_by: userId, status: 'draft' })
        .select()
        .single();
      if (error) throw error;
      return data as AgentExperiment;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['agent_experiments', vars.agent_id] });
      toast.success('Experimento criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useUpdateExperimentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, agent_id }: { id: string; status: ExperimentStatus; agent_id: string }) => {
      const patch: Record<string, unknown> = { status };
      if (status === 'running') patch.started_at = new Date().toISOString();
      if (status === 'completed') patch.ended_at = new Date().toISOString();
      const { error } = await fromTable('agent_experiments').update(patch).eq('id', id);
      if (error) throw error;
      return { id, agent_id };
    },
    onSuccess: ({ agent_id }) => {
      qc.invalidateQueries({ queryKey: ['agent_experiments', agent_id] });
      toast.success('Status atualizado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeclareWinner() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, winner, agent_id }: { id: string; winner: ExperimentVariant; agent_id: string }) => {
      const { error } = await fromTable('agent_experiments')
        .update({ winner, status: 'completed', ended_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { id, agent_id };
    },
    onSuccess: ({ agent_id }) => {
      qc.invalidateQueries({ queryKey: ['agent_experiments', agent_id] });
      toast.success('Vencedor declarado!');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteExperiment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, agent_id }: { id: string; agent_id: string }) => {
      const { error } = await fromTable('agent_experiments').delete().eq('id', id);
      if (error) throw error;
      return { agent_id };
    },
    onSuccess: ({ agent_id }) => {
      qc.invalidateQueries({ queryKey: ['agent_experiments', agent_id] });
      toast.success('Experimento removido');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useLogRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      experiment_id: string;
      variant: ExperimentVariant;
      input: Record<string, unknown>;
      output?: Record<string, unknown>;
      latency_ms?: number;
      tokens_input?: number;
      tokens_output?: number;
      cost_usd?: number;
      score?: number;
      feedback?: string;
    }) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await fromTable('agent_experiment_runs').insert({
        ...input,
        created_by: userData.user?.id ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['agent_experiment_runs', vars.experiment_id] });
    },
  });
}
