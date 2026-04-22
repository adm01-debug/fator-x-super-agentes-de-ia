/**
 * agentTestSimulationService — gera uma simulação client-side de N execuções
 * do agente, derivando latência/custo/tokens das estatísticas reais dos traces.
 * Sem rede, sem custo de LLM real.
 */
import type { AgentDetail, AgentTrace } from '@/services/agentsService';
import { getModelPrice } from '@/lib/llmPricing';

export interface SimulatedRun {
  id: number;
  input: string;
  status: 'success' | 'error';
  latency_ms: number;
  tokens_used: number;
  cost_usd: number;
}

export interface SimulationSummary {
  runs: SimulatedRun[];
  total: number;
  passed: number;
  failed: number;
  successRate: number;     // %
  avgLatency: number;      // ms
  p95Latency: number;      // ms
  totalCost: number;       // USD
  totalTokens: number;
  model: string;
  generatedAt: string;
}

const MOCK_INPUTS = [
  'Olá, preciso de ajuda com um pedido',
  'Quanto custa o produto X em quantidades de 500 unidades?',
  'Pode me mandar um orçamento por favor?',
  'Qual o prazo de entrega para São Paulo?',
  'Vocês têm catálogo de canetas personalizadas?',
  'Quero comprar 1.000 squeezes com nossa logo',
  'Como funciona o pagamento parcelado?',
  'Qual a política de troca?',
];

function p95(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[Math.max(0, idx)];
}

function jitter(base: number, pct: number): number {
  const factor = 1 + (Math.random() * 2 - 1) * pct;
  return Math.max(0, base * factor);
}

export function simulateAgentRun(
  agent: Pick<AgentDetail, 'id' | 'name' | 'model'>,
  baseTraces: AgentTrace[],
  count = 10,
  options: { customInput?: string } = {},
): SimulationSummary {
  const customInput = options.customInput?.trim();
  const pricing = getModelPrice(agent.model ?? undefined);

  // Base estatística: usa traces reais se houver, senão defaults pelo modelo
  const realLatencies = baseTraces
    .map((t) => Number(t.latency_ms ?? 0))
    .filter((n) => n > 0);
  const realTokens = baseTraces
    .map((t) => Number(t.tokens_used ?? 0))
    .filter((n) => n > 0);
  const realErrors = baseTraces.filter((t) => t.level === 'error' || t.level === 'critical').length;

  const avgLatencyBase = realLatencies.length > 0
    ? realLatencies.reduce((a, b) => a + b, 0) / realLatencies.length
    : pricing.avg_latency_ms;
  const avgTokensBase = realTokens.length > 0
    ? realTokens.reduce((a, b) => a + b, 0) / realTokens.length
    : 1100;
  const errorRate = baseTraces.length > 0
    ? Math.min(0.25, Math.max(0.05, realErrors / baseTraces.length))
    : 0.08;

  const runs: SimulatedRun[] = [];
  for (let i = 0; i < count; i++) {
    const input = customInput && customInput.length > 0
      ? customInput
      : MOCK_INPUTS[i % MOCK_INPUTS.length];
    const isError = Math.random() < errorRate;
    const latency = Math.round(jitter(avgLatencyBase, 0.3));
    const tokens = isError ? 0 : Math.round(jitter(avgTokensBase, 0.2));
    // 60% input, 40% output (aprox)
    const inputTokens = Math.round(tokens * 0.6);
    const outputTokens = tokens - inputTokens;
    const cost = isError
      ? 0
      : (inputTokens / 1000) * pricing.input_per_1k + (outputTokens / 1000) * pricing.output_per_1k;

    runs.push({
      id: i + 1,
      input,
      status: isError ? 'error' : 'success',
      latency_ms: latency,
      tokens_used: tokens,
      cost_usd: cost,
    });
  }

  const passed = runs.filter((r) => r.status === 'success').length;
  const failed = runs.length - passed;
  const successRate = runs.length > 0 ? (passed / runs.length) * 100 : 0;
  const latencies = runs.map((r) => r.latency_ms).filter((n) => n > 0);
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : 0;
  const totalCost = runs.reduce((s, r) => s + r.cost_usd, 0);
  const totalTokens = runs.reduce((s, r) => s + r.tokens_used, 0);

  return {
    runs,
    total: runs.length,
    passed,
    failed,
    successRate,
    avgLatency,
    p95Latency: Math.round(p95(latencies)),
    totalCost,
    totalTokens,
    model: agent.model ?? pricing.label,
    generatedAt: new Date().toISOString(),
  };
}
