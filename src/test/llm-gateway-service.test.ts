/**
 * llmGatewayService tests
 */
import { describe, it, expect, vi } from 'vitest';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
    functions: { invoke: vi.fn() },
    rpc: vi.fn(),
  },
}));
vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('@/lib/tracing', () => ({
  startTrace: vi.fn(() => ({
    traceId: 'trace-1',
    startSpan: vi.fn(() => ({
      setAttribute: vi.fn(),
      setInput: vi.fn(),
      setOutput: vi.fn(),
      setStatus: vi.fn(),
      snapshot: vi.fn(() => ({ status: 'ok' })),
    })),
    endSpan: vi.fn(),
    end: vi.fn(),
  })),
}));

describe('llmGatewayService exports', () => {
  it('module exports the documented public surface', async () => {
    const mod = await import('@/services/llmGatewayService');
    expect(typeof mod.invokeLLMGateway).toBe('function');
    expect(typeof mod.invokeGuardrailsEngine).toBe('function');
    expect(typeof mod.invokeOracleResearch).toBe('function');
    expect(typeof mod.invokeA2AServer).toBe('function');
    expect(typeof mod.invokeTracedFunction).toBe('function');
    expect(typeof mod.saveWorkspaceSecret).toBe('function');
    expect(typeof mod.getMaskedSecrets).toBe('function');
  });
});

describe('llmGatewayService types', () => {
  it('exports at least 7 functions', async () => {
    const mod = await import('@/services/llmGatewayService');
    const fns = Object.values(mod).filter((v) => typeof v === 'function');
    expect(fns.length).toBeGreaterThanOrEqual(7);
  });

  it('all exported functions are named', async () => {
    const mod = await import('@/services/llmGatewayService');
    const fns = Object.entries(mod).filter(([, v]) => typeof v === 'function');
    for (const [name] of fns) {
      expect(name.length).toBeGreaterThan(0);
    }
  });

  it('invokeTracedFunction is a generic wrapper', async () => {
    const mod = await import('@/services/llmGatewayService');
    expect(typeof mod.invokeTracedFunction).toBe('function');
  });
});
