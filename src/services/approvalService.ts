/**
 * Nexus Agents Studio — Approval Queue Service
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { supabase } from '@/integrations/supabase/client';

export async function listPendingApprovals() {
  const { data } = await supabaseExternal.from('workflow_runs')
    .select('id, workflow_id, status, output, started_at, current_step, total_steps, workflows(name)')
    .eq('status', 'awaiting_approval')
    .order('started_at', { ascending: false })
    .limit(20);
  return data ?? [];
}

export async function approveWorkflowRun(runId: string, workflowId: string, feedback: string) {
  const { data, error } = await supabase.functions.invoke('workflow-engine-v2', {
    body: { workflow_id: workflowId, resume_run_id: runId, input: feedback || 'Approved' },
  });
  if (error) throw error;
  return data;
}

export async function rejectWorkflowRun(runId: string, feedback: string) {
  await supabaseExternal.from('workflow_runs').update({
    status: 'failed',
    error: `Rejected by human: ${feedback || 'No reason provided'}`,
    completed_at: new Date().toISOString(),
  }).eq('id', runId);
}
