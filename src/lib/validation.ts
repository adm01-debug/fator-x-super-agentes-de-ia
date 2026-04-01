import { z } from 'zod';

/**
 * Zod validation schemas for server-side + client-side validation.
 * Single source of truth for data validation.
 */

// ═══ Agent Config Validation ═══

export const AgentConfigSchema = z.object({
  name: z.string().min(1, 'Nome é obrigatório').max(200),
  mission: z.string().max(2000).default(''),
  persona: z.enum(['assistant', 'specialist', 'coordinator', 'analyst', 'creative', 'autonomous']),
  model: z.enum(['claude-opus-4.6', 'claude-sonnet-4.6', 'claude-haiku-4.5', 'gpt-4o', 'gemini-2.5-pro', 'llama-4', 'custom']),
  reasoning: z.enum(['react', 'cot', 'tot', 'reflection', 'plan_execute']),
  temperature: z.number().min(0).max(100),
  top_p: z.number().min(0).max(100),
  max_tokens: z.number().min(1).max(200), // In thousands
  retry_count: z.number().min(0).max(10),
  system_prompt: z.string().max(100000).default(''),
  status: z.enum(['draft', 'configured', 'testing', 'staging', 'review', 'production', 'monitoring', 'deprecated', 'archived']).default('draft'),
  version: z.number().int().positive().default(1),
  avatar_emoji: z.string().max(10).default('🤖'),
  scope: z.string().max(5000).default(''),
  formality: z.number().min(0).max(100).default(50),
  proactivity: z.number().min(0).max(100).default(70),
  creativity: z.number().min(0).max(100).default(40),
  verbosity: z.number().min(0).max(100).default(50),
});

export type ValidatedAgentConfig = z.infer<typeof AgentConfigSchema>;

// ═══ API Key Validation ═══

export const ApiKeySchema = z.object({
  key_name: z.enum(['anthropic', 'openai', 'openrouter', 'google', 'embedding']),
  key_value: z.string().min(10, 'API key muito curta').max(500),
});

// ═══ Oracle Query Validation ═══

export const OracleQuerySchema = z.object({
  query: z.string().min(5, 'Pergunta muito curta').max(10000),
  preset_id: z.string().uuid().optional(),
  mode: z.enum(['council', 'researcher', 'validator', 'executor', 'advisor']).default('council'),
});

// ═══ Workspace Validation ═══

export const WorkspaceSchema = z.object({
  name: z.string().min(1).max(100),
  plan: z.enum(['free', 'pro', 'enterprise']).default('free'),
});

// ═══ Helper: validate and return clean data or throw ═══

export function validate<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

export function validateSafe<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error };
}
