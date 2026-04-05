import { describe, it, expect } from 'vitest';
import {
  inviteMemberSchema,
  createKnowledgeBaseSchema,
  editKnowledgeBaseSchema,
  createEvaluationSchema,
  createPromptSchema,
} from '@/lib/validations/dialogSchemas';

describe('inviteMemberSchema', () => {
  it('accepts valid input', () => {
    expect(inviteMemberSchema.safeParse({ email: 'a@b.com', role: 'editor' }).success).toBe(true);
  });
  it('rejects empty email', () => {
    expect(inviteMemberSchema.safeParse({ email: '', role: 'editor' }).success).toBe(false);
  });
  it('rejects invalid email', () => {
    expect(inviteMemberSchema.safeParse({ email: 'notanemail', role: 'editor' }).success).toBe(false);
  });
  it('rejects invalid role', () => {
    expect(inviteMemberSchema.safeParse({ email: 'a@b.com', role: 'superadmin' }).success).toBe(false);
  });
  it('trims email whitespace', () => {
    const r = inviteMemberSchema.parse({ email: '  a@b.com  ', role: 'admin' });
    expect(r.email).toBe('a@b.com');
  });
  it('rejects email over 255 chars', () => {
    expect(inviteMemberSchema.safeParse({ email: 'a'.repeat(250) + '@b.com', role: 'editor' }).success).toBe(false);
  });
});

describe('createKnowledgeBaseSchema', () => {
  it('accepts valid input', () => {
    expect(createKnowledgeBaseSchema.safeParse({
      name: 'Test KB', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-large',
    }).success).toBe(true);
  });
  it('rejects empty name', () => {
    expect(createKnowledgeBaseSchema.safeParse({
      name: '', vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-large',
    }).success).toBe(false);
  });
  it('rejects name over 200 chars', () => {
    expect(createKnowledgeBaseSchema.safeParse({
      name: 'x'.repeat(201), vectorDb: 'pgvector', embeddingModel: 'text-embedding-3-large',
    }).success).toBe(false);
  });
});

describe('editKnowledgeBaseSchema', () => {
  it('accepts valid input', () => {
    expect(editKnowledgeBaseSchema.safeParse({
      name: 'Updated', embeddingModel: 'text-embedding-3-small', status: 'active',
    }).success).toBe(true);
  });
  it('rejects invalid status', () => {
    expect(editKnowledgeBaseSchema.safeParse({
      name: 'x', embeddingModel: 'text-embedding-3-large', status: 'deleted',
    }).success).toBe(false);
  });
});

describe('createEvaluationSchema', () => {
  const valid = {
    name: 'Eval', agentId: '00000000-0000-0000-0000-000000000001',
    testCases: 5, useJudge: false, judgeMode: 'pointwise' as const,
  };
  it('accepts valid input', () => {
    expect(createEvaluationSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects non-uuid agentId', () => {
    expect(createEvaluationSchema.safeParse({ ...valid, agentId: 'bad' }).success).toBe(false);
  });
  it('rejects testCases > 100', () => {
    expect(createEvaluationSchema.safeParse({ ...valid, testCases: 101 }).success).toBe(false);
  });
  it('coerces string testCases to number', () => {
    const r = createEvaluationSchema.parse({ ...valid, testCases: '10' });
    expect(r.testCases).toBe(10);
  });
});

describe('createPromptSchema', () => {
  const valid = {
    agentId: '00000000-0000-0000-0000-000000000001',
    content: 'You are a helpful assistant.',
  };
  it('accepts valid input', () => {
    expect(createPromptSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects empty content', () => {
    expect(createPromptSchema.safeParse({ ...valid, content: '' }).success).toBe(false);
  });
  it('rejects non-uuid agentId', () => {
    expect(createPromptSchema.safeParse({ ...valid, agentId: 'x' }).success).toBe(false);
  });
  it('rejects content over 50000 chars', () => {
    expect(createPromptSchema.safeParse({ ...valid, content: 'x'.repeat(50001) }).success).toBe(false);
  });
});
