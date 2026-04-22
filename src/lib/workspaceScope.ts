/**
 * Workspace Scope Helpers — `src/lib/workspaceScope.ts`
 *
 * Normaliza o uso de `workspace_id` em queries cliente-side. RLS já
 * garante isolamento no banco; estes helpers evitam bugs de UX quando
 * um componente esquece o `eq('workspace_id', ...)` e acaba mostrando
 * "nenhum resultado" mesmo com dados do workspace existindo.
 *
 *   requireWorkspace()           — lê o workspace_id atual ou lança
 *   scopeQuery(qb, workspaceId)  — aplica o filtro de forma idempotente
 *   isScopedTable(tableName)     — retorna true quando a tabela tem coluna workspace_id
 */
import { getWorkspaceId } from '@/hooks/use-data';

export class NoWorkspaceError extends Error {
  constructor() {
    super('Nenhum workspace ativo — usuário precisa estar logado.');
    this.name = 'NoWorkspaceError';
  }
}

export async function requireWorkspace(): Promise<string> {
  const id = await getWorkspaceId();
  if (!id) throw new NoWorkspaceError();
  return id;
}

/**
 * Aplica `.eq('workspace_id', id)` num query builder tipado do Supabase.
 * Aceita qualquer objeto que exponha `.eq(column, value)` retornando ele
 * mesmo — cobre `SelectQueryBuilder`, `UpdateQueryBuilder`, etc.
 */
export function scopeQuery<T extends { eq: (col: string, value: unknown) => T }>(
  qb: T,
  workspaceId: string,
): T {
  return qb.eq('workspace_id', workspaceId);
}

/**
 * Lista de tabelas que **têm** coluna `workspace_id` e portanto precisam
 * ser filtradas no cliente (mesmo com RLS) para uma UX correta.
 * Mantém-se em código-fonte como fonte única de verdade; a CI roda um
 * scan simples (`src/test/workspaceScope.test.ts`) para evitar drift.
 */
export const WORKSPACE_SCOPED_TABLES = new Set<string>([
  'agents',
  'agent_versions',
  'agent_eval_runs',
  'agent_eval_datasets',
  'agent_eval_results',
  'agent_traces',
  'agent_workflow_runs',
  'evaluation_datasets',
  'evaluation_runs',
  'workflow_runs',
  'workflows',
  'workflow_steps',
  'workspace_budgets',
  'budget_events',
  'prompts',
  'prompt_versions',
  'prompt_experiments',
  'prompt_experiment_runs',
  'knowledge_bases',
  'test_cases',
  'deployments',
  'deploy_channels',
  'notifications',
  'audit_logs',
]);

export function isScopedTable(tableName: string): boolean {
  return WORKSPACE_SCOPED_TABLES.has(tableName);
}
