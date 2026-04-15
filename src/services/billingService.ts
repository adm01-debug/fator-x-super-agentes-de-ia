/**
 * Nexus Agents Studio — Billing Service
 * Budget management, cost tracking, pricing.
 */
import { fromTable } from '@/lib/supabaseExtended';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

// ═══ Usage ═══

export async function getUsageSummary(period: 'day' | 'week' | 'month' = 'week') {
  const now = new Date();
  const periodMs = period === 'day' ? 86400000 : period === 'week' ? 604800000 : 2592000000;
  const since = new Date(now.getTime() - periodMs).toISOString();

  const { data, error } = await fromTable('usage_records')
    .select('cost_usd, record_type, tokens, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const records = (data ?? []) as Array<Record<string, unknown>>;
  const totalCost = records.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const totalTokens = records.reduce((s, r) => s + Number(r.tokens || 0), 0);

  const byType: Record<string, number> = {};
  records.forEach(r => {
    const type = String(r.record_type || 'llm');
    byType[type] = (byType[type] || 0) + Number(r.cost_usd || 0);
  });

  return { totalCost, totalTokens, byType, recordCount: records.length, period, since };
}

export async function getAgentUsage(days = 30) {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const { data, error } = await supabaseExternal
    .from('agent_usage')
    .select('*')
    .gte('date', since.toISOString().split('T')[0])
    .order('date', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function getUsageRecords(limit = 50) {
  const { data, error } = await supabaseExternal
    .from('usage_records')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

// ═══ Budgets ═══

export async function listBudgets() {
  const { data, error } = await supabaseExternal
    .from('budgets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getBudget(workspaceId: string) {
  const { data } = await supabaseExternal
    .from('budgets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();
  return data;
}

export async function createBudget(workspaceId: string, name: string, limitUsd: number) {
  const { data, error } = await supabaseExternal
    .from('budgets')
    .insert({ name, limit_usd: limitUsd, workspace_id: workspaceId })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteBudget(id: string) {
  const { error } = await supabaseExternal.from('budgets').delete().eq('id', id);
  if (error) throw error;
}

export async function setBudget(workspaceId: string, monthlyLimit: number) {
  const { data, error } = await supabaseExternal
    .from('budgets')
    .upsert({ workspace_id: workspaceId, limit_usd: monthlyLimit, alert_threshold: 0.8 })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function checkBudgetStatus(workspaceId: string) {
  const budget = await getBudget(workspaceId);
  if (!budget) return { status: 'no_budget', used: 0, limit: 0, percentage: 0 };

  const usage = await getUsageSummary('month');
  const limit = budget.limit_usd ?? 0;
  const percentage = limit > 0 ? (usage.totalCost / limit) * 100 : 0;

  return {
    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok',
    used: usage.totalCost,
    limit,
    percentage: Math.round(percentage),
  };
}

// ═══ Pricing ═══

export async function getModelPricing() {
  const { data, error } = await supabaseExternal
    .from('model_pricing')
    .select('*')
    .order('model_pattern');
  if (error) throw error;
  return data ?? [];
}
