import { describe, it, expect } from 'vitest';
import { AgentConfigSchema, ApiKeySchema, OracleQuerySchema, validateSafe } from '@/lib/validation';

describe('AgentConfigSchema', () => {
  it('validates a minimal valid config', () => {
    const result = validateSafe(AgentConfigSchema, {
      name: 'Test Agent',
      persona: 'assistant',
      model: 'claude-sonnet-4.6',
      reasoning: 'react',
      temperature: 30,
      top_p: 90,
      max_tokens: 40,
      retry_count: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty name', () => {
    const result = validateSafe(AgentConfigSchema, {
      name: '',
      persona: 'assistant',
      model: 'claude-sonnet-4.6',
      reasoning: 'react',
      temperature: 30,
      top_p: 90,
      max_tokens: 40,
      retry_count: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid model', () => {
    const result = validateSafe(AgentConfigSchema, {
      name: 'Test',
      persona: 'assistant',
      model: 'invalid-model',
      reasoning: 'react',
      temperature: 30,
      top_p: 90,
      max_tokens: 40,
      retry_count: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects temperature > 100', () => {
    const result = validateSafe(AgentConfigSchema, {
      name: 'Test',
      persona: 'assistant',
      model: 'claude-sonnet-4.6',
      reasoning: 'react',
      temperature: 150,
      top_p: 90,
      max_tokens: 40,
      retry_count: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe('ApiKeySchema', () => {
  it('validates a valid API key', () => {
    const result = validateSafe(ApiKeySchema, { key_name: 'anthropic', key_value: 'sk-ant-api03-xxxx' });
    expect(result.success).toBe(true);
  });

  it('rejects short key', () => {
    const result = validateSafe(ApiKeySchema, { key_name: 'openai', key_value: 'short' });
    expect(result.success).toBe(false);
  });
});

describe('OracleQuerySchema', () => {
  it('validates a valid query', () => {
    const result = validateSafe(OracleQuerySchema, { query: 'What is the best pricing strategy?', mode: 'council' });
    expect(result.success).toBe(true);
  });

  it('rejects too short query', () => {
    const result = validateSafe(OracleQuerySchema, { query: 'Hi' });
    expect(result.success).toBe(false);
  });
});
