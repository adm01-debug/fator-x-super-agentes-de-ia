import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInvoke = vi.fn().mockResolvedValue({
  data: { allowed: true, direction: 'input', results: [], blocked_count: 0, version: '2.2' },
  error: null,
});

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn(), warn: vi.fn() } }));

describe('guardrailsMLService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('checkInput returns guardrail response', async () => {
    const { checkInput } = await import('@/services/guardrailsMLService');
    const result = await checkInput('normal text');
    expect(result.allowed).toBe(true);
    expect(result.direction).toBe('input');
  });

  it('checkOutput returns guardrail response', async () => {
    mockInvoke.mockResolvedValueOnce({
      data: { allowed: false, direction: 'output', results: [{ passed: false, layer: 'pii', score: 0.9, details: 'PII detected' }], blocked_count: 1, version: '2.2' },
      error: null,
    });
    const { checkOutput } = await import('@/services/guardrailsMLService');
    const result = await checkOutput('John Doe CPF 123.456.789-00');
    expect(result.allowed).toBe(false);
    expect(result.blocked_count).toBe(1);
  });

  it('isTextSafe returns boolean', async () => {
    const { isTextSafe } = await import('@/services/guardrailsMLService');
    const result = await isTextSafe('safe text');
    expect(typeof result).toBe('boolean');
    expect(result).toBe(true);
  });

  it('throws on edge function error', async () => {
    mockInvoke.mockResolvedValueOnce({ data: null, error: { message: 'fail' } });
    const { checkInput } = await import('@/services/guardrailsMLService');
    await expect(checkInput('test')).rejects.toThrow('Guardrails error');
  });
});
