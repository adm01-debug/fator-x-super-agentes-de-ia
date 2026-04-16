/**
 * Nexus Agents Studio — useAutomationRules Hook
 * CRUD + execution for automation_rules / automation_logs (módulo #16)
 */
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export type TriggerType = 'interaction_created' | 'interaction_length' | 'manual' | 'scheduled' | 'webhook';
export type ActionType = 'disc_analysis' | 'eq_analysis' | 'bias_analysis' | 'full_pipeline' | 'notify' | 'webhook';
export type LogStatus = 'success' | 'failed' | 'running' | 'skipped';

export interface AutomationRule {
  id: string;
  workspace_id: string;
  created_by: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  action_type: ActionType;
  action_config: Record<string, unknown>;
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  rule_id: string;
  workspace_id: string;
  status: LogStatus;
  trigger_payload: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  error_message: string | null;
  duration_ms: number | null;
  created_at: string;
}

export function useAutomationRules(workspaceId: string | null) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const refresh = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    try {
      const [rulesRes, logsRes] = await Promise.all([
        supabase.from('automation_rules').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }),
        supabase.from('automation_logs').select('*').eq('workspace_id', workspaceId).order('created_at', { ascending: false }).limit(50),
      ]);
      if (rulesRes.error) throw rulesRes.error;
      if (logsRes.error) throw logsRes.error;
      setRules((rulesRes.data ?? []) as AutomationRule[]);
      setLogs((logsRes.data ?? []) as AutomationLog[]);
    } catch (e) {
      toast({ title: 'Erro ao carregar automações', description: e instanceof Error ? e.message : 'Erro', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [workspaceId, toast]);

  useEffect(() => { refresh(); }, [refresh]);

  const createRule = useCallback(async (input: Omit<AutomationRule, 'id' | 'run_count' | 'last_run_at' | 'created_at' | 'updated_at' | 'created_by'>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error('Não autenticado');
    const row = { ...input, created_by: u.user.id } as never;
    const { error } = await supabase.from('automation_rules').insert(row);
    if (error) throw error;
    toast({ title: 'Regra criada' });
    await refresh();
  }, [refresh, toast]);

  const toggleRule = useCallback(async (id: string, is_active: boolean) => {
    const { error } = await supabase.from('automation_rules').update({ is_active }).eq('id', id);
    if (error) throw error;
    await refresh();
  }, [refresh]);

  const deleteRule = useCallback(async (id: string) => {
    const { error } = await supabase.from('automation_rules').delete().eq('id', id);
    if (error) throw error;
    toast({ title: 'Regra removida' });
    await refresh();
  }, [refresh, toast]);

  const runRule = useCallback(async (id: string, payload: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke('automation-pipeline', { body: { rule_id: id, payload } });
    if (error) throw error;
    toast({ title: 'Execução disparada', description: data?.status ?? 'OK' });
    await refresh();
  }, [refresh, toast]);

  return { rules, logs, loading, refresh, createRule, toggleRule, deleteRule, runRule };
}
