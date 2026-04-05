import { describe, it, expect } from 'vitest';

describe('OTel GenAI Semantic Conventions', () => {
  it('creates attributes with correct keys', async () => {
    const { createGenAIAttributes, GEN_AI } = await import('@/lib/otel-genai');
    
    const attrs = createGenAIAttributes({
      system: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      inputTokens: 1000,
      outputTokens: 500,
      temperature: 0.7,
    });
    
    expect(attrs[GEN_AI.SYSTEM]).toBe('anthropic');
    expect(attrs[GEN_AI.REQUEST_MODEL]).toBe('claude-sonnet-4-20250514');
    expect(attrs[GEN_AI.USAGE_INPUT_TOKENS]).toBe(1000);
    expect(attrs[GEN_AI.USAGE_OUTPUT_TOKENS]).toBe(500);
    expect(attrs[GEN_AI.USAGE_TOTAL_TOKENS]).toBe(1500);
  });

  it('estimates cost for known models', async () => {
    const { estimateCost } = await import('@/lib/otel-genai');
    
    const cost = estimateCost('claude-sonnet-4-20250514', 1000, 500);
    expect(cost).toBeGreaterThan(0);
    expect(cost).toBeLessThan(1); // Should be fraction of a dollar for small usage
    
    // Opus should be more expensive
    const opusCost = estimateCost('claude-opus-4-6', 1000, 500);
    expect(opusCost).toBeGreaterThan(cost);
  });
});
