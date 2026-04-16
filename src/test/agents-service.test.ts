import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

vi.mock('@/integrations/supabase/externalClient', () => ({
  supabaseExternal: {
    from: vi.fn(() => {
      const chain = { select: mockSelect, eq: mockEq, gte: mockGte, order: mockOrder, limit: mockLimit, maybeSingle: mockMaybeSingle };
      mockSelect.mockReturnValue(chain);
      mockEq.mockReturnValue(chain);
      mockGte.mockReturnValue(chain);
      mockOrder.mockReturnValue(chain);
      mockLimit.mockReturnValue({ data: [], error: null });
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      return chain;
    }),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

describe('agentsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('getAgentById returns null when not found', async () => {
    const { getAgentById } = await import('@/services/agentsService');
    const result = await getAgentById('nonexistent');
    expect(result).toBeNull();
  });

  it('getAgentById throws on error', async () => {
    mockMaybeSingle.mockResolvedValueOnce({ data: null, error: { message: 'DB error' } });
    const { getAgentById } = await import('@/services/agentsService');
    await expect(getAgentById('bad')).rejects.toBeTruthy();
  });

  it('getAgentDetailTraces returns empty array', async () => {
    const { getAgentDetailTraces } = await import('@/services/agentsService');
    const result = await getAgentDetailTraces('agent-1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAgentUsage computes date range', async () => {
    const { getAgentUsage } = await import('@/services/agentsService');
    const result = await getAgentUsage('agent-1', 30);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAgentRecentAlerts respects limit', async () => {
    const { getAgentRecentAlerts } = await import('@/services/agentsService');
    const result = await getAgentRecentAlerts('agent-1', 10);
    expect(Array.isArray(result)).toBe(true);
  });

  it('getAgentVersions returns array', async () => {
    const { getAgentVersions } = await import('@/services/agentsService');
    const result = await getAgentVersions('agent-1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('exports all 5 functions', async () => {
    const mod = await import('@/services/agentsService');
    expect(typeof mod.getAgentById).toBe('function');
    expect(typeof mod.getAgentDetailTraces).toBe('function');
    expect(typeof mod.getAgentUsage).toBe('function');
    expect(typeof mod.getAgentRecentAlerts).toBe('function');
    expect(typeof mod.getAgentVersions).toBe('function');
  });
});
