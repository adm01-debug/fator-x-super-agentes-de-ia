/**
 * agentDayDetailsService — drill-down de um dia específico de um agente.
 * Lê traces da janela de 24h e produz agregações por modelo, ferramenta e
 * lista resumida de execuções.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface DayTrace {
  id: string;
  event: string;
  level: 'info' | 'warning' | 'error' | string;
  latency_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  created_at: string;
  metadata: Record<string, unknown> | null;
}

export interface ModelBreakdown {
  model: string;
  count: number;
  costUsd: number;
  tokens: number;
}

export interface ToolBreakdown {
  tool: string;
  count: number;
  totalLatencyMs: number;
  avgLatencyMs: number;
  errors: number;
}

export interface DayTotals {
  traceCount: number;
  totalCost: number;
  totalTokens: number;
  avgLatency: number;
  errorCount: number;
}

export interface AgentDayDetails {
  date: string;
  traces: DayTrace[];
  byModel: ModelBreakdown[];
  byTool: ToolBreakdown[];
  totals: DayTotals;
}

function pickModel(t: DayTrace): string {
  const md = t.metadata ?? {};
  const direct = (md as Record<string, unknown>).model;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const gen = (md as Record<string, unknown>)['gen_ai.request.model'];
  if (typeof gen === 'string' && gen.trim()) return gen;
  return 'desconhecido';
}

function pickTool(t: DayTrace): string | null {
  const md = t.metadata ?? {};
  const name = (md as Record<string, unknown>).tool_name;
  if (typeof name === 'string' && name.trim()) return name;
  const ev = t.event ?? '';
  const m = ev.match(/^(?:tool_call|tool|tool_use)[:.](.+)$/i);
  if (m) return m[1];
  return null;
}

export async function getAgentDayDetails(agentId: string, date: string): Promise<AgentDayDetails> {
  // date is YYYY-MM-DD (local). Use as ISO range covering the whole local day.
  const from = new Date(`${date}T00:00:00`);
  const to = new Date(from.getTime() + 24 * 3600 * 1000);

  try {
    const { data, error } = await supabaseExternal
      .from('agent_traces')
      .select('id, event, level, latency_ms, tokens_used, cost_usd, created_at, metadata')
      .eq('agent_id', agentId)
      .gte('created_at', from.toISOString())
      .lt('created_at', to.toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) {
      logger.error('Failed to fetch day drill-down', { agentId, date, error: error.message });
      return { date, traces: [], byModel: [], byTool: [], totals: emptyTotals() };
    }

    const traces = (data ?? []) as DayTrace[];

    // Aggregations
    const modelMap = new Map<string, ModelBreakdown>();
    const toolMap = new Map<string, ToolBreakdown>();
    let totalCost = 0;
    let totalTokens = 0;
    let totalLatency = 0;
    let latencyCount = 0;
    let errorCount = 0;

    for (const t of traces) {
      const cost = Number(t.cost_usd ?? 0);
      const tokens = Number(t.tokens_used ?? 0);
      totalCost += cost;
      totalTokens += tokens;
      if (typeof t.latency_ms === 'number' && t.latency_ms > 0) {
        totalLatency += t.latency_ms;
        latencyCount++;
      }
      if (t.level === 'error') errorCount++;

      // by model
      const model = pickModel(t);
      const mb = modelMap.get(model) ?? { model, count: 0, costUsd: 0, tokens: 0 };
      mb.count++;
      mb.costUsd += cost;
      mb.tokens += tokens;
      modelMap.set(model, mb);

      // by tool (only when applicable)
      const tool = pickTool(t);
      if (tool) {
        const tb = toolMap.get(tool) ?? { tool, count: 0, totalLatencyMs: 0, avgLatencyMs: 0, errors: 0 };
        tb.count++;
        tb.totalLatencyMs += Number(t.latency_ms ?? 0);
        if (t.level === 'error') tb.errors++;
        toolMap.set(tool, tb);
      }
    }

    const byModel = Array.from(modelMap.values())
      .sort((a, b) => b.costUsd - a.costUsd || b.count - a.count);
    const byTool = Array.from(toolMap.values())
      .map((t) => ({ ...t, avgLatencyMs: t.count > 0 ? Math.round(t.totalLatencyMs / t.count) : 0 }))
      .sort((a, b) => b.count - a.count);

    return {
      date,
      traces,
      byModel,
      byTool,
      totals: {
        traceCount: traces.length,
        totalCost,
        totalTokens,
        avgLatency: latencyCount > 0 ? Math.round(totalLatency / latencyCount) : 0,
        errorCount,
      },
    };
  } catch (e) {
    logger.error('Day drill-down crashed', { agentId, date, error: String(e) });
    return { date, traces: [], byModel: [], byTool: [], totals: emptyTotals() };
  }
}

function emptyTotals(): DayTotals {
  return { traceCount: 0, totalCost: 0, totalTokens: 0, avgLatency: 0, errorCount: 0 };
}
