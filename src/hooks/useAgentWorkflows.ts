import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, any>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
}

export interface AgentWorkflow {
  id: string;
  agent_id: string | null;
  workspace_id: string;
  name: string;
  description: string | null;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string;
  status: string;
  input: any;
  output: any;
  trace: any[];
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export function useAgentWorkflows(agentId?: string) {
  const qc = useQueryClient();

  const workflows = useQuery({
    queryKey: ['agent_workflows', agentId],
    enabled: !!agentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_workflows')
        .select('*')
        .eq('agent_id', agentId!)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as AgentWorkflow[];
    },
  });

  const createWorkflow = useMutation({
    mutationFn: async (input: { name: string; description?: string; workspace_id: string; nodes?: any[]; edges?: any[] }) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error('Não autenticado');
      const { data, error } = await supabase
        .from('agent_workflows')
        .insert({
          agent_id: agentId,
          workspace_id: input.workspace_id,
          name: input.name,
          description: input.description,
          nodes: input.nodes ?? [],
          edges: input.edges ?? [],
          created_by: u.user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent_workflows', agentId] });
      toast.success('Workflow criado');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateWorkflow = useMutation({
    mutationFn: async (input: { id: string; nodes?: any[]; edges?: any[]; name?: string; description?: string; status?: string }) => {
      const { id, ...patch } = input;
      const { error } = await supabase.from('agent_workflows').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent_workflows', agentId] });
      toast.success('Workflow salvo');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteWorkflow = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('agent_workflows').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent_workflows', agentId] });
      toast.success('Workflow removido');
    },
    onError: (e: any) => toast.error(e.message),
  });

  return { workflows, createWorkflow, updateWorkflow, deleteWorkflow };
}

export function useWorkflowRuns(workflowId?: string) {
  return useQuery({
    queryKey: ['workflow_runs', workflowId],
    enabled: !!workflowId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agent_workflow_runs')
        .select('*')
        .eq('workflow_id', workflowId!)
        .order('started_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as WorkflowRun[];
    },
  });
}

export async function runWorkflow(workflowId: string, input: any) {
  const { data, error } = await supabase.functions.invoke('agent-workflow-runner', {
    body: { workflow_id: workflowId, input },
  });
  if (error) throw error;
  return data;
}
