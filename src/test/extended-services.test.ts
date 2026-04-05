import { describe, it, expect, vi } from 'vitest';

// Mock supabase client
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnValue({ data: [], error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockReturnValue({ data: null, error: null }),
        range: vi.fn().mockReturnValue({ data: [], error: null, count: 0 }),
        ilike: vi.fn().mockReturnValue({ data: [], error: null, count: 0 }),
      };
      Object.values(chain).forEach(fn => {
        if (!fn.getMockImplementation?.()) {
          fn.mockReturnValue(chain);
        }
      });
      chain.order.mockReturnValue({ ...chain, data: [], error: null });
      return chain;
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { access_token: 'test-token' } } }),
    },
    functions: {
      invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
    },
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

describe('Extended Service Layer Tests', () => {
  describe('llmGatewayService', () => {
    it('exports invokeLLMGateway', async () => {
      const { invokeLLMGateway } = await import('@/services/llmGatewayService');
      expect(typeof invokeLLMGateway).toBe('function');
    });

    it('exports invokeGuardrailsEngine', async () => {
      const { invokeGuardrailsEngine } = await import('@/services/llmGatewayService');
      expect(typeof invokeGuardrailsEngine).toBe('function');
    });

    it('exports invokeTestRunner', async () => {
      const { invokeTestRunner } = await import('@/services/llmGatewayService');
      expect(typeof invokeTestRunner).toBe('function');
    });

    it('exports invokeA2AServer', async () => {
      const { invokeA2AServer } = await import('@/services/llmGatewayService');
      expect(typeof invokeA2AServer).toBe('function');
    });

    it('exports invokeBitrix24Api and invokeBitrix24OAuth', async () => {
      const { invokeBitrix24Api, invokeBitrix24OAuth } = await import('@/services/llmGatewayService');
      expect(typeof invokeBitrix24Api).toBe('function');
      expect(typeof invokeBitrix24OAuth).toBe('function');
    });

    it('exports saveWorkspaceSecret and getMaskedSecrets', async () => {
      const { saveWorkspaceSecret, getMaskedSecrets } = await import('@/services/llmGatewayService');
      expect(typeof saveWorkspaceSecret).toBe('function');
      expect(typeof getMaskedSecrets).toBe('function');
    });
  });

  describe('lgpdService', () => {
    it('exports LGPD compliance functions', async () => {
      const mod = await import('@/services/lgpdService');
      expect(typeof mod.listConsentRecords).toBe('function');
      expect(typeof mod.manageConsent).toBe('function');
      expect(typeof mod.listDeletionRequests).toBe('function');
      expect(typeof mod.requestDeletion).toBe('function');
      expect(typeof mod.exportMyData).toBe('function');
    });
  });

  describe('approvalService', () => {
    it('exports approval queue functions', async () => {
      const mod = await import('@/services/approvalService');
      expect(typeof mod.listPendingApprovals).toBe('function');
      expect(typeof mod.approveWorkflowRun).toBe('function');
      expect(typeof mod.rejectWorkflowRun).toBe('function');
    });
  });

  describe('cerebroService', () => {
    it('exports brain and query invocations', async () => {
      const mod = await import('@/services/cerebroService');
      expect(typeof mod.invokeCerebroBrain).toBe('function');
      expect(typeof mod.invokeCerebroQuery).toBe('function');
    });
  });

  describe('datahubService', () => {
    it('exports datahub functions', async () => {
      const mod = await import('@/services/datahubService');
      expect(typeof mod.testDatahubConnections).toBe('function');
      expect(typeof mod.listDatahubEntities).toBe('function');
    });
  });

  describe('memoryService', () => {
    it('exports memory management functions', async () => {
      const mod = await import('@/services/memoryService');
      expect(typeof mod.listMemories).toBe('function');
      expect(typeof mod.addMemory).toBe('function');
      expect(typeof mod.forgetMemory).toBe('function');
      expect(typeof mod.searchMemory).toBe('function');
      expect(typeof mod.compactMemories).toBe('function');
    });
  });

  describe('workflowsService', () => {
    it('exports all workflow CRUD functions', async () => {
      const mod = await import('@/services/workflowsService');
      expect(typeof mod.listWorkflows).toBe('function');
      expect(typeof mod.getWorkflow).toBe('function');
      expect(typeof mod.saveWorkflow).toBe('function');
      expect(typeof mod.deleteWorkflow).toBe('function');
      expect(typeof mod.toggleWorkflowStatus).toBe('function');
      expect(typeof mod.duplicateWorkflow).toBe('function');
      expect(typeof mod.executeWorkflow).toBe('function');
      expect(typeof mod.listWorkflowRuns).toBe('function');
      expect(typeof mod.getWorkflowSteps).toBe('function');
    });
  });

  describe('teamsService', () => {
    it('exports team management functions', async () => {
      const mod = await import('@/services/teamsService');
      expect(typeof mod.listMembers).toBe('function');
      expect(typeof mod.inviteMember).toBe('function');
      expect(typeof mod.removeMember).toBe('function');
      expect(typeof mod.updateMemberRole).toBe('function');
      expect(typeof mod.insertWorkspaceMember).toBe('function');
    });
  });

  describe('agentEvolutionService', () => {
    it('exports evolution functions', async () => {
      const mod = await import('@/services/agentEvolutionService');
      expect(typeof mod.getSkillbook).toBe('function');
      expect(typeof mod.learnSkill).toBe('function');
      expect(typeof mod.updateSkillOutcome).toBe('function');
      expect(typeof mod.reflectOnTraces).toBe('function');
      expect(typeof mod.buildSkillbookPrompt).toBe('function');
    });
  });

  describe('skillsRegistryService', () => {
    it('exports registry functions', async () => {
      const mod = await import('@/services/skillsRegistryService');
      expect(typeof mod.listSkills).toBe('function');
      expect(typeof mod.installSkill).toBe('function');
      expect(typeof mod.getInstalledSkills).toBe('function');
      expect(typeof mod.uninstallSkill).toBe('function');
      expect(typeof mod.publishSkill).toBe('function');
      expect(mod.SKILL_CATEGORIES).toHaveLength(5);
    });
  });

  describe('contextTiersService', () => {
    it('exports tiered context functions', async () => {
      const mod = await import('@/services/contextTiersService');
      expect(typeof mod.searchL0).toBe('function');
      expect(typeof mod.loadL1).toBe('function');
      expect(typeof mod.loadL2).toBe('function');
      expect(typeof mod.tieredSearch).toBe('function');
      expect(typeof mod.generateTiers).toBe('function');
    });

    it('generateTiers produces L0 and L1', async () => {
      const { generateTiers } = await import('@/services/contextTiersService');
      const result = await generateTiers('This is a test sentence. Another sentence here. And a third one for good measure.');
      expect(result.l0).toBeTruthy();
      expect(result.l1).toBeTruthy();
      expect(result.l0.length).toBeLessThanOrEqual(200);
    });
  });
});
