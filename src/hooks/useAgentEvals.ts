import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface EvalItem {
  input: string;
  expected_output: string;
  criteria?: string[];
}

export interface EvalDataset {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  name: string;
  description: string;
  items: EvalItem[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface EvalRun {
  id: string;
  workspace_id: string;
  dataset_id: string;
  agent_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total_items: number;
  passed: number;
  failed: number;
  avg_score: number;
  avg_latency_ms: number;
  total_cost_usd: number;
  model: string | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface EvalResult {
  id: string;
  run_id: string;
  item_index: number;
  input: string;
  expected: string | null;
  actual: string | null;
  passed: boolean;
  score: number;
  latency_ms: number;
  cost_usd: number;
  judge_reasoning: string | null;
  error: string | null;
  created_at: string;
}

export function useEvalDatasets(agentId?: string) {
  return useQuery({
    queryKey: ['eval-datasets', agentId],
    queryFn: async () => {
      let q = supabase.from('agent_eval_datasets').select('*').order('created_at', { ascending: false });
      if (agentId) q = q.or(`agent_id.eq.${agentId},agent_id.is.null`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as EvalDataset[];
    },
  });
}

export function useEvalRuns(agentId?: string) {
  return useQuery({
    queryKey: ['eval-runs', agentId],
    queryFn: async () => {
      let q = supabase.from('agent_eval_runs').select('*').order('created_at', { ascending: false });
      if (agentId) q = q.eq('agent_id', agentId);
      const { data, error } = await q.limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as EvalRun[];
    },
  });
}

export function useEvalResults(runId: string | null) {
  return useQuery({
    queryKey: ['eval-results', runId],
    queryFn: async () => {
      if (!runId) return [];
      const { data, error } = await supabase
        .from('agent_eval_results')
        .select('*')
        .eq('run_id', runId)
        .order('item_index', { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as EvalResult[];
    },
    enabled: !!runId,
  });
}

export function useCreateEvalDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { workspace_id: string; agent_id?: string; name: string; description?: string; items: EvalItem[] }) => {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('agent_eval_datasets')
        .insert({
          workspace_id: input.workspace_id,
          agent_id: input.agent_id ?? null,
          name: input.name,
          description: input.description ?? '',
          items: input.items as never,
          created_by: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-datasets'] });
      toast.success('Dataset criado');
    },
    onError: (e: Error) => toast.error(e.message),
  });
}

export function useDeleteEvalDataset() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agent_eval_datasets').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-datasets'] });
      toast.success('Dataset removido');
    },
  });
}

export function useRunEval() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dataset_id: string; agent_id: string }) => {
      const { data, error } = await supabase.functions.invoke('agent-eval-runner', {
        body: input,
      });
      if (error) throw error;
      return data as { run_id: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-runs'] });
      toast.success('Avaliação iniciada');
    },
    onError: (e: Error) => toast.error(`Erro: ${e.message}`),
  });
}
