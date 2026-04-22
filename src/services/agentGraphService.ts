import { fromTable } from '@/lib/supabaseExtended';
import { supabase } from '@/integrations/supabase/client';

export interface GraphNode {
  id: string;
  agent_id?: string | null;
  role?: string;
  label?: string;
  position: { x: number; y: number };
}

export interface GraphEdge {
  id?: string;
  from: string;
  to: string;
  condition?: string;
}

export interface AgentGraph {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  entry_node_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface GraphExecution {
  id: string;
  graph_id: string;
  user_id: string;
  input: string;
  status: 'running' | 'completed' | 'failed';
  current_node_id: string | null;
  trace: Array<{
    node_id: string;
    agent_id: string | null;
    agent_name: string;
    input: string;
    output: string;
    latency_ms: number;
    cost_cents: number;
    ts: string;
  }>;
  final_output: string | null;
  total_cost_cents: number;
  error_message: string | null;
  started_at: string;
  ended_at: string | null;
}

export const agentGraphService = {
  async listGraphs(workspaceId: string): Promise<AgentGraph[]> {
    const { data, error } = await fromTable('agent_graphs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as unknown as AgentGraph[];
  },

  async getGraph(id: string): Promise<AgentGraph> {
    const { data, error } = await fromTable('agent_graphs').select('*').eq('id', id).single();
    if (error) throw error;
    return data as unknown as AgentGraph;
  },

  async createGraph(workspaceId: string, name: string, description = ''): Promise<AgentGraph> {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('Não autenticado');
    const { data, error } = await fromTable('agent_graphs')
      .insert({
        workspace_id: workspaceId,
        created_by: u.user.id,
        name,
        description,
        nodes: [],
        edges: [],
      } as Record<string, unknown>)
      .select()
      .single();
    if (error) throw error;
    return data as unknown as AgentGraph;
  },

  async updateGraph(
    id: string,
    patch: Partial<Pick<AgentGraph, 'name' | 'description' | 'nodes' | 'edges' | 'entry_node_id'>>,
  ): Promise<void> {
    const { error } = await fromTable('agent_graphs')
      .update(patch as Record<string, unknown>)
      .eq('id', id);
    if (error) throw error;
  },

  async deleteGraph(id: string): Promise<void> {
    const { error } = await fromTable('agent_graphs').delete().eq('id', id);
    if (error) throw error;
  },

  async executeGraph(
    graphId: string,
    input: string,
  ): Promise<{
    execution_id: string;
    final_output: string;
    steps: number;
    total_cost_cents: number;
  }> {
    const { data, error } = await supabase.functions.invoke('graph-execute', {
      body: { graph_id: graphId, input },
    });
    if (error) throw error;
    return data;
  },

  async listExecutions(graphId: string): Promise<GraphExecution[]> {
    const { data, error } = await fromTable('graph_executions')
      .select('*')
      .eq('graph_id', graphId)
      .order('started_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data ?? []) as unknown as GraphExecution[];
  },

  async getExecution(id: string): Promise<GraphExecution> {
    const { data, error } = await fromTable('graph_executions').select('*').eq('id', id).single();
    if (error) throw error;
    return data as unknown as GraphExecution;
  },
};
