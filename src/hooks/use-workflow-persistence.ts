import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import type { CanvasNode, CanvasEdge } from '@/components/workflows/WorkflowCanvas';

interface WorkflowRecord {
  id: string;
  name: string;
  status: string | null;
  config: { nodes?: CanvasNode[]; edges?: CanvasEdge[] } | null;
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
      console.error('Failed to fetch workflows', error);
    } else {
      setWorkflows((data ?? []) as unknown as WorkflowRecord[]);
    }
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

    if (workflowId) {
      const { error } = await supabase
        .from('workflows')
        .update({ config: config as unknown as Record<string, unknown>, name })
        .eq('id', workflowId);

      if (error) {
        toast.error('Erro ao atualizar workflow');
        console.error(error);
        setSaving(false);
        return null;
      }
      toast.success('Canvas salvo!');
      setSaving(false);
      await fetchWorkflows();
      return workflowId;
    }

    // Need workspace_id — get from workspace_members
    const { data: memberData } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    const workspaceId = memberData?.workspace_id;
    if (!workspaceId) {
      toast.error('Workspace não encontrado');
      setSaving(false);
      return null;
    }

    const { data, error } = await supabase
      .from('workflows')
      .insert({ name, config: config as unknown as Record<string, unknown>, workspace_id: workspaceId })
      .select('id')
      .single();

    if (error) {
      toast.error('Erro ao criar workflow');
      console.error(error);
      setSaving(false);
      return null;
    }

    toast.success('Workflow criado e salvo!');
    const newId = data?.id ?? null;
    if (newId) setSelectedId(newId);
    setSaving(false);
    await fetchWorkflows();
    return newId;
  }, [user, fetchWorkflows]);

  const loadCanvas = useCallback((workflowId: string): { nodes: CanvasNode[]; edges: CanvasEdge[] } | null => {
    const wf = workflows.find(w => w.id === workflowId);
    if (!wf?.config) return null;
    const cfg = wf.config as { nodes?: CanvasNode[]; edges?: CanvasEdge[] };
    return { nodes: cfg.nodes ?? [], edges: cfg.edges ?? [] };
  }, [workflows]);

  return { workflows, selectedId, setSelectedId, loading, saving, saveCanvas, loadCanvas, fetchWorkflows };
}
