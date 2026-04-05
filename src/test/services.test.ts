import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockGte = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

const chainMock = () => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
  eq: mockEq,
  in: mockIn,
  gte: mockGte,
  order: mockOrder,
  limit: mockLimit,
  maybeSingle: mockMaybeSingle,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: (...args: unknown[]) => {
      mockFrom(...args);
      const chain = chainMock();
      // Make all methods return the chain for chaining
      Object.values(chain).forEach(fn => {
        (fn as ReturnType<typeof vi.fn>).mockReturnValue(chain);
      });
      // Terminal methods return promises
      chain.order.mockReturnValue({ ...chain, data: [], error: null });
      chain.limit.mockReturnValue({ data: [], error: null });
      chain.maybeSingle.mockReturnValue({ data: null, error: null });
      return chain;
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
    },
  },
}));

describe('Service Layer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('knowledgeService', () => {
    it('exports listKnowledgeBases', async () => {
      const { listKnowledgeBases } = await import('@/services/knowledgeService');
      expect(typeof listKnowledgeBases).toBe('function');
    });

    it('exports deleteKnowledgeBase', async () => {
      const { deleteKnowledgeBase } = await import('@/services/knowledgeService');
      expect(typeof deleteKnowledgeBase).toBe('function');
    });

    it('exports listVectorIndexes', async () => {
      const { listVectorIndexes } = await import('@/services/knowledgeService');
      expect(typeof listVectorIndexes).toBe('function');
    });

    it('exports getChunkEmbeddingStats', async () => {
      const { getChunkEmbeddingStats } = await import('@/services/knowledgeService');
      expect(typeof getChunkEmbeddingStats).toBe('function');
    });
  });

  describe('evaluationsService', () => {
    it('exports listEvaluationRuns', async () => {
      const { listEvaluationRuns } = await import('@/services/evaluationsService');
      expect(typeof listEvaluationRuns).toBe('function');
    });

    it('exports listEvaluationDatasets', async () => {
      const { listEvaluationDatasets } = await import('@/services/evaluationsService');
      expect(typeof listEvaluationDatasets).toBe('function');
    });

    it('exports listTestCases', async () => {
      const { listTestCases } = await import('@/services/evaluationsService');
      expect(typeof listTestCases).toBe('function');
    });
  });

  describe('deploymentsService', () => {
    it('exports listDeployedAgents', async () => {
      const { listDeployedAgents } = await import('@/services/deploymentsService');
      expect(typeof listDeployedAgents).toBe('function');
    });

    it('exports getApiEndpoint', async () => {
      const { getApiEndpoint } = await import('@/services/deploymentsService');
      expect(typeof getApiEndpoint).toBe('function');
      const endpoint = getApiEndpoint('test-agent');
      expect(endpoint).toContain('/functions/v1/widget-proxy/chat');
    });
  });

  describe('securityService', () => {
    it('exports listApiKeys', async () => {
      const { listApiKeys } = await import('@/services/securityService');
      expect(typeof listApiKeys).toBe('function');
    });

    it('exports createApiKey', async () => {
      const { createApiKey } = await import('@/services/securityService');
      expect(typeof createApiKey).toBe('function');
    });

    it('exports revokeApiKey', async () => {
      const { revokeApiKey } = await import('@/services/securityService');
      expect(typeof revokeApiKey).toBe('function');
    });

    it('exports getAuditLog', async () => {
      const { getAuditLog } = await import('@/services/securityService');
      expect(typeof getAuditLog).toBe('function');
    });
  });

  describe('billingService', () => {
    it('exports getAgentUsage', async () => {
      const { getAgentUsage } = await import('@/services/billingService');
      expect(typeof getAgentUsage).toBe('function');
    });

    it('exports listBudgets', async () => {
      const { listBudgets } = await import('@/services/billingService');
      expect(typeof listBudgets).toBe('function');
    });

    it('exports getModelPricing', async () => {
      const { getModelPricing } = await import('@/services/billingService');
      expect(typeof getModelPricing).toBe('function');
    });
  });

  describe('monitoringService', () => {
    it('exports getAgentTraces', async () => {
      const { getAgentTraces } = await import('@/services/monitoringService');
      expect(typeof getAgentTraces).toBe('function');
    });

    it('exports getSessions', async () => {
      const { getSessions } = await import('@/services/monitoringService');
      expect(typeof getSessions).toBe('function');
    });

    it('exports getDashboardMetrics', async () => {
      const { getDashboardMetrics } = await import('@/services/monitoringService');
      expect(typeof getDashboardMetrics).toBe('function');
    });
  });
});
