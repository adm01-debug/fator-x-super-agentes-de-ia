/**
 * Diagnoses what likely caused the delta between the current 7d window and the
 * previous 7d window for each KPI. Pure functions over the data we already load
 * in AgentRichMetrics — no new fetches, no schema changes.
 */
import type { AgentTrace } from '@/services/agentsService';
import type { DailyPoint, KPIComparison } from './agentMetricsHelpers';
import { percentile } from './agentMetricsHelpers';

export type CauseTone = 'positive' | 'negative' | 'neutral';

export interface InsightCause {
  /** Short headline of the cause. */
  headline: string;
  /** Longer explanation, kept to one or two sentences. */
  detail: string;
  tone: CauseTone;
}

export interface KPIInsight {
  key: 'success' | 'latency' | 'cost' | 'requests';
  label: string;
  cmp: KPIComparison;
  /** Pre-formatted current vs previous values. */
  currentLabel: string;
  previousLabel: string;
  /** Ranked causes (most likely first). */
  causes: InsightCause[];
  /** Optional next-step suggestion. */
  recommendation?: string;
}

interface WindowSplit<T> {
  current: T[];
  previous: T[];
}

function splitDaily(daily: DailyPoint[], window: number): WindowSplit<DailyPoint> {
  return {
    current: daily.slice(-window),
    previous: daily.slice(-window * 2, -window),
  };
}

function splitTraces(traces: AgentTrace[], window: number): WindowSplit<AgentTrace> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutCurrent = new Date(today);
  cutCurrent.setDate(today.getDate() - window + 1);
  const cutPrev = new Date(today);
  cutPrev.setDate(today.getDate() - window * 2 + 1);

  const current: AgentTrace[] = [];
  const previous: AgentTrace[] = [];
  for (const t of traces) {
    if (!t.created_at) continue;
    const d = new Date(t.created_at);
    d.setHours(0, 0, 0, 0);
    if (d >= cutCurrent && d <= today) current.push(t);
    else if (d >= cutPrev && d < cutCurrent) previous.push(t);
  }
  return { current, previous };
}

function isError(t: AgentTrace): boolean {
  return t.level === 'error' || t.level === 'critical';
}

function pctChange(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function fmtPct(v: number, digits = 1): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`;
}

function fmtMs(v: number): string {
  return `${Math.round(v)}ms`;
}

function fmtCost(v: number): string {
  return v >= 1 ? `$${v.toFixed(2)}` : `$${v.toFixed(4)}`;
}

function eventCounts(traces: AgentTrace[], onlyErrors = false): Map<string, number> {
  const map = new Map<string, number>();
  for (const t of traces) {
    if (onlyErrors && !isError(t)) continue;
    const k = (t.event || '(sem evento)') as string;
    map.set(k, (map.get(k) || 0) + 1);
  }
  return map;
}

/** Top events that grew the most between previous and current windows. */
function topGrowingEvents(
  current: Map<string, number>,
  previous: Map<string, number>,
  limit = 2,
): Array<{ event: string; current: number; previous: number; delta: number }> {
  const keys = new Set<string>([...current.keys(), ...previous.keys()]);
  const arr = Array.from(keys).map((k) => ({
    event: k,
    current: current.get(k) || 0,
    previous: previous.get(k) || 0,
    delta: (current.get(k) || 0) - (previous.get(k) || 0),
  }));
  return arr
    .filter((e) => e.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, limit);
}

function spikeDays(daily: DailyPoint[], pick: (d: DailyPoint) => number): DailyPoint[] {
  // Days whose value is >1.5× the median for the same window.
  if (daily.length === 0) return [];
  const sorted = [...daily.map(pick)].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] || 0;
  if (med <= 0) {
    // pick days with the highest absolute values when median is zero
    return [...daily]
      .sort((a, b) => pick(b) - pick(a))
      .slice(0, 1)
      .filter((d) => pick(d) > 0);
  }
  return daily
    .filter((d) => pick(d) > med * 1.5 && pick(d) > 0)
    .sort((a, b) => pick(b) - pick(a))
    .slice(0, 2);
}

function buildSuccessInsight(
  cmp: KPIComparison,
  split: WindowSplit<AgentTrace>,
): KPIInsight {
  const curErr = split.current.filter(isError);
  const prevErr = split.previous.filter(isError);
  const curRate = split.current.length > 0 ? (curErr.length / split.current.length) * 100 : 0;
  const prevRate = split.previous.length > 0 ? (prevErr.length / split.previous.length) * 100 : 0;
  const errDelta = curErr.length - prevErr.length;
  const causes: InsightCause[] = [];
  const worsened = cmp.deltaPct < -0.05; // sucesso caiu

  if (worsened && errDelta > 0) {
    causes.push({
      headline: `${errDelta > 0 ? '+' : ''}${errDelta} erro${Math.abs(errDelta) !== 1 ? 's' : ''} em valor absoluto`,
      detail: `A taxa de erro passou de ${prevRate.toFixed(2)}% para ${curRate.toFixed(2)}% — ${curErr.length} traces com nível error/critical no período atual.`,
      tone: 'negative',
    });
  } else if (!worsened && errDelta < 0) {
    causes.push({
      headline: `${errDelta} erro${Math.abs(errDelta) !== 1 ? 's' : ''} a menos`,
      detail: `Taxa de erro caiu de ${prevRate.toFixed(2)}% para ${curRate.toFixed(2)}% — sinal positivo de estabilização.`,
      tone: 'positive',
    });
  }

  // Eventos com mais erros emergentes
  const curErrEvt = eventCounts(split.current, true);
  const prevErrEvt = eventCounts(split.previous, true);
  const growing = topGrowingEvents(curErrEvt, prevErrEvt, 2);
  if (worsened && growing.length > 0) {
    const list = growing
      .map((g) => `${g.event} (+${g.delta})`)
      .join(', ');
    causes.push({
      headline: 'Concentrado em eventos específicos',
      detail: `Os erros novos vieram principalmente de: ${list}.`,
      tone: 'negative',
    });
  }

  // Volume mudou? Pode ser ruído estatístico
  const volChange = pctChange(split.current.length, split.previous.length);
  if (Math.abs(volChange) > 25 && split.previous.length > 0) {
    causes.push({
      headline: `Volume de traces ${volChange >= 0 ? 'subiu' : 'caiu'} ${fmtPct(volChange)}`,
      detail: `Mudança grande no volume (${split.previous.length} → ${split.current.length} traces) aumenta a variância da taxa de sucesso — interprete o delta com cautela.`,
      tone: 'neutral',
    });
  }

  if (causes.length === 0) {
    causes.push({
      headline: worsened ? 'Pequena variação sem causa concentrada' : 'Estável',
      detail: worsened
        ? 'A queda é distribuída entre vários eventos sem um padrão claro — investigue traces individuais.'
        : `Taxa de erro mantém-se próxima de ${curRate.toFixed(2)}%.`,
      tone: worsened ? 'negative' : 'positive',
    });
  }

  return {
    key: 'success',
    label: 'Taxa de sucesso',
    cmp,
    currentLabel: `${cmp.current.toFixed(2)}%`,
    previousLabel: `${cmp.previous.toFixed(2)}%`,
    causes,
    recommendation: worsened
      ? 'Abra o drill-down de “Erros / Critical” no timeline para ver os traces afetados.'
      : undefined,
  };
}

function buildLatencyInsight(
  cmp: KPIComparison,
  splitTracesData: WindowSplit<AgentTrace>,
  splitDailyData: WindowSplit<DailyPoint>,
): KPIInsight {
  const curLat = splitTracesData.current
    .map((t) => Number(t.latency_ms ?? 0))
    .filter((n) => n > 0);
  const prevLat = splitTracesData.previous
    .map((t) => Number(t.latency_ms ?? 0))
    .filter((n) => n > 0);

  const curP50 = percentile(curLat, 50);
  const prevP50 = percentile(prevLat, 50);
  const curP95 = percentile(curLat, 95);
  const prevP95 = percentile(prevLat, 95);
  const curP99 = percentile(curLat, 99);
  const prevP99 = percentile(prevLat, 99);

  const causes: InsightCause[] = [];
  const worsened = cmp.deltaPct > 1; // média subiu (inverted)
  const dP50 = pctChange(curP50, prevP50);
  const dP95 = pctChange(curP95, prevP95);
  const dP99 = pctChange(curP99, prevP99);

  // Where did the regression hit?
  if (worsened) {
    if (Math.abs(dP99) > Math.abs(dP50) + 5 && dP99 > 0) {
      causes.push({
        headline: `Regressão concentrada na cauda (p99 ${fmtPct(dP99)})`,
        detail: `O p99 saltou de ${fmtMs(prevP99)} para ${fmtMs(curP99)} enquanto o p50 ${fmtPct(dP50)}. Indica outliers raros — possíveis timeouts, retries ou um agente externo lento.`,
        tone: 'negative',
      });
    } else if (dP50 > 5) {
      causes.push({
        headline: `Latência típica subiu (p50 ${fmtPct(dP50)})`,
        detail: `O p50 passou de ${fmtMs(prevP50)} para ${fmtMs(curP50)} — a degradação atinge a maioria das requisições, não só a cauda.`,
        tone: 'negative',
      });
    } else if (dP95 > 5) {
      causes.push({
        headline: `Crescimento no p95 (${fmtPct(dP95)})`,
        detail: `p95 de ${fmtMs(prevP95)} para ${fmtMs(curP95)}. O percentil de carga está sob pressão.`,
        tone: 'negative',
      });
    }
  } else if (cmp.deltaPct < -1) {
    causes.push({
      headline: 'Tempo de resposta melhorou',
      detail: `p50 ${fmtMs(prevP50)} → ${fmtMs(curP50)} · p95 ${fmtMs(prevP95)} → ${fmtMs(curP95)}.`,
      tone: 'positive',
    });
  }

  // Spike days
  const spikes = spikeDays(splitDailyData.current, (d) => d.avgLatency);
  if (spikes.length > 0 && worsened) {
    causes.push({
      headline: 'Dias específicos puxaram a média',
      detail: `Picos isolados em ${spikes.map((s) => `${s.label} (${fmtMs(s.avgLatency)})`).join(', ')}. Verifique deploys, carga ou degradação de provedor nessas datas.`,
      tone: 'negative',
    });
  }

  // Slow events
  const slowEvents = (() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const t of splitTracesData.current) {
      const lat = Number(t.latency_ms ?? 0);
      if (lat <= 0) continue;
      const k = t.event || '(sem evento)';
      const cur = map.get(k) || { sum: 0, n: 0 };
      cur.sum += lat;
      cur.n += 1;
      map.set(k, cur);
    }
    return Array.from(map.entries())
      .map(([k, v]) => ({ event: k, avg: v.sum / v.n, n: v.n }))
      .filter((x) => x.n >= 3)
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 2);
  })();
  if (worsened && slowEvents.length > 0) {
    causes.push({
      headline: 'Eventos mais lentos',
      detail: slowEvents
        .map((e) => `${e.event} (média ${fmtMs(e.avg)}, ${e.n} traces)`)
        .join(' · '),
      tone: 'negative',
    });
  }

  if (causes.length === 0) {
    causes.push({
      headline: 'Latência estável',
      detail: `Sem mudança significativa nos percentis (p50 ${fmtMs(curP50)}, p95 ${fmtMs(curP95)}, p99 ${fmtMs(curP99)}).`,
      tone: 'neutral',
    });
  }

  return {
    key: 'latency',
    label: 'Latência média',
    cmp,
    currentLabel: fmtMs(cmp.current / Math.max(1, splitDailyData.current.length)),
    previousLabel: fmtMs(cmp.previous / Math.max(1, splitDailyData.previous.length)),
    causes,
    recommendation: worsened
      ? 'Use o drill-down de “Latência > p95/p99” no timeline para ver os traces lentos.'
      : undefined,
  };
}

function buildCostInsight(
  cmp: KPIComparison,
  split: WindowSplit<DailyPoint>,
  tracesSplit: WindowSplit<AgentTrace>,
): KPIInsight {
  const causes: InsightCause[] = [];
  const worsened = cmp.deltaPct > 1; // custo subiu (inverted)
  const costPerReqCur = (() => {
    const req = split.current.reduce((s, d) => s + d.requests, 0);
    return req > 0 ? cmp.current / req : 0;
  })();
  const costPerReqPrev = (() => {
    const req = split.previous.reduce((s, d) => s + d.requests, 0);
    return req > 0 ? cmp.previous / req : 0;
  })();
  const reqCur = split.current.reduce((s, d) => s + d.requests, 0);
  const reqPrev = split.previous.reduce((s, d) => s + d.requests, 0);
  const reqDeltaPct = pctChange(reqCur, reqPrev);
  const cprDeltaPct = pctChange(costPerReqCur, costPerReqPrev);

  if (worsened) {
    if (cprDeltaPct > 5 && Math.abs(reqDeltaPct) < 10) {
      causes.push({
        headline: `Custo por requisição subiu ${fmtPct(cprDeltaPct)}`,
        detail: `Foi de ${fmtCost(costPerReqPrev)} para ${fmtCost(costPerReqCur)} por requisição com volume estável (${fmtPct(reqDeltaPct)}). Sugere troca para modelo mais caro ou prompts mais longos.`,
        tone: 'negative',
      });
    } else if (reqDeltaPct > 10) {
      causes.push({
        headline: `Volume cresceu ${fmtPct(reqDeltaPct)}`,
        detail: `${reqPrev.toLocaleString('pt-BR')} → ${reqCur.toLocaleString('pt-BR')} requisições. Custo por req ${cprDeltaPct >= 0 ? 'também subiu' : 'caiu'} (${fmtPct(cprDeltaPct)}).`,
        tone: cprDeltaPct < 0 ? 'positive' : 'negative',
      });
    } else {
      causes.push({
        headline: 'Mistura de fatores',
        detail: `Volume ${fmtPct(reqDeltaPct)} e custo/req ${fmtPct(cprDeltaPct)} contribuíram juntos para a variação.`,
        tone: 'negative',
      });
    }
  } else if (cmp.deltaPct < -1) {
    causes.push({
      headline: `Custo caiu ${fmtPct(cmp.deltaPct)}`,
      detail: `Custo por requisição: ${fmtCost(costPerReqPrev)} → ${fmtCost(costPerReqCur)}. Volume: ${fmtPct(reqDeltaPct)}.`,
      tone: 'positive',
    });
  }

  // Token usage signal
  const tokensCur = tracesSplit.current.reduce((s, t) => s + Number(t.tokens_used ?? 0), 0);
  const tokensPrev = tracesSplit.previous.reduce((s, t) => s + Number(t.tokens_used ?? 0), 0);
  const tokensDelta = pctChange(tokensCur, tokensPrev);
  if (Math.abs(tokensDelta) > 10 && (tokensCur > 0 || tokensPrev > 0)) {
    causes.push({
      headline: `Consumo de tokens ${tokensDelta >= 0 ? 'aumentou' : 'reduziu'} ${fmtPct(tokensDelta)}`,
      detail: `${tokensPrev.toLocaleString('pt-BR')} → ${tokensCur.toLocaleString('pt-BR')} tokens. Costuma ser o principal vetor de custo em LLMs.`,
      tone: tokensDelta > 0 ? 'negative' : 'positive',
    });
  }

  // Spike days
  const spikes = spikeDays(split.current, (d) => d.cost);
  if (spikes.length > 0 && worsened) {
    causes.push({
      headline: 'Dias com custo anormal',
      detail: spikes.map((s) => `${s.label}: ${fmtCost(s.cost)}`).join(' · '),
      tone: 'negative',
    });
  }

  if (causes.length === 0) {
    causes.push({
      headline: 'Custo estável',
      detail: `Custo/req em ${fmtCost(costPerReqCur)}, volume ${fmtPct(reqDeltaPct)}.`,
      tone: 'neutral',
    });
  }

  return {
    key: 'cost',
    label: 'Custo',
    cmp,
    currentLabel: fmtCost(cmp.current),
    previousLabel: fmtCost(cmp.previous),
    causes,
    recommendation: worsened
      ? 'Considere revisar o modelo selecionado e reduzir contexto/prompt para economizar tokens.'
      : undefined,
  };
}

function buildRequestsInsight(
  cmp: KPIComparison,
  split: WindowSplit<DailyPoint>,
): KPIInsight {
  const causes: InsightCause[] = [];
  const grew = cmp.deltaPct > 1;

  // Identify if growth is concentrated in specific days
  const spikes = spikeDays(split.current, (d) => d.requests);
  if (spikes.length > 0) {
    causes.push({
      headline: grew ? 'Crescimento puxado por dias específicos' : 'Picos isolados no período',
      detail: spikes
        .map((s) => `${s.label}: ${s.requests.toLocaleString('pt-BR')} req`)
        .join(' · '),
      tone: grew ? 'positive' : 'neutral',
    });
  }

  // Day-of-week pattern (simplified: weekday vs weekend)
  const weekdaySum = split.current.reduce((s, d) => {
    const dt = new Date(`${d.date}T12:00:00`);
    const dow = dt.getDay();
    return dow >= 1 && dow <= 5 ? s + d.requests : s;
  }, 0);
  const weekendSum = split.current.reduce((s, d) => {
    const dt = new Date(`${d.date}T12:00:00`);
    const dow = dt.getDay();
    return dow === 0 || dow === 6 ? s + d.requests : s;
  }, 0);
  const weekdayDays = split.current.filter((d) => {
    const dow = new Date(`${d.date}T12:00:00`).getDay();
    return dow >= 1 && dow <= 5;
  }).length || 1;
  const weekendDays = split.current.filter((d) => {
    const dow = new Date(`${d.date}T12:00:00`).getDay();
    return dow === 0 || dow === 6;
  }).length || 1;
  const wdAvg = weekdaySum / weekdayDays;
  const weAvg = weekendSum / weekendDays;
  if (wdAvg > 0 && weAvg > 0 && Math.abs(wdAvg - weAvg) / Math.max(wdAvg, weAvg) > 0.3) {
    causes.push({
      headline: wdAvg > weAvg ? 'Padrão de dias úteis' : 'Padrão de fim de semana',
      detail: `Média em dias úteis ${Math.round(wdAvg).toLocaleString('pt-BR')} req · fim de semana ${Math.round(weAvg).toLocaleString('pt-BR')} req. ${wdAvg > weAvg ? 'Uso é predominantemente B2B/horário comercial.' : 'Uso pesa mais em fins de semana.'}`,
      tone: 'neutral',
    });
  }

  if (causes.length === 0) {
    causes.push({
      headline: grew ? 'Crescimento distribuído' : 'Volume estável',
      detail: grew
        ? 'O aumento de requisições está espalhado pelos dias, sem picos identificáveis.'
        : 'Volume diário próximo da média histórica.',
      tone: grew ? 'positive' : 'neutral',
    });
  }

  return {
    key: 'requests',
    label: 'Volume de requisições',
    cmp,
    currentLabel: Math.round(cmp.current).toLocaleString('pt-BR'),
    previousLabel: Math.round(cmp.previous).toLocaleString('pt-BR'),
    causes,
  };
}

export interface BuildKPIInsightsParams {
  daily: DailyPoint[];
  traces: AgentTrace[];
  cmps: {
    success: KPIComparison;
    latency: KPIComparison;
    cost: KPIComparison;
    requests: KPIComparison;
  };
  window?: number;
}

export function buildKPIInsights({
  daily,
  traces,
  cmps,
  window = 7,
}: BuildKPIInsightsParams): KPIInsight[] {
  const ds = splitDaily(daily, window);
  const ts = splitTraces(traces, window);
  return [
    buildSuccessInsight(cmps.success, ts),
    buildLatencyInsight(cmps.latency, ts, ds),
    buildCostInsight(cmps.cost, ds, ts),
    buildRequestsInsight(cmps.requests, ds),
  ];
}
