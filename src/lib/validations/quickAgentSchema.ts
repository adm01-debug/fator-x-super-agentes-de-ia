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

/** Minimum content depth per section (counted on the body BELOW its heading). */
export const SECTION_CONTENT_LIMITS = {
  MIN_WORDS: 8,
  MIN_NON_EMPTY_LINES: 1,
} as const;

export interface SectionContentReport {
  key: PromptSectionKey;
  label: string;
  present: boolean;
  /** Trimmed body text between this heading and the next heading (or EOF). */
  body: string;
  wordCount: number;
  nonEmptyLines: number;
  /** Reason it's considered too thin; null when OK. */
  thinReason: string | null;
}

/**
 * Splits the prompt by headings and returns a depth report per required section.
 * A section is considered "thin" when present but its body has too few words/lines,
 * is only the heading itself, or contains only placeholder content (… ... TODO etc).
 */
export function analyzeSectionContent(prompt: string): SectionContentReport[] {
  const lines = prompt.split('\n');

  // Find each heading line index + which section key it matches (if any).
  type HeadingHit = { lineIdx: number; key: PromptSectionKey | null };
  const headingHits: HeadingHit[] = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const norm = stripAccents(m[1]);
    const matched = REQUIRED_PROMPT_SECTIONS.find((sec) =>
      sec.aliases.some((a) => norm.includes(a)),
    );
    headingHits.push({ lineIdx: i, key: matched?.key ?? null });
  }

  const reports: SectionContentReport[] = [];

  for (const sec of REQUIRED_PROMPT_SECTIONS) {
    const hitIdx = headingHits.findIndex((h) => h.key === sec.key);
    if (hitIdx === -1) {
      reports.push({
        key: sec.key,
        label: sec.label,
        present: false,
        body: '',
        wordCount: 0,
        nonEmptyLines: 0,
        thinReason: 'Seção ausente',
      });
      continue;
    }

    const start = headingHits[hitIdx].lineIdx + 1;
    const end = hitIdx + 1 < headingHits.length ? headingHits[hitIdx + 1].lineIdx : lines.length;
    const bodyLines = lines.slice(start, end);
    const body = bodyLines.join('\n').trim();

    // Strip markdown bullets / ordering chars before counting words.
    const stripped = body
      .replace(/^[\s>*\-+]+/gm, '')
      .replace(/^\d+\.\s+/gm, '');
    const words = stripped.split(/\s+/).filter(Boolean);
    const nonEmptyLines = bodyLines.filter((l) => l.trim().length > 0).length;

    // Placeholder detection — single ellipsis lines, "TODO", "..." etc.
    const placeholderOnly =
      body.length > 0 &&
      stripped
        .replace(/[.…\-_*]/g, '')
        .replace(/\b(todo|tbd|fixme|exemplo|example)\b/gi, '')
        .trim().length === 0;

    let thinReason: string | null = null;
    if (body.length === 0) {
      thinReason = 'Sem conteúdo abaixo do heading';
    } else if (placeholderOnly) {
      thinReason = 'Apenas placeholder (… / TODO)';
    } else if (nonEmptyLines < SECTION_CONTENT_LIMITS.MIN_NON_EMPTY_LINES) {
      thinReason = `Adicione ao menos ${SECTION_CONTENT_LIMITS.MIN_NON_EMPTY_LINES} linha de conteúdo`;
    } else if (words.length < SECTION_CONTENT_LIMITS.MIN_WORDS) {
      thinReason = `Muito curto (${words.length}/${SECTION_CONTENT_LIMITS.MIN_WORDS} palavras)`;
    }

    reports.push({
      key: sec.key,
      label: sec.label,
      present: true,
      body,
      wordCount: words.length,
      nonEmptyLines,
      thinReason,
    });
  }

  return reports;
}

/** Sections that exist as headings but are too thin to count as real content. */
export function getThinSections(prompt: string): SectionContentReport[] {
  return analyzeSectionContent(prompt).filter((r) => r.present && r.thinReason !== null);
}

/**
 * Returns the 0-based line index of a section's heading in the prompt,
 * or -1 if no matching heading exists.
 */
export function findSectionLineIndex(prompt: string, key: PromptSectionKey): number {
  const lines = prompt.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^\s{0,3}#{1,3}\s+(.+?)\s*#*\s*$/);
    if (!m) continue;
    const norm = stripAccents(m[1]);
    const sec = REQUIRED_PROMPT_SECTIONS.find((s) => s.key === key);
    if (sec && sec.aliases.some((a) => norm.includes(a))) return i;
  }
  return -1;
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
      const thin = getThinSections(value);
      if (thin.length > 0) {
        const details = thin.map((t) => `${t.label} (${t.thinReason})`).join('; ');
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Conteúdo insuficiente em ${thin.length === 1 ? 'uma seção' : `${thin.length} seções`}: ${details}. Mínimo: ${SECTION_CONTENT_LIMITS.MIN_WORDS} palavras por seção.`,
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
