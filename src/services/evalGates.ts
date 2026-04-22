/**
 * Eval Gates — `src/services/evalGates.ts`
 *
 * Transforma os resultados do edge `agent-eval-runner` em um **deploy gate**:
 * um agente só deve ir para canais de produção se o último run de avaliação
 * alcançou pass rate ≥ threshold (default 85%).
 *
 * Fonte: `public.agent_eval_runs` (ver edge function `agent-eval-runner`).
 * Leitura via client supabase (RLS-aware) — NÃO usa service role.
 */
import { supabase } from '@/integrations/supabase/client';

export interface EvalGateRun {
  id: string;
  agent_id: string;
  dataset_id: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  total_items: number;
  passed: number;
  failed: number;
  avg_score: number;
  avg_latency_ms: number;
  total_cost_usd: number;
  model: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface EvalGate {
  allow: boolean;
  reason: string;
  pass_rate: number; // 0..1 (passed / total_items)
  avg_score: number; // 0..1
  run?: EvalGateRun;
  threshold: number;
  staleness_days: number | null;
}

export const DEFAULT_PASS_RATE_THRESHOLD = 0.85;
export const MAX_EVAL_STALENESS_DAYS = 14;

export async function getLatestEvalRun(agentId: string): Promise<EvalGateRun | null> {
  const { data, error } = await supabase
    .from('agent_eval_runs')
    .select(
      'id, agent_id, dataset_id, status, total_items, passed, failed, avg_score, avg_latency_ms, total_cost_usd, model, completed_at, created_at',
    )
    .eq('agent_id', agentId)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as EvalGateRun | null) ?? null;
}

export async function listLatestEvalRunsForAgents(
  agentIds: string[],
): Promise<Record<string, EvalGateRun | null>> {
  if (agentIds.length === 0) return {};
  const { data, error } = await supabase
    .from('agent_eval_runs')
    .select(
      'id, agent_id, dataset_id, status, total_items, passed, failed, avg_score, avg_latency_ms, total_cost_usd, model, completed_at, created_at',
    )
    .in('agent_id', agentIds)
    .eq('status', 'completed')
    .order('completed_at', { ascending: false });
  if (error) throw error;
  const latest: Record<string, EvalGateRun | null> = Object.fromEntries(
    agentIds.map((id) => [id, null]),
  );
  for (const row of (data ?? []) as EvalGateRun[]) {
    if (!latest[row.agent_id]) latest[row.agent_id] = row;
  }
  return latest;
}

export function computeGateForRun(
  run: EvalGateRun | null,
  threshold: number = DEFAULT_PASS_RATE_THRESHOLD,
  maxStalenessDays: number = MAX_EVAL_STALENESS_DAYS,
): EvalGate {
  if (!run) {
    return {
      allow: false,
      reason: 'Nenhuma avaliação completa registrada para este agente.',
      pass_rate: 0,
      avg_score: 0,
      threshold,
      staleness_days: null,
    };
  }
  const pass_rate = run.total_items > 0 ? run.passed / run.total_items : 0;
  const stalenessMs = run.completed_at
    ? Date.now() - new Date(run.completed_at).getTime()
    : Number.POSITIVE_INFINITY;
  const staleness_days =
    run.completed_at && Number.isFinite(stalenessMs) ? Math.floor(stalenessMs / 86_400_000) : null;

  if (staleness_days !== null && staleness_days > maxStalenessDays) {
    return {
      allow: false,
      reason: `Última avaliação tem ${staleness_days} dias — acima do limite de ${maxStalenessDays}d. Rode nova avaliação.`,
      pass_rate,
      avg_score: Number(run.avg_score ?? 0),
      run,
      threshold,
      staleness_days,
    };
  }

  if (pass_rate < threshold) {
    return {
      allow: false,
      reason: `Pass rate ${(pass_rate * 100).toFixed(1)}% abaixo do mínimo ${(threshold * 100).toFixed(0)}%.`,
      pass_rate,
      avg_score: Number(run.avg_score ?? 0),
      run,
      threshold,
      staleness_days,
    };
  }

  return {
    allow: true,
    reason: `OK — ${(pass_rate * 100).toFixed(1)}% dos ${run.total_items} itens passaram.`,
    pass_rate,
    avg_score: Number(run.avg_score ?? 0),
    run,
    threshold,
    staleness_days,
  };
}

export async function computeDeployGate(
  agentId: string,
  threshold: number = DEFAULT_PASS_RATE_THRESHOLD,
): Promise<EvalGate> {
  const run = await getLatestEvalRun(agentId);
  return computeGateForRun(run, threshold);
}

/**
 * Dispara uma nova avaliação via edge function `agent-eval-runner`.
 * Retorna o `run_id` criado (a execução continua em background do edge).
 */
export async function triggerEvalRun(input: {
  agent_id: string;
  dataset_id: string;
}): Promise<{ run_id: string }> {
  const { data, error } = await supabase.functions.invoke('agent-eval-runner', { body: input });
  if (error) throw error;
  return data as { run_id: string };
}
