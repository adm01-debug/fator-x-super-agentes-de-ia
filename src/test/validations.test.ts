import { describe, it, expect } from 'vitest';
import {
  agentIdentitySchema,
  agentBrainSchema,
  knowledgeBaseSchema,
  budgetSchema,
  agentLifecycleStageSchema,
} from '@/lib/validations/agentSchema';

describe('agentIdentitySchema', () => {
  it('validates a correct identity', () => {
    const result = agentIdentitySchema.safeParse({
      name: 'Test Agent',
      mission: 'Help users with their questions about products',
      persona: 'assistant',
      avatar_emoji: '🤖',
      scope: '',
      formality: 50,
      proactivity: 50,
      creativity: 50,
      verbosity: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects short name', () => {
    const result = agentIdentitySchema.safeParse({
      name: 'A',
      mission: 'Help users with their questions about products',
      persona: 'assistant',
      avatar_emoji: '🤖',
      scope: '',
      formality: 50,
      proactivity: 50,
      creativity: 50,
      verbosity: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects short mission', () => {
    const result = agentIdentitySchema.safeParse({
      name: 'Test Agent',
      mission: 'Help',
      persona: 'assistant',
      avatar_emoji: '🤖',
      scope: '',
      formality: 50,
      proactivity: 50,
      creativity: 50,
      verbosity: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid persona', () => {
    const result = agentIdentitySchema.safeParse({
      name: 'Test Agent',
      mission: 'Help users with their questions about products',
      persona: 'invalid_persona',
      avatar_emoji: '🤖',
      scope: '',
      formality: 50,
      proactivity: 50,
      creativity: 50,
      verbosity: 50,
    });
    expect(result.success).toBe(false);
  });

  it('rejects formality out of range', () => {
    const result = agentIdentitySchema.safeParse({
      name: 'Test Agent',
      mission: 'Help users with their questions about products',
      persona: 'assistant',
      avatar_emoji: '🤖',
      scope: '',
      formality: 150,
      proactivity: 50,
      creativity: 50,
      verbosity: 50,
    });
    expect(result.success).toBe(false);
  });
});

describe('agentBrainSchema', () => {
  it('validates correct brain config', () => {
    const result = agentBrainSchema.safeParse({
      model: 'claude-sonnet-4.6',
      reasoning: 'react',
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4000,
      retry_count: 3,
    });
    expect(result.success).toBe(true);
  });

  it('rejects temperature above 2', () => {
    const result = agentBrainSchema.safeParse({
      model: 'claude-sonnet-4.6',
      reasoning: 'react',
      temperature: 3,
      top_p: 0.9,
      max_tokens: 4000,
      retry_count: 3,
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid model', () => {
    const result = agentBrainSchema.safeParse({
      model: 'invalid-model',
      reasoning: 'react',
      temperature: 0.7,
      top_p: 0.9,
      max_tokens: 4000,
      retry_count: 3,
    });
    expect(result.success).toBe(false);
  });
});

describe('knowledgeBaseSchema', () => {
  it('validates correct KB', () => {
    const result = knowledgeBaseSchema.safeParse({
      name: 'Product Docs',
      description: 'Documentation for all products',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.vector_db).toBe('pgvector');
      expect(result.data.embedding_model).toBe('text-embedding-3-large');
    }
  });

  it('rejects short name', () => {
    const result = knowledgeBaseSchema.safeParse({ name: 'A' });
    expect(result.success).toBe(false);
  });
});

describe('budgetSchema', () => {
  it('validates correct budget', () => {
    const result = budgetSchema.safeParse({
      monthly_budget: 500,
      budget_alert_threshold: 80,
      budget_kill_switch: true,
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative budget', () => {
    const result = budgetSchema.safeParse({
      monthly_budget: -100,
      budget_alert_threshold: 80,
      budget_kill_switch: false,
    });
    expect(result.success).toBe(false);
  });

  it('allows optional monthly_budget', () => {
    const result = budgetSchema.safeParse({
      budget_alert_threshold: 80,
      budget_kill_switch: false,
    });
    expect(result.success).toBe(true);
  });
});

describe('agentLifecycleStageSchema', () => {
  it('accepts all valid stages', () => {
    const stages = ['draft', 'configured', 'testing', 'staging', 'review', 'production', 'monitoring', 'deprecated', 'archived'];
    for (const stage of stages) {
      expect(agentLifecycleStageSchema.safeParse(stage).success).toBe(true);
    }
  });

  it('rejects invalid stage', () => {
    expect(agentLifecycleStageSchema.safeParse('invalid').success).toBe(false);
  });
});
