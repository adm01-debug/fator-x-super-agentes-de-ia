/**
 * Rodada 8 — NICE-TO-HAVE: outcomePricing + a2aRegistry (partes puras).
 */
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PRICING,
  normalizeOutcome,
  rollupBilling,
  type OutcomeEvent,
} from '@/services/outcomePricing';

function ev(kind: OutcomeEvent['kind'], overrides: Partial<OutcomeEvent> = {}): OutcomeEvent {
  return normalizeOutcome({
    id: Math.random().toString(36).slice(2, 10),
    agent_id: 'a1',
    workspace_id: 'ws1',
    kind,
    occurred_at: new Date().toISOString(),
    ...overrides,
  });
}

describe('outcomePricing.normalizeOutcome', () => {
  it('applies unit_price from default tiers', () => {
    const o = ev('order_closed');
    expect(o.unit_price_usd).toBe(DEFAULT_PRICING.order_closed.unit_price_usd);
    expect(o.billable).toBe(true);
  });

  it('marks escalation as non-billable', () => {
    const o = ev('escalation');
    expect(o.billable).toBe(false);
    expect(o.unit_price_usd).toBe(0);
  });
});

describe('outcomePricing.rollupBilling', () => {
  const now = new Date();
  const from = new Date(now.getTime() - 86_400_000).toISOString();
  const to = new Date(now.getTime() + 86_400_000).toISOString();

  it('groups by kind and sums', () => {
    const events = [
      ev('order_closed'),
      ev('order_closed'),
      ev('quote_qualified'),
      ev('escalation'),
    ];
    const summary = rollupBilling(events, { from, to }, 'ws1');
    expect(summary.lines).toHaveLength(2); // escalation filtered out
    const orderLine = summary.lines.find((l) => l.kind === 'order_closed');
    expect(orderLine?.count).toBe(2);
    expect(summary.total_usd).toBeGreaterThan(0);
  });

  it('filters by workspace_id', () => {
    const events = [ev('order_closed', { workspace_id: 'ws2' })];
    const summary = rollupBilling(events, { from, to }, 'ws1');
    expect(summary.total_usd).toBe(0);
  });

  it('filters by agent_id when provided', () => {
    const events = [ev('order_closed', { agent_id: 'a1' }), ev('order_closed', { agent_id: 'a2' })];
    const summary = rollupBilling(events, { from, to }, 'ws1', 'a1');
    expect(summary.lines[0].count).toBe(1);
  });

  it('sorts lines by subtotal desc', () => {
    const events = [
      ev('lead_qualified'),
      ev('order_closed'),
      ev('order_closed'),
      ev('quote_qualified'),
    ];
    const summary = rollupBilling(events, { from, to }, 'ws1');
    for (let i = 1; i < summary.lines.length; i++) {
      expect(summary.lines[i - 1].subtotal_usd).toBeGreaterThanOrEqual(
        summary.lines[i].subtotal_usd,
      );
    }
  });
});
