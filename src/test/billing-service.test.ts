import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
  },
}));

describe('billingService', () => {
  it('exports getUsageSummary', async () => {
    const { getUsageSummary } = await import('@/services/billingService');
    expect(getUsageSummary).toBeDefined();
    expect(typeof getUsageSummary).toBe('function');
  });

  it('exports checkBudgetStatus', async () => {
    const { checkBudgetStatus } = await import('@/services/billingService');
    expect(checkBudgetStatus).toBeDefined();
  });
});
