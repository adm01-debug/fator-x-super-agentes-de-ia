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
