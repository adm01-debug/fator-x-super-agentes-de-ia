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

/**
 * Seções obrigatórias no system prompt do wizard rápido.
 * Detectadas via heading markdown (#, ##, ###) cujo título contém uma das aliases
 * (case-insensitive, sem acento).
 */
export const REQUIRED_PROMPT_SECTIONS = [
  { key: 'persona', label: 'Persona', aliases: ['persona', 'identidade', 'role', 'voce e', 'voce eh'] },
  { key: 'scope', label: 'Escopo', aliases: ['escopo', 'scope', 'objetivo', 'responsabilidade', 'metodo', 'fluxo'] },
  { key: 'format', label: 'Formato', aliases: ['formato', 'format', 'estilo', 'tom', 'output', 'saida'] },
  { key: 'rules', label: 'Regras', aliases: ['regras', 'rules', 'restricao', 'constraints', 'guardrails', 'nunca', 'sempre'] },
] as const;

export type PromptSectionKey = typeof REQUIRED_PROMPT_SECTIONS[number]['key'];

function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function extractHeadings(prompt: string): string[] {
  const out: string[] = [];
  for (const raw of prompt.split('\n')) {
    const m = raw.match(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/);
    if (m) out.push(stripAccents(m[1]));
  }
  return out;
}

/** Retorna { key: true|false } indicando quais seções foram detectadas. */
export function detectPromptSections(prompt: string): Record<PromptSectionKey, boolean> {
  const headings = extractHeadings(prompt);
  const result = {} as Record<PromptSectionKey, boolean>;
  for (const sec of REQUIRED_PROMPT_SECTIONS) {
    result[sec.key] = headings.some((h) => sec.aliases.some((a) => h.includes(a)));
  }
  return result;
}

export function getMissingSections(prompt: string): PromptSectionKey[] {
  const detected = detectPromptSections(prompt);
  return REQUIRED_PROMPT_SECTIONS.filter((s) => !detected[s.key]).map((s) => s.key);
}

import { analyzePromptStructure, PROMPT_LIMITS } from './promptSanitizer';

export const quickPromptSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(50, 'Mínimo 50 caracteres')
    .max(8000, 'Máximo 8.000 caracteres')
    .superRefine((value, ctx) => {
      const missing = getMissingSections(value);
      if (missing.length > 0) {
        const labels = missing
          .map((k) => REQUIRED_PROMPT_SECTIONS.find((s) => s.key === k)?.label ?? k)
          .join(', ');
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Faltam seções obrigatórias: ${labels}. Use headings markdown (## Persona, ## Escopo, ## Formato, ## Regras).`,
        });
      }
      const struct = analyzePromptStructure(value);
      if (struct.exceedsLineLimit) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Máximo ${PROMPT_LIMITS.MAX_LINES} linhas (atual: ${struct.lineCount}).`,
        });
      }
      if (struct.longLines.length > 0) {
        const first = struct.longLines[0];
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Linha ${first.line} excede ${PROMPT_LIMITS.MAX_LINE_LENGTH} caracteres (${first.length}). Quebre em parágrafos menores.`,
        });
      }
    }),
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
