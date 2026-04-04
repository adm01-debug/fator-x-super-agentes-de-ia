import { describe, it, expect } from 'vitest';
import {
  agentIdentitySchema,
  agentBrainSchema,
  knowledgeBaseSchema,
  budgetSchema,
  agentLifecycleStageSchema,
  memorySchema,
  workflowSchema,
  environmentSchema,
  alertRuleSchema,
  deletionRequestSchema,
  agentSaveSchema,
} from '@/lib/validations/agentSchema';

describe('agentIdentitySchema', () => {
  const valid = { name: 'Test Agent', mission: 'Help users with their questions about products', persona: 'assistant' as const, avatar_emoji: '🤖', scope: '', formality: 50, proactivity: 50, creativity: 50, verbosity: 50 };

  it('validates a correct identity', () => { expect(agentIdentitySchema.safeParse(valid).success).toBe(true); });
  it('rejects short name', () => { expect(agentIdentitySchema.safeParse({ ...valid, name: 'A' }).success).toBe(false); });
  it('rejects short mission', () => { expect(agentIdentitySchema.safeParse({ ...valid, mission: 'Help' }).success).toBe(false); });
  it('rejects invalid persona', () => { expect(agentIdentitySchema.safeParse({ ...valid, persona: 'hacker' }).success).toBe(false); });
  it('rejects formality out of range', () => { expect(agentIdentitySchema.safeParse({ ...valid, formality: 150 }).success).toBe(false); });
  it('rejects negative proactivity', () => { expect(agentIdentitySchema.safeParse({ ...valid, proactivity: -5 }).success).toBe(false); });
});

describe('agentBrainSchema', () => {
  const valid = { model: 'claude-sonnet-4.6' as const, reasoning: 'react' as const, temperature: 0.7, top_p: 0.9, max_tokens: 4000, retry_count: 3 };

  it('validates correct config', () => { expect(agentBrainSchema.safeParse(valid).success).toBe(true); });
  it('rejects temperature > 2', () => { expect(agentBrainSchema.safeParse({ ...valid, temperature: 3 }).success).toBe(false); });
  it('rejects invalid model', () => { expect(agentBrainSchema.safeParse({ ...valid, model: 'invalid' }).success).toBe(false); });
  it('rejects max_tokens < 100', () => { expect(agentBrainSchema.safeParse({ ...valid, max_tokens: 50 }).success).toBe(false); });
  it('rejects retry_count > 10', () => { expect(agentBrainSchema.safeParse({ ...valid, retry_count: 15 }).success).toBe(false); });
});

describe('knowledgeBaseSchema', () => {
  it('validates with defaults', () => {
    const r = knowledgeBaseSchema.safeParse({ name: 'Product Docs', description: 'Docs' });
    expect(r.success).toBe(true);
    if (r.success) { expect(r.data.vector_db).toBe('pgvector'); expect(r.data.embedding_model).toBe('text-embedding-3-large'); }
  });
  it('rejects short name', () => { expect(knowledgeBaseSchema.safeParse({ name: 'A' }).success).toBe(false); });
});

describe('budgetSchema', () => {
  it('validates correct budget', () => { expect(budgetSchema.safeParse({ monthly_budget: 500, budget_alert_threshold: 80, budget_kill_switch: true }).success).toBe(true); });
  it('rejects negative budget', () => { expect(budgetSchema.safeParse({ monthly_budget: -100, budget_alert_threshold: 80, budget_kill_switch: false }).success).toBe(false); });
  it('allows optional monthly_budget', () => { expect(budgetSchema.safeParse({ budget_alert_threshold: 80, budget_kill_switch: false }).success).toBe(true); });
  it('rejects threshold > 100', () => { expect(budgetSchema.safeParse({ budget_alert_threshold: 150, budget_kill_switch: false }).success).toBe(false); });
});

describe('agentLifecycleStageSchema', () => {
  it('accepts all valid stages', () => {
    for (const s of ['draft', 'configured', 'testing', 'staging', 'review', 'production', 'monitoring', 'deprecated', 'archived']) {
      expect(agentLifecycleStageSchema.safeParse(s).success).toBe(true);
    }
  });
  it('rejects invalid stage', () => { expect(agentLifecycleStageSchema.safeParse('invalid').success).toBe(false); });
});

describe('memorySchema', () => {
  it('accepts valid memory', () => { expect(memorySchema.safeParse({ content: 'Remember this fact', memory_type: 'semantic' }).success).toBe(true); });
  it('rejects empty content', () => { expect(memorySchema.safeParse({ content: '', memory_type: 'semantic' }).success).toBe(false); });
  it('rejects invalid memory_type', () => { expect(memorySchema.safeParse({ content: 'Test', memory_type: 'invalid' }).success).toBe(false); });
  it('accepts all valid types', () => {
    for (const t of ['short_term', 'episodic', 'semantic', 'user_profile', 'team', 'external']) {
      expect(memorySchema.safeParse({ content: 'Test', memory_type: t }).success).toBe(true);
    }
  });
});

describe('workflowSchema', () => {
  it('accepts valid workflow', () => { expect(workflowSchema.safeParse({ name: 'My Workflow', steps: ['step1', 'step2'] }).success).toBe(true); });
  it('rejects < 2 steps', () => { expect(workflowSchema.safeParse({ name: 'WF', steps: ['only_one'] }).success).toBe(false); });
  it('rejects empty steps', () => { expect(workflowSchema.safeParse({ name: 'WF', steps: [] }).success).toBe(false); });
});

describe('environmentSchema', () => {
  it('accepts valid name', () => { expect(environmentSchema.safeParse({ name: 'production' }).success).toBe(true); });
  it('accepts underscores/dashes', () => { expect(environmentSchema.safeParse({ name: 'my-env_01' }).success).toBe(true); });
  it('rejects spaces', () => { expect(environmentSchema.safeParse({ name: 'my env' }).success).toBe(false); });
  it('rejects empty', () => { expect(environmentSchema.safeParse({ name: '' }).success).toBe(false); });
});

describe('alertRuleSchema', () => {
  it('accepts valid alert', () => { expect(alertRuleSchema.safeParse({ name: 'High Latency', metric: 'latency_p99', operator: '>', threshold: 500, severity: 'warning' }).success).toBe(true); });
  it('rejects invalid operator', () => { expect(alertRuleSchema.safeParse({ name: 'X', metric: 'x', operator: '!=', threshold: 0, severity: 'info' }).success).toBe(false); });
  it('rejects negative threshold', () => { expect(alertRuleSchema.safeParse({ name: 'X', metric: 'x', operator: '>', threshold: -1, severity: 'info' }).success).toBe(false); });
});

describe('deletionRequestSchema', () => {
  it('accepts valid reason', () => { expect(deletionRequestSchema.safeParse({ reason: 'I want my data deleted' }).success).toBe(true); });
  it('rejects too short', () => { expect(deletionRequestSchema.safeParse({ reason: 'ok' }).success).toBe(false); });
});

describe('agentSaveSchema (full)', () => {
  const full = {
    name: 'Production Agent', mission: 'Handle customer queries efficiently',
    persona: 'specialist' as const, avatar_emoji: '🎯', scope: 'cs',
    formality: 70, proactivity: 60, creativity: 40, verbosity: 50,
    model: 'claude-sonnet-4.6' as const, reasoning: 'cot' as const, temperature: 0.5, top_p: 0.95, max_tokens: 8000, retry_count: 2,
    budget_alert_threshold: 80, budget_kill_switch: false,
    status: 'draft' as const, version: 1, tags: ['support'],
    output_format: 'markdown' as const, orchestration_pattern: 'single' as const, deploy_environment: 'cloud_api' as const,
  };
  it('accepts complete valid agent', () => { expect(agentSaveSchema.safeParse(full).success).toBe(true); });
  it('rejects invalid status', () => { expect(agentSaveSchema.safeParse({ ...full, status: 'unknown' }).success).toBe(false); });
  it('rejects too many tags', () => { expect(agentSaveSchema.safeParse({ ...full, tags: Array(25).fill('t') }).success).toBe(false); });
});
