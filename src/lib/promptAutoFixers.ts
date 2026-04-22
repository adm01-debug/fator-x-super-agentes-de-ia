/**
 * Pure auto-fixers for the system prompt editor.
 * Each function takes a prompt string and returns a {@link FixResult}
 * describing what changed — never throws, never mutates input.
 *
 * Used by `PromptAutoFixPanel` to surface 1-click corrections with diff preview.
 */
import { PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';

const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/g;
const DANGEROUS_TAGS_RE = /<\/?\s*(script|iframe|object|embed|style|link|meta)\b[^>]*>/gi;
const JS_URI_RE = /javascript\s*:/gi;

export type FixerId = 'invisible' | 'empty' | 'longLines' | 'truncate';

export interface FixResult {
  id: FixerId;
  fixed: string;
  removedChars: number;
  removedLines: number;
  /** 1-indexed line numbers in the ORIGINAL text that were modified. */
  affectedLines: number[];
  /** Short PT-BR description of the impact, ready to show in a chip. */
  description: string;
  /** Long-form summary suitable for toast `success` body. */
  summary: string;
}

function emptyResult(id: FixerId, prompt: string): FixResult {
  return {
    id,
    fixed: prompt,
    removedChars: 0,
    removedLines: 0,
    affectedLines: [],
    description: 'sem alterações',
    summary: 'Nenhuma alteração necessária.',
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 1. Invisible / dangerous chars
// ──────────────────────────────────────────────────────────────────────────
export function fixInvisibleChars(prompt: string): FixResult {
  const ctrl = prompt.match(CONTROL_CHARS_RE)?.length ?? 0;
  const zw = prompt.match(ZERO_WIDTH_RE)?.length ?? 0;
  const tags = prompt.match(DANGEROUS_TAGS_RE)?.length ?? 0;
  const jsuri = prompt.match(JS_URI_RE)?.length ?? 0;
  const total = ctrl + zw + tags + jsuri;
  if (total === 0) return emptyResult('invisible', prompt);

  // Track which lines contain offenders before we strip them.
  const lines = prompt.split('\n');
  const affectedLines: number[] = [];
  lines.forEach((line, i) => {
    if (
      CONTROL_CHARS_RE.test(line) ||
      ZERO_WIDTH_RE.test(line) ||
      DANGEROUS_TAGS_RE.test(line) ||
      JS_URI_RE.test(line)
    ) {
      affectedLines.push(i + 1);
    }
    // Reset stateful regex flags
    CONTROL_CHARS_RE.lastIndex = 0;
    ZERO_WIDTH_RE.lastIndex = 0;
    DANGEROUS_TAGS_RE.lastIndex = 0;
    JS_URI_RE.lastIndex = 0;
  });

  const fixed = prompt
    .replace(CONTROL_CHARS_RE, '')
    .replace(ZERO_WIDTH_RE, '')
    .replace(DANGEROUS_TAGS_RE, '')
    .replace(JS_URI_RE, '');

  const removedChars = prompt.length - fixed.length;
  const parts: string[] = [];
  if (ctrl > 0) parts.push(`${ctrl} de controle`);
  if (zw > 0) parts.push(`${zw} zero-width`);
  if (tags > 0) parts.push(`${tags} tag${tags > 1 ? 's' : ''} HTML`);
  if (jsuri > 0) parts.push(`${jsuri} javascript:`);

  return {
    id: 'invisible',
    fixed,
    removedChars,
    removedLines: 0,
    affectedLines,
    description: `−${removedChars.toLocaleString('pt-BR')} chars invisíveis`,
    summary: `Removidos ${total} caracteres/tags inválidos (${parts.join(', ')}).`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 2. Compact empty blocks (>MAX_EMPTY_BLOCK consecutive blank lines)
// ──────────────────────────────────────────────────────────────────────────
export function fixEmptyBlocks(prompt: string): FixResult {
  const lines = prompt.split('\n');
  const max = PROMPT_LIMITS.MAX_EMPTY_BLOCK;
  const out: string[] = [];
  const affectedLines: number[] = [];
  let run = 0;

  lines.forEach((line, i) => {
    if (line.trim().length === 0) {
      run++;
      if (run <= max) {
        out.push(line);
      } else {
        affectedLines.push(i + 1);
      }
    } else {
      run = 0;
      out.push(line);
    }
  });

  const removedLines = lines.length - out.length;
  if (removedLines === 0) return emptyResult('empty', prompt);

  const fixed = out.join('\n');
  return {
    id: 'empty',
    fixed,
    removedChars: prompt.length - fixed.length,
    removedLines,
    affectedLines,
    description: `−${removedLines} linha${removedLines > 1 ? 's' : ''} em branco`,
    summary: `Compactadas ${removedLines} linha(s) em branco excedentes (mantém no máximo ${max} consecutivas).`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 3. Break long lines at MAX_LINE_LENGTH
// ──────────────────────────────────────────────────────────────────────────
export function fixLongLines(prompt: string): FixResult {
  const lines = prompt.split('\n');
  const max = PROMPT_LIMITS.MAX_LINE_LENGTH;
  const out: string[] = [];
  const affectedLines: number[] = [];

  lines.forEach((line, i) => {
    if (line.length <= max) {
      out.push(line);
      return;
    }
    affectedLines.push(i + 1);
    let remaining = line;
    while (remaining.length > max) {
      // Break at the last space before max; fallback to hard break.
      const slice = remaining.slice(0, max);
      const lastSpace = slice.lastIndexOf(' ');
      const breakAt = lastSpace > max * 0.6 ? lastSpace : max;
      out.push(remaining.slice(0, breakAt).trimEnd());
      remaining = remaining.slice(breakAt).trimStart();
    }
    if (remaining.length > 0) out.push(remaining);
  });

  if (affectedLines.length === 0) return emptyResult('longLines', prompt);

  const fixed = out.join('\n');
  return {
    id: 'longLines',
    fixed,
    removedChars: 0, // no chars removed, just reflowed
    removedLines: -(out.length - lines.length),
    affectedLines,
    description: `${affectedLines.length} linha${affectedLines.length > 1 ? 's' : ''} quebrada${affectedLines.length > 1 ? 's' : ''}`,
    summary: `Quebradas ${affectedLines.length} linha(s) que excediam ${max} caracteres.`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// 4. Truncate to MAX_TOTAL chars
// ──────────────────────────────────────────────────────────────────────────
export function fixExceedsCharLimit(prompt: string): FixResult {
  const max = PROMPT_LIMITS.MAX_TOTAL;
  if (prompt.length <= max) return emptyResult('truncate', prompt);

  const fixed = prompt.slice(0, max);
  const removedChars = prompt.length - fixed.length;
  const truncatedFromLine = fixed.split('\n').length;

  return {
    id: 'truncate',
    fixed,
    removedChars,
    removedLines: prompt.split('\n').length - truncatedFromLine,
    affectedLines: [truncatedFromLine],
    description: `−${removedChars.toLocaleString('pt-BR')} chars do final`,
    summary: `Truncados ${removedChars.toLocaleString('pt-BR')} caracteres do final do prompt para caber no limite (${max.toLocaleString('pt-BR')}).`,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Pipeline: apply in safe order
// ──────────────────────────────────────────────────────────────────────────
export function applyAllFixes(prompt: string): FixResult {
  const original = prompt;
  let current = prompt;
  const allAffected = new Set<number>();
  const parts: string[] = [];

  for (const fixer of [fixInvisibleChars, fixEmptyBlocks, fixLongLines, fixExceedsCharLimit]) {
    const r = fixer(current);
    if (r.fixed !== current) {
      current = r.fixed;
      r.affectedLines.forEach((l) => allAffected.add(l));
      parts.push(r.summary);
    }
  }

  if (current === original) {
    return emptyResult('invisible', prompt);
  }

  const removedChars = original.length - current.length;
  const removedLines = original.split('\n').length - current.split('\n').length;

  return {
    id: 'invisible', // umbrella id; not used by panel for "all"
    fixed: current,
    removedChars,
    removedLines,
    affectedLines: Array.from(allAffected).sort((a, b) => a - b),
    description: `${parts.length} correç${parts.length > 1 ? 'ões' : 'ão'} aplicada${parts.length > 1 ? 's' : ''}`,
    summary: parts.join(' '),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Detection
// ──────────────────────────────────────────────────────────────────────────
export interface AvailableFix {
  id: FixerId;
  label: string;
  icon: string;
  result: FixResult;
}

export function detectAvailableFixes(prompt: string): AvailableFix[] {
  const candidates: Array<Omit<AvailableFix, 'result'> & { fn: (p: string) => FixResult }> = [
    { id: 'invisible', label: 'Remover caracteres invisíveis', icon: '🧹', fn: fixInvisibleChars },
    { id: 'empty', label: 'Compactar linhas em branco', icon: '📏', fn: fixEmptyBlocks },
    { id: 'longLines', label: 'Quebrar linhas longas', icon: '✂️', fn: fixLongLines },
    { id: 'truncate', label: 'Truncar para o limite', icon: '📐', fn: fixExceedsCharLimit },
  ];

  return candidates
    .map(({ fn, ...rest }) => ({ ...rest, result: fn(prompt) }))
    .filter((c) => c.result.fixed !== prompt);
}
