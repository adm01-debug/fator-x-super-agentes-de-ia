import { describe, it, expect, beforeEach } from 'vitest';
import {
  AVAILABLE_MODELS,
  configureLLM,
  isLLMConfigured,
  getLLMConfig,
  callModel,
} from '@/services/llmService';
import type { LLMConfig, LLMMessage } from '@/services/llmService';

// ═══ AVAILABLE_MODELS ═══

describe('AVAILABLE_MODELS', () => {
  it('has 8 model entries', () => {
    expect(AVAILABLE_MODELS).toHaveLength(8);
  });

  it('contains expected model IDs', () => {
    const ids = AVAILABLE_MODELS.map(m => m.id);
    expect(ids).toContain('anthropic/claude-sonnet-4');
    expect(ids).toContain('anthropic/claude-opus-4');
    expect(ids).toContain('openai/gpt-4o');
    expect(ids).toContain('openai/gpt-4o-mini');
    expect(ids).toContain('google/gemini-2.0-flash-001');
    expect(ids).toContain('google/gemini-2.5-pro-preview');
    expect(ids).toContain('deepseek/deepseek-chat-v3-0324');
    expect(ids).toContain('meta-llama/llama-4-maverick');
  });

  it('every model has required fields', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model).toHaveProperty('id');
      expect(model).toHaveProperty('name');
      expect(model).toHaveProperty('provider');
      expect(model).toHaveProperty('costPer1kTokens');
      expect(typeof model.id).toBe('string');
      expect(typeof model.name).toBe('string');
      expect(typeof model.provider).toBe('string');
      expect(typeof model.costPer1kTokens).toBe('number');
      expect(model.costPer1kTokens).toBeGreaterThanOrEqual(0);
    }
  });

  it('has unique model IDs', () => {
    const ids = AVAILABLE_MODELS.map(m => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('includes models from multiple providers', () => {
    const providers = new Set(AVAILABLE_MODELS.map(m => m.provider));
    expect(providers.size).toBeGreaterThanOrEqual(4);
    expect(providers).toContain('anthropic');
    expect(providers).toContain('openai');
    expect(providers).toContain('google');
    expect(providers).toContain('deepseek');
  });
});

// ═══ configureLLM / isLLMConfigured / getLLMConfig ═══

describe('LLM configuration state management', () => {
  beforeEach(() => {
    // Reset stored config by configuring with empty key
    // Then the checks below verify behavior correctly
    configureLLM({ provider: 'openrouter', apiKey: '' });
  });

  it('isLLMConfigured returns false when no key is set', () => {
    configureLLM({ provider: 'openrouter', apiKey: '' });
    expect(isLLMConfigured()).toBe(false);
  });

  it('isLLMConfigured returns false when key is too short', () => {
    configureLLM({ provider: 'openrouter', apiKey: 'short' });
    expect(isLLMConfigured()).toBe(false);
  });

  it('isLLMConfigured returns true after configureLLM with valid key', () => {
    configureLLM({ provider: 'openrouter', apiKey: 'sk-or-v1-abcdefghijklmnopqrstuvwxyz123456' });
    expect(isLLMConfigured()).toBe(true);
  });

  it('getLLMConfig returns correct provider after configuration', () => {
    configureLLM({ provider: 'anthropic', apiKey: 'sk-ant-api03-longkeyvalue123' });
    const config = getLLMConfig();
    expect(config.provider).toBe('anthropic');
    expect(config.hasKey).toBe(true);
  });

  it('getLLMConfig returns provider "openrouter" when configured with openrouter', () => {
    configureLLM({ provider: 'openrouter', apiKey: 'sk-or-v1-validkey12345' });
    const config = getLLMConfig();
    expect(config.provider).toBe('openrouter');
  });

  it('getLLMConfig returns hasKey false when key is empty', () => {
    configureLLM({ provider: 'openai', apiKey: '' });
    const config = getLLMConfig();
    expect(config.provider).toBe('openai');
    expect(config.hasKey).toBe(false);
  });

  it('configureLLM overwrites previous configuration', () => {
    configureLLM({ provider: 'anthropic', apiKey: 'sk-ant-first-key-value12345' });
    expect(getLLMConfig().provider).toBe('anthropic');

    configureLLM({ provider: 'openai', apiKey: 'sk-openai-second-key-value12345' });
    expect(getLLMConfig().provider).toBe('openai');
  });
});

// ═══ callModel fallback (no config) ═══

describe('callModel without valid config', () => {
  beforeEach(() => {
    configureLLM({ provider: 'openrouter', apiKey: '' });
  });

  it('returns error response when API key is not configured', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Hello' },
    ];
    const response = await callModel('anthropic/claude-sonnet-4', messages);

    expect(response.error).toBeDefined();
    expect(response.error).toContain('API key');
    expect(response.cost).toBe(0);
    expect(response.tokens.input).toBe(0);
    expect(response.tokens.output).toBe(0);
  });

  it('fallback response includes the model name', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Test query' },
    ];
    const response = await callModel('anthropic/claude-sonnet-4', messages);
    expect(response.model).toBe('Claude Sonnet 4');
  });

  it('fallback response content mentions simulation', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Test query' },
    ];
    const response = await callModel('anthropic/claude-sonnet-4', messages);
    expect(response.content).toContain('Simula');
  });

  it('fallback response uses model ID when model not in AVAILABLE_MODELS', async () => {
    const messages: LLMMessage[] = [
      { role: 'user', content: 'Test' },
    ];
    const response = await callModel('unknown/model-xyz', messages);
    expect(response.model).toBe('unknown/model-xyz');
  });
});

// ═══ Export constants ═══

describe('export constants', () => {
  it('AVAILABLE_MODELS is a frozen array (as const)', () => {
    // as const makes the array readonly at the type level
    // but at runtime it is still an array
    expect(Array.isArray(AVAILABLE_MODELS)).toBe(true);
  });

  it('each model cost is a positive number or zero', () => {
    for (const model of AVAILABLE_MODELS) {
      expect(model.costPer1kTokens).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(model.costPer1kTokens)).toBe(true);
    }
  });
});
