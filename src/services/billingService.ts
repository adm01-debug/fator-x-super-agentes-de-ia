/**
 * Nexus Agents Studio — Billing Service
 * Budget management, cost tracking, kill switch.
 */
import { supabase } from '@/integrations/supabase/client';

export async function getUsageSummary(period: 'day' | 'week' | 'month' = 'week') {
  const now = new Date();
  const periodMs = period === 'day' ? 86400000 : period === 'week' ? 604800000 : 2592000000;
  const since = new Date(now.getTime() - periodMs).toISOString();

  const { data, error } = await supabase
    .from('usage_records')
    .select('cost_usd, usage_type, token_count, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  if (error) throw error;

  const records = data ?? [];
  const totalCost = records.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const totalTokens = records.reduce((s, r) => s + Number(r.token_count || 0), 0);

  const byType: Record<string, number> = {};
  records.forEach(r => {
    const type = String(r.usage_type || 'llm');
    byType[type] = (byType[type] || 0) + Number(r.cost_usd || 0);
  });

  return { totalCost, totalTokens, byType, recordCount: records.length, period, since };
}

export async function getBudget(workspaceId: string) {
  const { data } = await supabase
    .from('budgets')
    .select('*')
    .eq('workspace_id', workspaceId)
    .maybeSingle();

  return data;
}

export async function setBudget(workspaceId: string, monthlyLimit: number) {
  const { data, error } = await supabase
    .from('budgets')
    .upsert({ workspace_id: workspaceId, monthly_limit: monthlyLimit, alert_threshold: 0.8 })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function checkBudgetStatus(workspaceId: string) {
  const budget = await getBudget(workspaceId);
  if (!budget) return { status: 'no_budget', used: 0, limit: 0, percentage: 0 };

  const usage = await getUsageSummary('month');
  const percentage = budget.monthly_limit > 0 ? (usage.totalCost / budget.monthly_limit) * 100 : 0;

  return {
    status: percentage >= 100 ? 'exceeded' : percentage >= 80 ? 'warning' : 'ok',
    used: usage.totalCost,
    limit: budget.monthly_limit,
    percentage: Math.round(percentage),
  };
}
