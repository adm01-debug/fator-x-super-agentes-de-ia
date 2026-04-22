/**
 * Cost Attribution — `src/services/costAttribution.ts`
 *
 * Agrega o gasto real (LLM tokens + tools) por agente, por workflow e por
 * período. Usa tabelas já existentes:
 *
 *   - `agent_eval_runs.total_cost_usd`  — custos em evals
 *   - `agent_traces.cost_usd`           — custos em produção
 *
 * O serviço é puramente read-only; não escreve nada. UI pode consumir
 * para mostrar o Top-N de agentes mais caros do mês, breakdown por
 * categoria etc.
 */
import { supabase } from '@/integrations/supabase/client';

export interface AttributionWindow {
  from: string; // ISO
  to: string; // ISO
}

export interface AgentSpend {
  agent_id: string;
  agent_name: string;
  eval_cost_usd: number;
  prod_cost_usd: number;
  total_usd: number;
  share_pct: number;
}

export interface AttributionSummary {
  window: AttributionWindow;
  total_usd: number;
  by_agent: AgentSpend[];
}

export function lastNDays(n: number): AttributionWindow {
  const to = new Date();
  const from = new Date(to.getTime() - n * 86_400_000);
  return { from: from.toISOString(), to: to.toISOString() };
}

export function startOfMonth(): AttributionWindow {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: from.toISOString(), to: now.toISOString() };
}

async function sumEvalCosts(window: AttributionWindow): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('agent_eval_runs')
    .select('agent_id, total_cost_usd, completed_at')
    .gte('completed_at', window.from)
    .lte('completed_at', window.to)
    .eq('status', 'completed');
  if (error) throw error;
  const sums: Record<string, number> = {};
  for (const row of (data ?? []) as Array<{ agent_id: string; total_cost_usd: number | null }>) {
    sums[row.agent_id] = (sums[row.agent_id] ?? 0) + Number(row.total_cost_usd ?? 0);
  }
  return sums;
}

async function sumProdCosts(window: AttributionWindow): Promise<Record<string, number>> {
  // agent_traces table may not always exist; fail-safe
  try {
    const { data, error } = await supabase
      .from('agent_traces' as never)
      .select('agent_id, cost_usd, created_at')
      .gte('created_at', window.from)
      .lte('created_at', window.to);
    if (error) return {};
    const sums: Record<string, number> = {};
    for (const row of (data ?? []) as Array<{ agent_id: string; cost_usd: number | null }>) {
      sums[row.agent_id] = (sums[row.agent_id] ?? 0) + Number(row.cost_usd ?? 0);
    }
    return sums;
  } catch {
    return {};
  }
}

async function loadAgentNames(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const { data, error } = await supabase.from('agents').select('id, name').in('id', ids);
  if (error) return {};
  const map: Record<string, string> = {};
  for (const row of (data ?? []) as Array<{ id: string; name: string }>) {
    map[row.id] = row.name;
  }
  return map;
}

export async function computeAttribution(
  window: AttributionWindow = startOfMonth(),
): Promise<AttributionSummary> {
  const [evalCosts, prodCosts] = await Promise.all([sumEvalCosts(window), sumProdCosts(window)]);
  const agentIds = Array.from(new Set([...Object.keys(evalCosts), ...Object.keys(prodCosts)]));
  const names = await loadAgentNames(agentIds);

  const byAgent: AgentSpend[] = agentIds.map((id) => {
    const e = evalCosts[id] ?? 0;
    const p = prodCosts[id] ?? 0;
    return {
      agent_id: id,
      agent_name: names[id] ?? id,
      eval_cost_usd: round4(e),
      prod_cost_usd: round4(p),
      total_usd: round4(e + p),
      share_pct: 0,
    };
  });

  const total = byAgent.reduce((s, a) => s + a.total_usd, 0);
  for (const a of byAgent) {
    a.share_pct = total > 0 ? round2((a.total_usd / total) * 100) : 0;
  }
  byAgent.sort((a, b) => b.total_usd - a.total_usd);

  return {
    window,
    total_usd: round4(total),
    by_agent: byAgent,
  };
}

export function topN(summary: AttributionSummary, n: number): AgentSpend[] {
  return summary.by_agent.slice(0, n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
