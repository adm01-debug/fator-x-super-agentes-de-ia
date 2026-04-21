import { z } from 'zod';

export const quickIdentitySchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Use 2 a 60 caracteres')
    .max(60, 'Use 2 a 60 caracteres')
    .regex(/^[\p{L}\p{N}\s\-_.]+$/u, 'Apenas letras, números, espaços, _ e -'),
  emoji: z
    .string()
    .trim()
    .min(1, 'Escolha um emoji')
    .max(4, 'Máximo 4 caracteres'),
  mission: z
    .string()
    .trim()
    .min(10, 'Mínimo 10 caracteres')
    .max(500, 'Máximo 500 caracteres'),
  description: z.string().trim().max(300, 'Máximo 300 caracteres').default(''),
});

export const quickTypeSchema = z.object({
  type: z.enum(
    ['chatbot', 'copilot', 'analyst', 'sdr', 'support', 'researcher', 'orchestrator'],
    { errorMap: () => ({ message: 'Selecione um tipo' }) },
  ),
});

export const quickModelSchema = z.object({
  model: z
    .string()
    .min(1, 'Selecione um modelo')
    .refine(
      (m) =>
        [
          'gpt-4o',
          'gpt-4-turbo',
          'claude-3.5-sonnet',
          'claude-3-opus',
          'gemini-1.5-pro',
          'llama-3-70b',
        ].includes(m),
      'Modelo inválido',
    ),
});

export const quickPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(50, 'Mínimo 50 caracteres')
    .max(8000, 'Máximo 8.000 caracteres'),
});

export const quickAgentFullSchema = quickIdentitySchema
  .merge(quickTypeSchema)
  .merge(quickModelSchema)
  .merge(quickPromptSchema);

export type QuickAgentForm = z.infer<typeof quickAgentFullSchema>;

export const QUICK_AGENT_DEFAULTS: QuickAgentForm = {
  name: '',
  emoji: '🤖',
  mission: '',
  description: '',
  type: 'chatbot',
  model: 'gpt-4o',
  prompt: '',
};

/**
 * Returns true if the form has any user-provided content beyond defaults.
 * Used to decide whether a saved draft is worth offering for recovery.
 */
export function isDraftMeaningful(form: Partial<QuickAgentForm> | null | undefined): boolean {
  if (!form) return false;
  const f = { ...QUICK_AGENT_DEFAULTS, ...form };
  return (
    f.name.trim().length > 0 ||
    f.mission.trim().length > 0 ||
    (f.description ?? '').trim().length > 0 ||
    f.prompt.trim().length > 0 ||
    f.emoji !== QUICK_AGENT_DEFAULTS.emoji ||
    f.type !== QUICK_AGENT_DEFAULTS.type ||
    f.model !== QUICK_AGENT_DEFAULTS.model
  );
}
