import { useState, useEffect, useCallback } from 'react';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { CanvasNode, CanvasEdge } from '@/components/workflows/WorkflowCanvas';
import type { Json } from '@/integrations/supabase/types';

interface WorkflowRecord {
  id: string;
  name: string;
  status: string | null;
  config: { nodes?: CanvasNode[]; edges?: CanvasEdge[] } | null;
  step_count: number;
  created_at: string | null;
}

export function useWorkflowPersistence() {
  const { user } = useAuth();
  const [workflows, setWorkflows] = useState<WorkflowRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchWorkflows = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const { data, error } = await supabase
      .from('workflows')
      .select('id, name, status, config, created_at')
      .order('updated_at', { ascending: false });

    if (error) {
      logger.error('Failed to fetch workflows', { error: error.message });
      setLoading(false);
      return;
    }

    const ids = (data ?? []).map(w => w.id);
    let stepCounts: Record<string, number> = {};

    if (ids.length > 0) {
      const { data: steps } = await supabase
        .from('workflow_steps')
        .select('workflow_id')
        .in('workflow_id', ids);

      if (steps) {
        for (const s of steps) {
          stepCounts[s.workflow_id!] = (stepCounts[s.workflow_id!] || 0) + 1;
        }
      }
    }

    setWorkflows((data ?? []).map(w => ({
      ...(w as unknown as WorkflowRecord),
      step_count: stepCounts[w.id] || 0,
    })));

    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  const saveCanvas = useCallback(async (
    name: string,
    nodes: CanvasNode[],
    edges: CanvasEdge[],
    workflowId?: string | null,
  ) => {
    if (!user) {
      toast.error('Faça login para salvar');
      return null;
    }

    setSaving(true);
    const config = { nodes, edges };

    const syncSteps = async (wfId: string) => {
      // Delete old steps
      await supabaseExternal.from('workflow_steps').delete().eq('workflow_id', wfId);

      if (nodes.length === 0) return;

      const stepsToInsert = nodes.map((node, index) => ({
        workflow_id: wfId,
        name: String(node.data?.label || node.type || `Step ${index + 1}`),
        role: String(node.type || 'executor'),
        step_order: index,
        config: {
          node_id: node.id,
          position: node.position,
          type: node.type,
          ...((node.data?.config as Record<string, unknown>) || {}),
        } as unknown as Json,
      }));

      const { error: stepErr } = await supabaseExternal.from('workflow_steps').insert(stepsToInsert);
      if (stepErr) {
        logger.error('Failed to sync workflow_steps', { error: stepErr.message });
      }
    };

    if (workflowId) {
      const { error } = await supabase
        .from('workflows')
        .update({ config: JSON.parse(JSON.stringify(config)), name })
        .eq('id', workflowId);

      if (error) {
        toast.error('Erro ao atualizar workflow');
        logger.error('Failed to update workflow', { error: error.message });
        setSaving(false);
        return null;
      }

      await syncSteps(workflowId);
      toast.success('Canvas salvo!');
      setSaving(false);
      await fetchWorkflows();
      return workflowId;
    }

    // Need workspace_id
    const { data: memberData } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();

    const workspaceId = memberData?.workspace_id;
    if (!workspaceId) {
      toast.error('Workspace não encontrado');
      setSaving(false);
      return null;
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert([{ name, config: JSON.parse(JSON.stringify(config)), workspace_id: workspaceId }])
      .select('id')
      .single();

    if (error) {
      toast.error('Erro ao criar workflow');
      logger.error('Failed to create workflow', { error: error.message });
      setSaving(false);
      return null;
    }

    const newId = data?.id ?? null;
    if (newId) {
      await syncSteps(newId);
      setSelectedId(newId);
    }

    toast.success('Workflow criado e salvo!');
    setSaving(false);
    await fetchWorkflows();
    return newId;
  }, [user, fetchWorkflows]);

  const loadCanvas = useCallback(async (workflowId: string): Promise<{ nodes: CanvasNode[]; edges: CanvasEdge[] } | null> => {
    // Try loading from normalized workflow_steps first
    const { data: steps } = await supabase
      .from('workflow_steps')
      .select('*')
      .eq('workflow_id', workflowId)
      .order('step_order', { ascending: true });

    const wf = workflows.find(w => w.id === workflowId);

    if (steps && steps.length > 0) {
      const nodes: CanvasNode[] = steps.map(step => {
        const cfg = (step.config || {}) as Record<string, unknown>;
        return {
          id: String(cfg.node_id || `step_${step.step_order}`),
          type: String(cfg.type || step.role || 'executor'),
          position: (cfg.position as { x: number; y: number }) || { x: step.step_order * 240, y: 100 },
          data: {
            label: step.name,
            type: cfg.type || step.role,
            config: cfg,
            status: 'idle',
          },
        };
      });

      // Edges come from config JSON (edges aren't steps)
      const edges: CanvasEdge[] = wf?.config?.edges ?? [];
      return { nodes, edges };
    }

    // Fallback to config JSON
    if (!wf?.config) return null;
    return { nodes: wf.config.nodes ?? [], edges: wf.config.edges ?? [] };
  }, [workflows]);

  const deleteCanvas = useCallback(async (workflowId: string) => {
    // Delete steps first, then workflow
    await supabaseExternal.from('workflow_steps').delete().eq('workflow_id', workflowId);
    const { error } = await supabaseExternal.from('workflows').delete().eq('id', workflowId);
    if (error) {
      toast.error('Erro ao deletar workflow');
      logger.error('Failed to delete workflow', { error: error.message });
      return false;
    }
    if (selectedId === workflowId) setSelectedId(null);
    toast.success('Workflow removido!');
    await fetchWorkflows();
    return true;
  }, [selectedId, fetchWorkflows]);

  return { workflows, selectedId, setSelectedId, loading, saving, saveCanvas, loadCanvas, deleteCanvas, fetchWorkflows };
}
