import { describe, it, expect } from 'vitest';

describe('Context Tiers Service', () => {
  it('generates L0/L1 from content', async () => {
    const { generateTiers } = await import('@/services/contextTiersService');
    const content = 'OpenViking is a context database. It organizes memories hierarchically. The L0 layer provides abstracts.';
    const { l0, l1 } = await generateTiers(content);
    expect(l0.length).toBeGreaterThan(0);
    expect(l0.length).toBeLessThan(300);
    expect(l1.length).toBeGreaterThan(l0.length);
  });
});
