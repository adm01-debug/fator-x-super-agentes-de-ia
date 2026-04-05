/**
 * Nexus Agents Studio — Workflows Service
 * CRUD + execution for workflows (React Flow serialized).
 */

import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  type?: string;
  data?: Record<string, unknown>;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  workspace_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export async function listWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapWorkflow);
}

export async function getWorkflow(id: string): Promise<Workflow> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapWorkflow(data);
}

export async function saveWorkflow(workflow: Partial<Workflow> & { name: string }): Promise<Workflow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    name: workflow.name,
    description: workflow.description || '',
    definition: {
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
    } as unknown as Json,
    status: workflow.status || 'draft',
    version: workflow.version || 1,
    created_by: user.id,
    ...(workflow.id ? { id: workflow.id } : {}),
  };

  const { data, error } = await supabase
    .from('workflows')
    .upsert(row)
    .select()
    .single();

  if (error) throw error;
  return mapWorkflow(data);
}

export async function deleteWorkflow(id: string): Promise<void> {
  const { error } = await supabase.from('workflows').delete().eq('id', id);
  if (error) throw error;
}

export async function duplicateWorkflow(id: string): Promise<Workflow> {
  const original = await getWorkflow(id);
  return saveWorkflow({
    name: `${original.name} (cópia)`,
    description: original.description,
    nodes: original.nodes,
    edges: original.edges,
    status: 'draft',
    version: 1,
  });
}

function mapWorkflow(row: Record<string, unknown>): Workflow {
  const def = (row.definition || {}) as Record<string, unknown>;
  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    nodes: Array.isArray(def.nodes) ? def.nodes as WorkflowNode[] : [],
    edges: Array.isArray(def.edges) ? def.edges as WorkflowEdge[] : [],
    status: String(row.status || 'draft') as Workflow['status'],
    version: Number(row.version || 1),
    workspace_id: String(row.workspace_id || ''),
    created_by: String(row.created_by || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}
