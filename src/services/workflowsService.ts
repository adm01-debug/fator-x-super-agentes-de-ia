/**
 * Nexus Agents Studio — Workflows Service
 * CRUD + execution for workflows with normalized workflow_steps.
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

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  name: string;
  role: string;
  step_order: number;
  agent_id: string | null;
  config: Record<string, unknown>;
  created_at: string;
}

export interface Workflow {
  id: string;
  name: string;
  description: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  steps: WorkflowStep[];
  status: 'draft' | 'active' | 'paused' | 'archived';
  version: number;
  workspace_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/* ── List ── */
export async function listWorkflows(): Promise<Workflow[]> {
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw error;

  const workflowIds = (data ?? []).map(w => w.id);

  // Fetch all steps for these workflows in one query
  let allSteps: WorkflowStep[] = [];
  if (workflowIds.length > 0) {
    const { data: stepsData } = await supabase
      .from('workflow_steps')
      .select('*')
      .in('workflow_id', workflowIds)
      .order('step_order', { ascending: true });
    allSteps = (stepsData ?? []) as unknown as WorkflowStep[];
  }

  return (data ?? []).map(row => {
    const steps = allSteps.filter(s => s.workflow_id === row.id);
    return mapWorkflow(row, steps);
  });
}

/* ── Get single ── */
export async function getWorkflow(id: string): Promise<Workflow> {
  const [workflowRes, stepsRes] = await Promise.all([
    supabase.from('workflows').select('*').eq('id', id).single(),
    supabase.from('workflow_steps').select('*').eq('workflow_id', id).order('step_order', { ascending: true }),
  ]);

  if (workflowRes.error) throw workflowRes.error;
  return mapWorkflow(workflowRes.data, (stepsRes.data ?? []) as unknown as WorkflowStep[]);
}

/* ── Save (upsert workflow + sync steps) ── */
export async function saveWorkflow(workflow: Partial<Workflow> & { name: string }): Promise<Workflow> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const row = {
    name: workflow.name,
    description: workflow.description || '',
    config: {
      nodes: workflow.nodes || [],
      edges: workflow.edges || [],
    } as unknown as Json,
    status: workflow.status || 'draft',
    ...(workflow.id ? { id: workflow.id } : {}),
  };

  const { data, error } = await supabase
    .from('workflows')
    .upsert(row)
    .select()
    .single();

  if (error) throw error;

  const workflowId = data.id;

  // Sync workflow_steps: delete old then insert new
  await syncWorkflowSteps(workflowId, workflow.nodes || []);

  // Re-fetch steps
  const { data: stepsData } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: true });

  return mapWorkflow(data, (stepsData ?? []) as unknown as WorkflowStep[]);
}

/* ── Delete ── */
export async function deleteWorkflow(id: string): Promise<void> {
  // Steps cascade via FK, but let's be explicit
  await supabase.from('workflow_steps').delete().eq('workflow_id', id);
  const { error } = await supabase.from('workflows').delete().eq('id', id);
  if (error) throw error;
}

/* ── Duplicate ── */
export async function duplicateWorkflow(id: string): Promise<Workflow> {
  const original = await getWorkflow(id);
  return saveWorkflow({
    name: `${original.name} (cópia)`,
    description: original.description,
    nodes: original.nodes,
    edges: original.edges,
    status: 'draft',
  });
}

/* ── Get steps for a workflow ── */
export async function getWorkflowSteps(workflowId: string): Promise<WorkflowStep[]> {
  const { data, error } = await supabase
    .from('workflow_steps')
    .select('*')
    .eq('workflow_id', workflowId)
    .order('step_order', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as WorkflowStep[];
}

/* ── Sync steps from canvas nodes ── */
async function syncWorkflowSteps(workflowId: string, nodes: WorkflowNode[]): Promise<void> {
  // Delete existing steps
  await supabase.from('workflow_steps').delete().eq('workflow_id', workflowId);

  if (nodes.length === 0) return;

  // Insert new steps from nodes
  const stepsToInsert = nodes.map((node, index) => ({
    workflow_id: workflowId,
    name: String(node.data?.label || node.type || `Step ${index + 1}`),
    role: String(node.type || 'executor'),
    step_order: index,
    agent_id: node.data?.agent_id ? String(node.data.agent_id) : null,
    config: {
      node_id: node.id,
      position: node.position,
      type: node.type,
      ...((node.data?.config as Record<string, unknown>) || {}),
    } as unknown as Json,
  }));

  const { error } = await supabase.from('workflow_steps').insert(stepsToInsert);
  if (error) {
    console.error('Failed to sync workflow_steps:', error.message);
  }
}

/* ── Map DB row to Workflow ── */
function mapWorkflow(row: Record<string, unknown>, steps: WorkflowStep[] = []): Workflow {
  const config = (row.config || {}) as Record<string, unknown>;

  // If we have normalized steps, build nodes from them; otherwise fallback to config JSON
  let nodes: WorkflowNode[];
  if (steps.length > 0) {
    nodes = steps.map(step => {
      const stepConfig = (step.config || {}) as Record<string, unknown>;
      return {
        id: String(stepConfig.node_id || `step_${step.step_order}`),
        type: String(stepConfig.type || step.role || 'executor'),
        position: (stepConfig.position as { x: number; y: number }) || { x: step.step_order * 240, y: 100 },
        data: {
          label: step.name,
          agent_id: step.agent_id,
          ...stepConfig,
        },
      };
    });
  } else {
    nodes = Array.isArray(config.nodes) ? config.nodes as WorkflowNode[] : [];
  }

  const edges = Array.isArray(config.edges) ? config.edges as WorkflowEdge[] : [];

  return {
    id: String(row.id),
    name: String(row.name || ''),
    description: String(row.description || ''),
    nodes,
    edges,
    steps,
    status: String(row.status || 'draft') as Workflow['status'],
    version: Number(row.version || 1),
    workspace_id: String(row.workspace_id || ''),
    created_by: String(row.created_by || ''),
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  };
}
