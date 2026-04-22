import { describe, it, expect } from 'vitest';
import { lastNDays, startOfMonth, topN } from '@/services/costAttribution';

describe('costAttribution.lastNDays', () => {
  it('returns a window covering the last N days', () => {
    const w = lastNDays(30);
    const from = new Date(w.from).getTime();
    const to = new Date(w.to).getTime();
    expect(to - from).toBeGreaterThan(29 * 86_400_000);
    expect(to - from).toBeLessThan(31 * 86_400_000);
  });
});

describe('costAttribution.startOfMonth', () => {
  it('from is day 1 of current month at 00:00 local', () => {
    const w = startOfMonth();
    const from = new Date(w.from);
    expect(from.getDate()).toBe(1);
    expect(from.getHours()).toBe(0);
    expect(from.getMinutes()).toBe(0);
  });
});

describe('costAttribution.topN', () => {
  it('returns the top N agents by total_usd', () => {
    const summary = {
      window: startOfMonth(),
      total_usd: 100,
      by_agent: [
        {
          agent_id: 'a',
          agent_name: 'A',
          eval_cost_usd: 10,
          prod_cost_usd: 40,
          total_usd: 50,
          share_pct: 50,
        },
        {
          agent_id: 'b',
          agent_name: 'B',
          eval_cost_usd: 5,
          prod_cost_usd: 25,
          total_usd: 30,
          share_pct: 30,
        },
        {
          agent_id: 'c',
          agent_name: 'C',
          eval_cost_usd: 2,
          prod_cost_usd: 18,
          total_usd: 20,
          share_pct: 20,
        },
      ],
    };
    const top2 = topN(summary, 2);
    expect(top2.map((a) => a.agent_id)).toEqual(['a', 'b']);
  });
});
