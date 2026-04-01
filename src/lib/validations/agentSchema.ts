import { z } from 'zod';

// ═══ Enum Schemas ═══
export const agentLifecycleStageSchema = z.enum([
  'draft', 'configured', 'testing', 'staging',
  'review', 'production', 'monitoring', 'deprecated', 'archived',
]);

export const agentPersonaSchema = z.enum([
  'assistant', 'specialist', 'coordinator', 'analyst', 'creative', 'autonomous',
]);

export const llmModelSchema = z.enum([
  'claude-opus-4.6', 'claude-sonnet-4.6', 'claude-haiku-4.5',
  'gpt-4o', 'gemini-2.5-pro', 'llama-4', 'custom',
]);

export const reasoningPatternSchema = z.enum([
  'react', 'cot', 'tot', 'reflection', 'plan_execute',
]);

export const outputFormatSchema = z.enum(['text', 'json', 'markdown', 'structured']);
export const orchestrationPatternSchema = z.enum(['single', 'sequential', 'hierarchical', 'swarm']);
export const deployEnvironmentSchema = z.enum(['cloud_api', 'self_hosted', 'hybrid']);

// ═══ Agent Identity Validation ═══
export const agentIdentitySchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  mission: z.string().min(10, 'Missão deve ter pelo menos 10 caracteres').max(2000),
  persona: agentPersonaSchema,
  avatar_emoji: z.string().min(1).max(4),
  scope: z.string().max(2000).default(''),
  formality: z.number().min(0).max(100),
  proactivity: z.number().min(0).max(100),
  creativity: z.number().min(0).max(100),
  verbosity: z.number().min(0).max(100),
});

// ═══ Brain Config Validation ═══
export const agentBrainSchema = z.object({
  model: llmModelSchema,
  model_fallback: llmModelSchema.optional(),
  reasoning: reasoningPatternSchema,
  temperature: z.number().min(0).max(2),
  top_p: z.number().min(0).max(1),
  max_tokens: z.number().min(100).max(128000),
  retry_count: z.number().min(0).max(10),
});

// ═══ Guardrails Validation ═══
export const guardrailConfigSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(['input_validation', 'output_safety', 'access_control', 'operational']),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
  enabled: z.boolean(),
  severity: z.enum(['block', 'warn', 'log']),
  config: z.record(z.unknown()).optional(),
});

// ═══ Budget Validation ═══
export const budgetSchema = z.object({
  monthly_budget: z.number().min(0).max(100000).optional(),
  budget_alert_threshold: z.number().min(0).max(100),
  budget_kill_switch: z.boolean(),
});

// ═══ Full Agent Config (for save operations) ═══
export const agentSaveSchema = agentIdentitySchema.merge(agentBrainSchema).merge(budgetSchema).extend({
  status: agentLifecycleStageSchema,
  version: z.number().int().min(1),
  tags: z.array(z.string().max(50)).max(20),
  output_format: outputFormatSchema,
  orchestration_pattern: orchestrationPatternSchema,
  deploy_environment: deployEnvironmentSchema,
});

// ═══ Knowledge Base Validation ═══
export const knowledgeBaseSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  description: z.string().max(1000).default(''),
  vector_db: z.string().default('pgvector'),
  embedding_model: z.string().default('text-embedding-3-large'),
});

export type AgentIdentityInput = z.infer<typeof agentIdentitySchema>;
export type AgentBrainInput = z.infer<typeof agentBrainSchema>;
export type KnowledgeBaseInput = z.infer<typeof knowledgeBaseSchema>;
