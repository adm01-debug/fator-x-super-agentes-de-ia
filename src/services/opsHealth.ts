/**
 * Ops Health — `src/services/opsHealth.ts`
 *
 * Snapshot único que agrega os três sinais de saúde operacional das
 * Rodadas 1-4:
 *
 *   - gates: quantos agentes passam no deploy gate vs. total
 *   - budget: estado do orçamento do workspace (OK / warn / block)
 *   - hitl: quantas aprovações pendentes + SLA
 *
 * Usado pelo widget `OpsHealthWidget` e por checks automatizados
 * (ex.: cron `health-check` edge function pode consumir via RPC).
 */
import { supabase } from '@/integrations/supabase/client';
import {
  computeGateForRun,
  listLatestEvalRunsForAgents,
  type EvalGateRun,
} from '@/services/evalGates';
import { getBudgetSnapshot, shouldBlockCall, type BudgetSnapshot } from '@/services/costBudget';
import { getQueueStats, type HitlQueueStats } from '@/services/hitlQueue';

export type HealthLevel = 'ok' | 'warn' | 'block';

export interface OpsHealthSnapshot {
  level: HealthLevel;
  headline: string;
  gates: {
    total_agents: number;
    gate_ok: number;
    gate_block: number;
    gate_missing_eval: number;
  };
  budget: BudgetSnapshot | null;
  hitl: HitlQueueStats;
}

export async function computeOpsHealth(workspaceId?: string): Promise<OpsHealthSnapshot> {
  const [gatesResult, budgetResult, hitlResult] = await Promise.allSettled([
    computeGatesOverview(workspaceId),
    workspaceId ? getBudgetSnapshot(workspaceId) : Promise.resolve<BudgetSnapshot | null>(null),
    getQueueStats(),
  ]);

  const gates =
    gatesResult.status === 'fulfilled'
      ? gatesResult.value
      : { total_agents: 0, gate_ok: 0, gate_block: 0, gate_missing_eval: 0 };
  const budget = budgetResult.status === 'fulfilled' ? budgetResult.value : null;
  const hitl =
    hitlResult.status === 'fulfilled'
      ? hitlResult.value
      : {
          total: 0,
          oldest_age_minutes: null,
          over_sla: 0,
          by_source: { workflow: 0, agent_trigger: 0 },
        };

  const level = deriveLevel(gates, budget, hitl);
  const headline = buildHeadline(level, gates, budget, hitl);

  return { level, headline, gates, budget, hitl };
}

async function computeGatesOverview(workspaceId?: string) {
  let q = supabase.from('agents').select('id, is_template, workspace_id').eq('is_template', false);
  if (workspaceId) q = q.eq('workspace_id', workspaceId);
  const { data, error } = await q;
  if (error) throw error;
  const ids = ((data ?? []) as Array<{ id: string }>).map((r) => r.id);
  if (ids.length === 0) {
    return { total_agents: 0, gate_ok: 0, gate_block: 0, gate_missing_eval: 0 };
  }
  const latest: Record<string, EvalGateRun | null> = await listLatestEvalRunsForAgents(ids);
  let ok = 0;
  let block = 0;
  let missing = 0;
  for (const id of ids) {
    const run = latest[id];
    if (!run) {
      missing++;
      continue;
    }
    const gate = computeGateForRun(run);
    if (gate.allow) ok++;
    else block++;
  }
  return { total_agents: ids.length, gate_ok: ok, gate_block: block, gate_missing_eval: missing };
}

function deriveLevel(
  gates: OpsHealthSnapshot['gates'],
  budget: BudgetSnapshot | null,
  hitl: HitlQueueStats,
): HealthLevel {
  if (budget && shouldBlockCall(budget)) return 'block';
  if (gates.gate_block > 0 && gates.gate_block >= Math.max(1, gates.total_agents / 2))
    return 'block';
  if (hitl.over_sla > 0) return 'block';
  if ((budget && budget.warning) || hitl.total > 0 || gates.gate_missing_eval > 0) return 'warn';
  return 'ok';
}

function buildHeadline(
  level: HealthLevel,
  gates: OpsHealthSnapshot['gates'],
  budget: BudgetSnapshot | null,
  hitl: HitlQueueStats,
): string {
  if (level === 'block') {
    if (budget && shouldBlockCall(budget)) return 'Orçamento bloqueando chamadas';
    if (hitl.over_sla > 0) return `${hitl.over_sla} aprovação(ões) fora do SLA`;
    if (gates.gate_block > 0) return `${gates.gate_block} agentes bloqueados no gate de deploy`;
    return 'Operação degradada';
  }
  if (level === 'warn') {
    const parts: string[] = [];
    if (hitl.total > 0) parts.push(`${hitl.total} aprovações pendentes`);
    if (gates.gate_missing_eval > 0) parts.push(`${gates.gate_missing_eval} sem eval`);
    if (budget?.warning) parts.push(`${budget.monthly_pct.toFixed(0)}% do orçamento`);
    return parts.join(' · ') || 'Atenção requerida';
  }
  return `Saudável — ${gates.gate_ok}/${gates.total_agents} agentes prontos`;
}
