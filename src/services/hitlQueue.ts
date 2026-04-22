/**
 * HITL Queue Service — `src/services/hitlQueue.ts`
 *
 * Camada operacional acima de `approvalService`. Consolida:
 *  - listagem filtrada de pendências (`listPending`)
 *  - estatísticas para widget de dashboard (`getQueueStats`)
 *  - enfileiramento a partir de um trigger do agente (`enqueueFromAgentTrigger`)
 *
 * Os itens ficam em `public.workflow_runs` com status `awaiting_approval`
 * — mesma tabela que o `/approvals` já lê, para consistência.
 *
 * `enqueueFromAgentTrigger` cria um run "dummy" marcado com
 * `output.pending_approval = { source: 'agent_trigger', ... }` para que o
 * review humano apareça na fila mesmo quando o disparador não é um workflow.
 */
import { supabase } from '@/integrations/supabase/client';
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import {
  approveWorkflowRun,
  listPendingApprovals,
  rejectWorkflowRun,
} from '@/services/approvalService';

export interface HitlItem {
  id: string;
  workflow_id: string;
  status: string;
  output: Record<string, unknown> | null;
  started_at: string | null;
  current_step: number | null;
  total_steps: number | null;
  workflows?: { name?: string } | null;
  // derived fields
  reason: string;
  source: 'workflow' | 'agent_trigger';
  agent_id?: string;
  trigger_key?: string;
  age_ms: number;
}

export interface HitlQueueStats {
  total: number;
  oldest_age_minutes: number | null;
  over_sla: number;
  by_source: { workflow: number; agent_trigger: number };
}

const SLA_MINUTES = 30;

function decorate(raw: Record<string, unknown>): HitlItem {
  const output = (raw.output as Record<string, unknown> | null) ?? null;
  const pending = (output?.pending_approval as Record<string, unknown> | undefined) ?? {};
  const source: HitlItem['source'] = (pending.source as HitlItem['source']) ?? 'workflow';
  const started = raw.started_at ? new Date(raw.started_at as string).getTime() : Date.now();
  return {
    id: String(raw.id),
    workflow_id: String(raw.workflow_id),
    status: String(raw.status ?? 'awaiting_approval'),
    output,
    started_at: (raw.started_at as string) ?? null,
    current_step: (raw.current_step as number) ?? null,
    total_steps: (raw.total_steps as number) ?? null,
    workflows: (raw.workflows as { name?: string } | null) ?? null,
    reason: String(pending.reason ?? pending.label ?? 'Aguardando aprovação'),
    source,
    agent_id: pending.agent_id as string | undefined,
    trigger_key: pending.trigger_key as string | undefined,
    age_ms: Date.now() - started,
  };
}

export async function listPending(): Promise<HitlItem[]> {
  const rows = await listPendingApprovals();
  return rows.map((r) => decorate(r as Record<string, unknown>));
}

export async function getQueueStats(): Promise<HitlQueueStats> {
  const rows = await listPending();
  if (rows.length === 0) {
    return {
      total: 0,
      oldest_age_minutes: null,
      over_sla: 0,
      by_source: { workflow: 0, agent_trigger: 0 },
    };
  }
  const oldest = rows.reduce((max, r) => Math.max(max, r.age_ms), 0);
  const over_sla = rows.filter((r) => r.age_ms > SLA_MINUTES * 60_000).length;
  return {
    total: rows.length,
    oldest_age_minutes: Math.floor(oldest / 60_000),
    over_sla,
    by_source: {
      workflow: rows.filter((r) => r.source === 'workflow').length,
      agent_trigger: rows.filter((r) => r.source === 'agent_trigger').length,
    },
  };
}

export async function approve(item: HitlItem, feedback: string = ''): Promise<void> {
  await approveWorkflowRun(item.id, item.workflow_id, feedback);
}

export async function reject(item: HitlItem, feedback: string = ''): Promise<void> {
  await rejectWorkflowRun(item.id, feedback);
}

export interface EnqueueFromAgentInput {
  agent_id: string;
  trigger_key: string; // e.g. "discount_over_15pct", "order_above_50k"
  reason: string; // human-readable summary
  context?: Record<string, unknown>;
  workflow_id?: string; // optional — if agent runs inside a workflow
}

/**
 * Enfileira um pedido de aprovação humana disparado por um agente.
 *
 * Cria (ou reaproveita) um `workflow_runs` em status `awaiting_approval`
 * com `output.pending_approval` preenchido para o viewer da ApprovalQueuePage.
 */
export async function enqueueFromAgentTrigger(input: EnqueueFromAgentInput): Promise<HitlItem> {
  const payload = {
    workflow_id: input.workflow_id ?? input.agent_id, // fallback: usa o agent_id como "workflow virtual"
    status: 'awaiting_approval',
    current_step: 1,
    total_steps: 1,
    started_at: new Date().toISOString(),
    output: {
      pending_approval: {
        source: 'agent_trigger' as const,
        agent_id: input.agent_id,
        trigger_key: input.trigger_key,
        reason: input.reason,
        label: input.trigger_key,
        context: input.context ?? {},
      },
    } as never,
  };

  const { data, error } = await supabaseExternal
    .from('workflow_runs')
    .insert(payload)
    .select('id, workflow_id, status, output, started_at, current_step, total_steps')
    .single();
  if (error) throw error;
  return decorate(data as Record<string, unknown>);
}

/**
 * Subscribe a realtime channel on `workflow_runs` with status changes
 * envolvendo `awaiting_approval`. O callback recebe a nova linha.
 */
export function subscribeQueueChanges(onChange: () => void): () => void {
  const channel = supabase
    .channel('hitl-queue')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'workflow_runs' }, (payload) => {
      const status = (payload.new as { status?: string } | null)?.status;
      const oldStatus = (payload.old as { status?: string } | null)?.status;
      if (status === 'awaiting_approval' || oldStatus === 'awaiting_approval') onChange();
    })
    .subscribe();
  return () => {
    supabase.removeChannel(channel);
  };
}
