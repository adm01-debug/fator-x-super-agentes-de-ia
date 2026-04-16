import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn().mockResolvedValue({ data: { content: 'response', usage: { input_tokens: 10, output_tokens: 20 } }, error: null });

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

vi.mock('@/integrations/supabase/externalClient', () => ({
  supabaseExternal: {
    from: vi.fn(() => {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue({ error: null }),
      };
      Object.values(chain).forEach(fn => fn.mockReturnValue(chain));
      chain.eq.mockReturnValue({ error: null });
      chain.insert.mockReturnValue({ error: null });
      return chain;
    }),
    rpc: vi.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/tracing', () => ({
  startTrace: () => ({
    traceId: 'trace-1',
    startSpan: () => ({
      setAttribute: vi.fn(),
      setInput: vi.fn(),
      setOutput: vi.fn(),
      setStatus: vi.fn(),
      snapshot: () => ({ status: 'ok' }),
    }),
    endSpan: vi.fn(),
    end: vi.fn(),
  }),
}));

describe('llmGatewayService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('invokeLLMGateway calls llm-gateway', async () => {
    const { invokeLLMGateway } = await import('@/services/llmGatewayService');
    const result = await invokeLLMGateway({ model: 'test', messages: [{ role: 'user', content: 'hi' }] });
    expect(result).toHaveProperty('content');
    expect(mockInvoke).toHaveBeenCalledWith('llm-gateway', expect.any(Object));
  });

  it('invokeGuardrailsEngine calls guardrails-engine', async () => {
    const { invokeGuardrailsEngine } = await import('@/services/llmGatewayService');
    await invokeGuardrailsEngine({ text: 'test' });
    expect(mockInvoke).toHaveBeenCalledWith('guardrails-engine', expect.any(Object));
  });

  it('invokeTestRunner calls test-runner', async () => {
    const { invokeTestRunner } = await import('@/services/llmGatewayService');
    await invokeTestRunner({ test_cases: [] });
    expect(mockInvoke).toHaveBeenCalledWith('test-runner', expect.any(Object));
  });

  it('invokeOracleResearch calls oracle-research', async () => {
    const { invokeOracleResearch } = await import('@/services/llmGatewayService');
    await invokeOracleResearch({ query: 'test' });
    expect(mockInvoke).toHaveBeenCalledWith('oracle-research', expect.any(Object));
  });

  it('getMaskedSecrets calls RPC', async () => {
    const { getMaskedSecrets } = await import('@/services/llmGatewayService');
    const result = await getMaskedSecrets('ws-1');
    expect(Array.isArray(result)).toBe(true);
  });

  it('throws on invoke error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'gateway error' } });
    const { invokeLLMGateway } = await import('@/services/llmGatewayService');
    await expect(invokeLLMGateway({ model: 'x', messages: [] })).rejects.toBeTruthy();
  });
});
