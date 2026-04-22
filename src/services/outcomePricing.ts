/**
 * Outcome-Based Pricing — `src/services/outcomePricing.ts`
 *
 * Modelo de cobrança por resultado, inspirado em Sierra AI (por
 * resolução) e Intercom Fin (US$0,99 / resolution). Define os
 * **eventos faturáveis** que um agente pode emitir e os transforma
 * em linhas de `billing_events` com unit price vigente.
 *
 * Diferente de seat-based, outcome-based alinha incentivo: cliente
 * só paga quando o agente entrega (cotação qualificada, pedido
 * fechado, deflexão de ticket).
 *
 * Contrato estável — o edge `billing-rollup` (ainda a criar) faz o
 * batch diário em `invoices`.
 */

export type OutcomeKind =
  | 'quote_qualified' // cotação qualificada gerada
  | 'order_closed' // pedido fechado (deal won)
  | 'support_resolution' // ticket resolvido sem humano
  | 'lead_qualified' // lead BANT aprovado
  | 'meeting_booked' // reunião agendada
  | 'handoff_avoided' // handoff humano evitado
  | 'escalation'; // (negativo) escalou → não fatura

export interface PricingTier {
  kind: OutcomeKind;
  unit_price_usd: number;
  min_volume_to_apply?: number;
  description: string;
}

export const DEFAULT_PRICING: Record<OutcomeKind, PricingTier> = {
  quote_qualified: {
    kind: 'quote_qualified',
    unit_price_usd: 0.5,
    description: 'Cotação com todos os campos obrigatórios preenchidos',
  },
  order_closed: {
    kind: 'order_closed',
    unit_price_usd: 2.5,
    description: 'Pedido aprovado pelo cliente (won)',
  },
  support_resolution: {
    kind: 'support_resolution',
    unit_price_usd: 0.99,
    description: 'Ticket resolvido sem escalar para humano',
  },
  lead_qualified: {
    kind: 'lead_qualified',
    unit_price_usd: 0.3,
    description: 'Lead aprovado em BANT/SPIN',
  },
  meeting_booked: {
    kind: 'meeting_booked',
    unit_price_usd: 1.5,
    description: 'Reunião de vendas agendada',
  },
  handoff_avoided: {
    kind: 'handoff_avoided',
    unit_price_usd: 0.2,
    description: 'Dúvida resolvida sem handoff humano',
  },
  escalation: {
    kind: 'escalation',
    unit_price_usd: 0, // não fatura
    description: 'Escalação humana (não faturável)',
  },
};

export interface OutcomeEvent {
  id: string;
  agent_id: string;
  workspace_id: string;
  kind: OutcomeKind;
  reference_id?: string; // ex: deal_id, ticket_id
  metadata?: Record<string, unknown>;
  occurred_at: string;
  billable: boolean;
  unit_price_usd: number;
}

export interface BillableLineItem {
  kind: OutcomeKind;
  count: number;
  unit_price_usd: number;
  subtotal_usd: number;
}

export interface BillingSummary {
  period: { from: string; to: string };
  agent_id?: string;
  workspace_id: string;
  lines: BillableLineItem[];
  total_usd: number;
}

/**
 * Normaliza um evento cru em `OutcomeEvent` aplicando a tabela de
 * pricing. Eventos desconhecidos viram não-billable.
 */
export function normalizeOutcome(
  raw: Omit<OutcomeEvent, 'billable' | 'unit_price_usd'>,
  pricing: Record<OutcomeKind, PricingTier> = DEFAULT_PRICING,
): OutcomeEvent {
  const tier = pricing[raw.kind];
  const price = tier?.unit_price_usd ?? 0;
  return {
    ...raw,
    billable: price > 0 && raw.kind !== 'escalation',
    unit_price_usd: price,
  };
}

/**
 * Agrega eventos por tipo no período e devolve um `BillingSummary`.
 * Input precisa já estar normalizado (billable flag + unit_price).
 */
export function rollupBilling(
  events: OutcomeEvent[],
  period: { from: string; to: string },
  workspaceId: string,
  agentId?: string,
): BillingSummary {
  const filtered = events.filter((e) => {
    if (e.workspace_id !== workspaceId) return false;
    if (agentId && e.agent_id !== agentId) return false;
    return e.occurred_at >= period.from && e.occurred_at <= period.to;
  });

  const byKind = new Map<OutcomeKind, { count: number; price: number }>();
  for (const ev of filtered) {
    if (!ev.billable) continue;
    const curr = byKind.get(ev.kind) ?? { count: 0, price: ev.unit_price_usd };
    byKind.set(ev.kind, { count: curr.count + 1, price: curr.price });
  }

  const lines: BillableLineItem[] = [];
  for (const [kind, { count, price }] of byKind.entries()) {
    lines.push({ kind, count, unit_price_usd: price, subtotal_usd: round4(count * price) });
  }
  lines.sort((a, b) => b.subtotal_usd - a.subtotal_usd);

  const total = lines.reduce((s, l) => s + l.subtotal_usd, 0);

  return {
    period,
    workspace_id: workspaceId,
    agent_id: agentId,
    lines,
    total_usd: round4(total),
  };
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
