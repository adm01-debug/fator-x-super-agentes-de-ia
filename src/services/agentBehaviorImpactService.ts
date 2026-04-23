/**
 * agentBehaviorImpactService — Agrega traces recentes do agente para responder
 * "o que de fato muda no comportamento se eu escolher copiar prompt / tools /
 * model neste rollback?". Não substitui o `restoreDiffHelpers` (que mostra a
 * diferença de configuração). Aqui mostramos o IMPACTO OPERACIONAL: quantas
 * sessões usaram aquele prompt, quais etapas chamaram cada tool, qual a
 * latência média sob cada modelo, etc.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export interface ToolUsageSummary {
  /** Nome canônico da tool (lowercase) usado para casar com `cfg.tools`. */
  key: string;
  /** Nome de exibição (preserva casing original). */
  displayName: string;
  /** Total de chamadas no período. */
  calls: number;
  /** Quantas falharam (`level = 'error'`). */
  failures: number;
  /** Quantas sessões distintas chamaram esta tool. */
  sessions: number;
  /** Eventos distintos onde a tool aparece — dá pista de "em quais etapas". */
  events: string[];
  /** Latência média (ms) das chamadas com sucesso. */
  avgLatencyMs: number;
  /** Última vez que a tool foi chamada (ISO). */
  lastUsedAt: string | null;
}

export interface PromptBehaviorSummary {
  /** Total de sessões (contagem de session_id distintos). */
  sessions: number;
  /** Total de traces no período. */
  totalTraces: number;
  /** Eventos relacionados a raciocínio que dependem do prompt/persona. */
  reasoningEvents: number;
  /** Comprimento médio (chars) das outputs — proxy de "como o prompt está moldando respostas". */
  avgOutputChars: number;
}

export interface ModelBehaviorSummary {
  /** Modelo dominante observado nos traces (pode diferir do registrado). */
  observedModel: string | null;
  /** Latência p50 em ms. */
  p50LatencyMs: number;
  /** Latência p95 em ms. */
  p95LatencyMs: number;
  /** Custo médio por trace em USD. */
  avgCostUsd: number;
  /** Tokens médios por trace. */
  avgTokens: number;
  /** Total de traces analisados. */
  totalTraces: number;
}

export interface AgentBehaviorImpact {
  /** Janela analisada (dias). */
  windowDays: number;
  /** Traces de tool agregados por nome — usado pelo grupo Tools. */
  toolUsage: ToolUsageSummary[];
  /** Resumo de uso geral do prompt — usado pelo grupo Prompt. */
  prompt: PromptBehaviorSummary;
  /** Métricas observadas do modelo atual — usado pelo grupo Model. */
  model: ModelBehaviorSummary;
}

interface RawTrace {
  event: string | null;
  level: string | null;
  latency_ms: number | null;
  tokens_used: number | null;
  cost_usd: number | null;
  session_id: string | null;
  created_at: string;
  output: unknown;
  metadata: Record<string, unknown> | null;
}

function pickToolName(t: RawTrace): string | null {
  const md = t.metadata ?? {};
  const name = md.tool_name;
  if (typeof name === 'string' && name.trim()) return name;
  const ev = t.event ?? '';
  const m = ev.match(/^(?:tool_call|tool|tool_use)[:.](.+)$/i);
  if (m) return m[1];
  return null;
}

function pickModelName(t: RawTrace): string | null {
  const md = t.metadata ?? {};
  const direct = md.model;
  if (typeof direct === 'string' && direct.trim()) return direct;
  const gen = md['gen_ai.request.model'];
  if (typeof gen === 'string' && gen.trim()) return gen;
  return null;
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return Math.round(sorted[idx]);
}

function outputChars(o: unknown): number {
  if (o === null || o === undefined) return 0;
  if (typeof o === 'string') return o.length;
  try { return JSON.stringify(o).length; } catch { return 0; }
}

/**
 * Carrega impacto comportamental dos últimos N dias para um agente.
 * Limite de 1000 traces por padrão para não travar a UI; suficiente para
 * uma janela de até ~7d em agentes ativos.
 */
export async function getAgentBehaviorImpact(
  agentId: string,
  windowDays = 7,
): Promise<AgentBehaviorImpact> {
  const from = new Date();
  from.setDate(from.getDate() - windowDays);

  const empty: AgentBehaviorImpact = {
    windowDays,
    toolUsage: [],
    prompt: { sessions: 0, totalTraces: 0, reasoningEvents: 0, avgOutputChars: 0 },
    model: {
      observedModel: null,
      p50LatencyMs: 0,
      p95LatencyMs: 0,
      avgCostUsd: 0,
      avgTokens: 0,
      totalTraces: 0,
    },
  };

  try {
    const { data, error } = await supabaseExternal
      .from('agent_traces')
      .select('event, level, latency_ms, tokens_used, cost_usd, session_id, created_at, output, metadata')
      .eq('agent_id', agentId)
      .gte('created_at', from.toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);
    if (error) {
      logger.error('Failed to load behavior impact traces', { agentId, error: error.message });
      return empty;
    }

    const traces = (data ?? []) as RawTrace[];
    if (traces.length === 0) return empty;

    // ── Tools ────────────────────────────────────────────────
    const toolMap = new Map<string, {
      displayName: string;
      calls: number;
      failures: number;
      sessions: Set<string>;
      events: Set<string>;
      latencies: number[];
      lastUsedAt: string | null;
    }>();
    for (const t of traces) {
      const name = pickToolName(t);
      if (!name) continue;
      const key = name.toLowerCase();
      let entry = toolMap.get(key);
      if (!entry) {
        entry = {
          displayName: name,
          calls: 0,
          failures: 0,
          sessions: new Set(),
          events: new Set(),
          latencies: [],
          lastUsedAt: null,
        };
        toolMap.set(key, entry);
      }
      entry.calls++;
      if (t.level === 'error') entry.failures++;
      if (t.session_id) entry.sessions.add(t.session_id);
      if (t.event) entry.events.add(t.event);
      if (t.level !== 'error' && typeof t.latency_ms === 'number') {
        entry.latencies.push(t.latency_ms);
      }
      // traces vêm em ordem desc — primeiro encontrado é o mais recente.
      if (!entry.lastUsedAt) entry.lastUsedAt = t.created_at;
    }

    const toolUsage: ToolUsageSummary[] = Array.from(toolMap.entries()).map(([key, e]) => ({
      key,
      displayName: e.displayName,
      calls: e.calls,
      failures: e.failures,
      sessions: e.sessions.size,
      events: Array.from(e.events).slice(0, 5),
      avgLatencyMs: e.latencies.length
        ? Math.round(e.latencies.reduce((s, x) => s + x, 0) / e.latencies.length)
        : 0,
      lastUsedAt: e.lastUsedAt,
    }));
    toolUsage.sort((a, b) => b.calls - a.calls);

    // ── Prompt ───────────────────────────────────────────────
    const sessions = new Set<string>();
    let reasoningEvents = 0;
    let totalOutputChars = 0;
    let outputSamples = 0;
    const reasoningRe = /^(agent\.start|reasoning|llm\.|prompt\.|chat\.completion)/i;
    for (const t of traces) {
      if (t.session_id) sessions.add(t.session_id);
      if (t.event && reasoningRe.test(t.event)) reasoningEvents++;
      const ch = outputChars(t.output);
      if (ch > 0) {
        totalOutputChars += ch;
        outputSamples++;
      }
    }
    const prompt: PromptBehaviorSummary = {
      sessions: sessions.size,
      totalTraces: traces.length,
      reasoningEvents,
      avgOutputChars: outputSamples ? Math.round(totalOutputChars / outputSamples) : 0,
    };

    // ── Model ────────────────────────────────────────────────
    const modelCounts = new Map<string, number>();
    const lats: number[] = [];
    let costSum = 0;
    let costN = 0;
    let tokSum = 0;
    let tokN = 0;
    for (const t of traces) {
      const m = pickModelName(t);
      if (m) modelCounts.set(m, (modelCounts.get(m) ?? 0) + 1);
      if (typeof t.latency_ms === 'number') lats.push(t.latency_ms);
      if (typeof t.cost_usd === 'number') { costSum += t.cost_usd; costN++; }
      if (typeof t.tokens_used === 'number') { tokSum += t.tokens_used; tokN++; }
    }
    lats.sort((a, b) => a - b);
    let observedModel: string | null = null;
    let maxCount = 0;
    modelCounts.forEach((c, m) => { if (c > maxCount) { maxCount = c; observedModel = m; } });

    const model: ModelBehaviorSummary = {
      observedModel,
      p50LatencyMs: percentile(lats, 50),
      p95LatencyMs: percentile(lats, 95),
      avgCostUsd: costN ? costSum / costN : 0,
      avgTokens: tokN ? Math.round(tokSum / tokN) : 0,
      totalTraces: traces.length,
    };

    return { windowDays, toolUsage, prompt, model };
  } catch (e) {
    logger.error('Behavior impact aggregation failed', { agentId, err: String(e) });
    return empty;
  }
}
