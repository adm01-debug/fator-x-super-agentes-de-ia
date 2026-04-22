/**
 * Cost Budget Circuit Breaker — `src/services/costBudget.ts`
 *
 * Camada em cima de `budgetService` com foco em **operação**:
 *  - `getBudgetSnapshot` devolve um objeto compacto pronto para UI.
 *  - `isOverBudget` / `shouldBlockCall` retornam o veredito para ser
 *    consumido antes de disparar um edge function custoso.
 *  - `enforceAgents` aciona a RPC `enforce_budget` para pausar agentes
 *    em massa quando o hard cap é atingido.
 *
 * O estado é real: consome `public.workspace_budgets` + `check_budget` RPC.
 * Não cria estado paralelo — apenas empacota para os call sites.
 */
import { budgetService, type BudgetStatus } from '@/services/budgetService';
import { supabase } from '@/integrations/supabase/client';
import { startOfMonth } from '@/services/costAttribution';

export interface BudgetSnapshot {
  configured: boolean;
  allow_call: boolean;
  hard_stop: boolean;
  warning: boolean;
  daily_pct: number;
  monthly_pct: number;
  daily_spend: number;
  monthly_spend: number;
  daily_limit: number | null;
  monthly_limit: number | null;
  soft_threshold_pct: number;
  reason: string | null;
}

const DEFAULT_SOFT_THRESHOLD_PCT = 80;

export function toSnapshot(status: BudgetStatus): BudgetSnapshot {
  const soft_threshold_pct = Number(status.soft_threshold_pct ?? DEFAULT_SOFT_THRESHOLD_PCT);
  const daily_pct = Number(status.daily_pct ?? 0);
  const monthly_pct = Number(status.monthly_pct ?? 0);
  return {
    configured: Boolean(status.configured),
    allow_call: Boolean(status.allowed),
    hard_stop: Boolean(status.hard_stop),
    warning:
      Boolean(status.warning) ||
      daily_pct >= soft_threshold_pct ||
      monthly_pct >= soft_threshold_pct,
    daily_pct,
    monthly_pct,
    daily_spend: Number(status.daily_spend ?? 0),
    monthly_spend: Number(status.monthly_spend ?? 0),
    daily_limit: status.daily_limit ?? null,
    monthly_limit: status.monthly_limit ?? null,
    soft_threshold_pct,
    reason: status.reason ?? null,
  };
}

export async function getBudgetSnapshot(workspaceId: string): Promise<BudgetSnapshot> {
  const status = await budgetService.checkBudget(workspaceId);
  return toSnapshot(status);
}

/** Retorna `true` quando a chamada **não deve ser feita** (hard stop). */
export function shouldBlockCall(snapshot: BudgetSnapshot): boolean {
  if (!snapshot.configured) return false;
  return snapshot.hard_stop || !snapshot.allow_call;
}

/** Retorna `true` quando o workspace excedeu o limite (daily ou monthly ≥ 100%). */
export function isOverBudget(snapshot: BudgetSnapshot): boolean {
  return snapshot.daily_pct >= 100 || snapshot.monthly_pct >= 100;
}

/**
 * Gate síncrono pronto para call sites.
 * Busca o snapshot atual e lança `BudgetExceededError` se a chamada for bloqueada.
 */
export async function assertWithinBudget(workspaceId: string): Promise<BudgetSnapshot> {
  const snapshot = await getBudgetSnapshot(workspaceId);
  if (shouldBlockCall(snapshot)) {
    throw new BudgetExceededError(
      snapshot.reason ??
        `Orçamento atingido — mensal ${snapshot.monthly_pct.toFixed(0)}%, diário ${snapshot.daily_pct.toFixed(0)}%.`,
      snapshot,
    );
  }
  return snapshot;
}

export class BudgetExceededError extends Error {
  readonly snapshot: BudgetSnapshot;
  constructor(message: string, snapshot: BudgetSnapshot) {
    super(message);
    this.name = 'BudgetExceededError';
    this.snapshot = snapshot;
  }
}

/**
 * Aciona o enforce server-side: a RPC `enforce_budget` pausa agentes
 * e gera eventos em `budget_events`. Deve ser chamada após upsert/reset.
 */
export async function enforceAgents(): Promise<{
  blocked: number;
  warned: number;
  agents_paused: number;
}> {
  return budgetService.enforceBudget();
}

// ═══ Agent-level budget enforcement ════════════════════════════
// Cada agente tem `monthly_budget` + `budget_alert_threshold`. A função
// `computeAgentSpendThisMonth` soma `agent_eval_runs.total_cost_usd` do
// mês corrente e o helper abaixo decide se o agente excedeu seu limite.

export interface AgentBudgetStatus {
  agent_id: string;
  configured: boolean;
  spend_usd: number;
  limit_usd: number | null;
  pct_used: number;
  threshold_pct: number;
  warning: boolean;
  blocked: boolean;
}

export async function computeAgentSpendThisMonth(agentId: string): Promise<number> {
  const window = startOfMonth();
  const { data, error } = await supabase
    .from('agent_eval_runs')
    .select('total_cost_usd, completed_at, status')
    .eq('agent_id', agentId)
    .eq('status', 'completed')
    .gte('completed_at', window.from)
    .lte('completed_at', window.to);
  if (error) throw error;
  return ((data ?? []) as Array<{ total_cost_usd: number | null }>).reduce(
    (s, r) => s + Number(r.total_cost_usd ?? 0),
    0,
  );
}

export async function getAgentBudgetStatus(
  agentId: string,
  overrides?: { monthly_budget?: number | null; threshold_pct?: number | null },
): Promise<AgentBudgetStatus> {
  let limit = overrides?.monthly_budget ?? null;
  let threshold = overrides?.threshold_pct ?? null;

  if (limit === null || threshold === null) {
    const { data } = await supabase.from('agents').select('config').eq('id', agentId).maybeSingle();
    const cfg = ((data as { config?: Record<string, unknown> } | null)?.config ?? {}) as Record<
      string,
      unknown
    >;
    if (limit === null) limit = (cfg.monthly_budget as number | undefined) ?? null;
    if (threshold === null) threshold = (cfg.budget_alert_threshold as number | undefined) ?? 80;
  }

  const spend = await computeAgentSpendThisMonth(agentId);
  const pct = limit && limit > 0 ? (spend / limit) * 100 : 0;
  const thr = threshold ?? 80;

  return {
    agent_id: agentId,
    configured: limit !== null && limit > 0,
    spend_usd: round4(spend),
    limit_usd: limit,
    pct_used: round2(pct),
    threshold_pct: thr,
    warning: pct >= thr && pct < 100,
    blocked: pct >= 100,
  };
}

export class AgentBudgetExceededError extends Error {
  readonly status: AgentBudgetStatus;
  constructor(status: AgentBudgetStatus) {
    super(
      `Agente ${status.agent_id} excedeu orçamento mensal: ${status.pct_used}% de US$ ${status.limit_usd ?? 0}.`,
    );
    this.name = 'AgentBudgetExceededError';
    this.status = status;
  }
}

export async function assertAgentBudget(agentId: string): Promise<AgentBudgetStatus> {
  const status = await getAgentBudgetStatus(agentId);
  if (status.configured && status.blocked) throw new AgentBudgetExceededError(status);
  return status;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
