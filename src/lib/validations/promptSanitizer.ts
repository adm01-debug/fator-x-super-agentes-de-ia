/**
 * Sanitização e análise estrutural do system prompt do wizard rápido.
 *
 * Funções puras, sem dependências externas, reutilizáveis em qualquer
 * editor de prompt do app.
 */

export const PROMPT_LIMITS = {
  MAX_TOTAL: 8000,
  MIN_TOTAL: 50,
  MAX_LINES: 200,
  MAX_LINE_LENGTH: 500,
  MAX_EMPTY_BLOCK: 3,
} as const;

// Caracteres de controle perigosos (preserva \t \n \r)
const CONTROL_CHARS_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;
// Zero-width e BOM (comuns em colagem do Word/Notion)
const ZERO_WIDTH_RE = /[\u200B-\u200D\uFEFF\u2060]/g;
// Tags HTML perigosas (open/close)
const DANGEROUS_TAGS_RE = /<\/?\s*(script|iframe|object|embed|style|link|meta)\b[^>]*>/gi;
// URLs javascript:
const JS_URI_RE = /javascript\s*:/gi;

export interface SanitizeResult {
  clean: string;
  warnings: string[]; // mensagens PT-BR
  removedControl: number;
  removedZeroWidth: number;
  removedTags: number;
  truncated: number; // chars descartados por exceder MAX_TOTAL
}

/**
 * Limpa caracteres inválidos, tags perigosas e trunca para o limite total.
 * Devolve string limpa + lista de warnings PT-BR para feedback ao usuário.
 *
 * @param text   texto a sanitizar
 * @param budget caracteres ainda disponíveis (default = MAX_TOTAL)
 */
export function sanitizePromptInput(text: string, budget: number = PROMPT_LIMITS.MAX_TOTAL): SanitizeResult {
  let clean = text ?? '';
  const warnings: string[] = [];

  const ctrlMatches = clean.match(CONTROL_CHARS_RE);
  const removedControl = ctrlMatches?.length ?? 0;
  if (removedControl > 0) {
    clean = clean.replace(CONTROL_CHARS_RE, '');
    warnings.push('Caracteres de controle removidos automaticamente.');
  }

  const zwMatches = clean.match(ZERO_WIDTH_RE);
  const removedZeroWidth = zwMatches?.length ?? 0;
  if (removedZeroWidth > 0) {
    clean = clean.replace(ZERO_WIDTH_RE, '');
  }

  const tagMatches = clean.match(DANGEROUS_TAGS_RE);
  const jsUriMatches = clean.match(JS_URI_RE);
  const removedTags = (tagMatches?.length ?? 0) + (jsUriMatches?.length ?? 0);
  if (removedTags > 0) {
    clean = clean.replace(DANGEROUS_TAGS_RE, '').replace(JS_URI_RE, '');
    warnings.push('Tags HTML perigosas removidas (segurança).');
  }

  let truncated = 0;
  if (clean.length > budget) {
    truncated = clean.length - budget;
    clean = clean.slice(0, Math.max(0, budget));
    warnings.push(`Texto colado foi truncado: ${truncated.toLocaleString('pt-BR')} caracteres descartados.`);
  }

  return { clean, warnings, removedControl, removedZeroWidth, removedTags, truncated };
}

export interface PromptStructure {
  charCount: number;
  lineCount: number;
  longLines: Array<{ line: number; length: number }>;
  consecutiveEmptyBlocks: number; // qtd de blocos com mais de MAX_EMPTY_BLOCK linhas em branco
  exceedsLineLimit: boolean;
  exceedsCharLimit: boolean;
  belowMin: boolean;
}

export function analyzePromptStructure(prompt: string): PromptStructure {
  const text = prompt ?? '';
  const lines = text.split('\n');
  const longLines: Array<{ line: number; length: number }> = [];
  let consecutiveEmpty = 0;
  let consecutiveEmptyBlocks = 0;

  lines.forEach((line, idx) => {
    if (line.length > PROMPT_LIMITS.MAX_LINE_LENGTH) {
      longLines.push({ line: idx + 1, length: line.length });
    }
    if (line.trim().length === 0) {
      consecutiveEmpty++;
      if (consecutiveEmpty === PROMPT_LIMITS.MAX_EMPTY_BLOCK + 1) {
        consecutiveEmptyBlocks++;
      }
    } else {
      consecutiveEmpty = 0;
    }
  });

  return {
    charCount: text.length,
    lineCount: lines.length,
    longLines,
    consecutiveEmptyBlocks,
    exceedsLineLimit: lines.length > PROMPT_LIMITS.MAX_LINES,
    exceedsCharLimit: text.length > PROMPT_LIMITS.MAX_TOTAL,
    belowMin: text.trim().length < PROMPT_LIMITS.MIN_TOTAL,
  };
}

export interface PromptValidationIssue {
  level: 'error' | 'warning';
  message: string;
}

/** Lista plana de erros bloqueantes + avisos não-bloqueantes (PT-BR). */
export function getPromptIssues(prompt: string): PromptValidationIssue[] {
  const s = analyzePromptStructure(prompt);
  const issues: PromptValidationIssue[] = [];

  if (s.exceedsLineLimit) {
    issues.push({
      level: 'error',
      message: `Máximo ${PROMPT_LIMITS.MAX_LINES} linhas (atual: ${s.lineCount}).`,
    });
  }
  if (s.exceedsCharLimit) {
    issues.push({
      level: 'error',
      message: `Máximo ${PROMPT_LIMITS.MAX_TOTAL.toLocaleString('pt-BR')} caracteres (atual: ${s.charCount.toLocaleString('pt-BR')}).`,
    });
  }
  for (const ll of s.longLines.slice(0, 3)) {
    issues.push({
      level: 'error',
      message: `Linha ${ll.line} excede ${PROMPT_LIMITS.MAX_LINE_LENGTH} caracteres (${ll.length}).`,
    });
  }
  if (s.longLines.length > 3) {
    issues.push({
      level: 'error',
      message: `+${s.longLines.length - 3} outras linhas excedem o limite.`,
    });
  }
  if (s.consecutiveEmptyBlocks > 0) {
    issues.push({
      level: 'warning',
      message: `Mais de ${PROMPT_LIMITS.MAX_EMPTY_BLOCK} linhas em branco consecutivas — considere limpar.`,
    });
  }
  return issues;
}

export function hasBlockingIssues(prompt: string): boolean {
  return getPromptIssues(prompt).some((i) => i.level === 'error');
}

// ──────────────────────────────────────────────────────────────────────────
// Detailed diagnostics — surfaces which exact rule fired, where, and a sample.
// Aditive to getPromptIssues; does not change existing APIs.
// ──────────────────────────────────────────────────────────────────────────

export type PromptDiagnosticId =
  | 'control_chars'
  | 'zero_width'
  | 'dangerous_html'
  | 'js_uri'
  | 'long_line'
  | 'empty_block'
  | 'exceeds_chars'
  | 'exceeds_lines';

export type PromptFixerId = 'invisible' | 'longLines' | 'truncate' | 'empty';

export interface PromptDiagnosticSample {
  /** 1-indexed line number where the first match starts. */
  line: number;
  /** 1-indexed column where the match starts on that line. */
  column: number;
  /** ~30 chars of context before + match + ~30 after, on a single line. */
  context: string;
  /** Offset of the match WITHIN `context` (for caret alignment). */
  matchStart: number;
  /** Length of the highlighted match within `context`. */
  matchLength: number;
  /** Human-readable escape of the match (e.g. `\\x07`, `\\u200B`). */
  escapedMatch?: string;
}

export interface PromptDiagnosticIssue {
  id: PromptDiagnosticId;
  level: 'error' | 'warning';
  title: string;
  description: string;
  /** Legible regex source or limit value. */
  rulePattern: string;
  occurrences: number;
  /** Up to 5 affected line numbers (1-indexed). */
  affectedLines: number[];
  sample?: PromptDiagnosticSample;
  fixerId?: PromptFixerId;
}

/** Convert an absolute char offset to {line, column} (both 1-indexed). */
function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  const before = text.slice(0, offset);
  const lines = before.split('\n');
  return { line: lines.length, column: lines[lines.length - 1].length + 1 };
}

/** Build a contextualized sample around an absolute offset. */
function buildSample(
  text: string,
  matchOffset: number,
  matchLength: number,
  escapedMatch?: string,
): PromptDiagnosticSample {
  const { line, column } = offsetToLineCol(text, matchOffset);
  const lineStart = matchOffset - (column - 1);
  const lineEnd = text.indexOf('\n', matchOffset);
  const lineText = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd);
  const localCol = column - 1;
  const ctxStart = Math.max(0, localCol - 30);
  const ctxEnd = Math.min(lineText.length, localCol + matchLength + 30);
  let context = lineText.slice(ctxStart, ctxEnd);
  // Escape invisibles inside the rendered context so they're visible.
  context = context
    .replace(CONTROL_CHARS_RE, (c) => `\\x${c.charCodeAt(0).toString(16).padStart(2, '0').toUpperCase()}`)
    .replace(ZERO_WIDTH_RE, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0').toUpperCase()}`);
  const prefix = ctxStart > 0 ? '…' : '';
  const suffix = ctxEnd < lineText.length ? '…' : '';
  const matchStartInCtx = prefix.length + (localCol - ctxStart);
  // Approximate match length in escaped context (best-effort for caret).
  const matchLenInCtx = Math.max(1, escapedMatch?.length ?? matchLength);
  return {
    line,
    column,
    context: `${prefix}${context}${suffix}`,
    matchStart: matchStartInCtx,
    matchLength: matchLenInCtx,
    escapedMatch,
  };
}

function escapeChar(c: string): string {
  const code = c.charCodeAt(0);
  if (code <= 0x1f || code === 0x7f) return `\\x${code.toString(16).padStart(2, '0').toUpperCase()}`;
  if ((code >= 0x200b && code <= 0x200d) || code === 0xfeff || code === 0x2060)
    return `\\u${code.toString(16).padStart(4, '0').toUpperCase()}`;
  return c;
}

/** Collect all match offsets for a global regex (resets lastIndex). */
function collectMatches(text: string, re: RegExp): Array<{ index: number; match: string }> {
  const out: Array<{ index: number; match: string }> = [];
  const r = new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`);
  let m: RegExpExecArray | null;
  while ((m = r.exec(text)) !== null) {
    out.push({ index: m.index, match: m[0] });
    if (m[0].length === 0) r.lastIndex++;
  }
  return out;
}

function uniqueLines(text: string, offsets: number[], cap = 5): number[] {
  const set = new Set<number>();
  for (const o of offsets) {
    set.add(offsetToLineCol(text, o).line);
    if (set.size >= cap) break;
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Produce structured diagnostics describing every validation rule that fired,
 * with a sample of the affected text and the fixer that can resolve it.
 */
export function diagnosePrompt(prompt: string): PromptDiagnosticIssue[] {
  const text = prompt ?? '';
  const issues: PromptDiagnosticIssue[] = [];

  // 1. Control chars
  const ctrlMatches = collectMatches(text, CONTROL_CHARS_RE);
  if (ctrlMatches.length > 0) {
    const first = ctrlMatches[0];
    issues.push({
      id: 'control_chars',
      level: 'error',
      title: 'Caracteres de controle',
      description:
        'Bytes de controle (ex.: \\x07, \\x1B) podem corromper a renderização do prompt no LLM e indicam colagem de fontes binárias.',
      rulePattern: '/[\\x00-\\x08\\x0B\\x0C\\x0E-\\x1F\\x7F]/',
      occurrences: ctrlMatches.length,
      affectedLines: uniqueLines(text, ctrlMatches.map((m) => m.index)),
      sample: buildSample(text, first.index, first.match.length, escapeChar(first.match)),
      fixerId: 'invisible',
    });
  }

  // 2. Zero-width / BOM
  const zwMatches = collectMatches(text, ZERO_WIDTH_RE);
  if (zwMatches.length > 0) {
    const first = zwMatches[0];
    issues.push({
      id: 'zero_width',
      level: 'warning',
      title: 'Caracteres invisíveis (zero-width / BOM)',
      description:
        'Comuns ao colar do Word, Notion ou Google Docs. Não aparecem na tela mas contam no orçamento de tokens e podem confundir o modelo.',
      rulePattern: '/[\\u200B-\\u200D\\uFEFF\\u2060]/',
      occurrences: zwMatches.length,
      affectedLines: uniqueLines(text, zwMatches.map((m) => m.index)),
      sample: buildSample(text, first.index, first.match.length, escapeChar(first.match)),
      fixerId: 'invisible',
    });
  }

  // 3. Dangerous HTML tags
  const tagMatches = collectMatches(text, DANGEROUS_TAGS_RE);
  if (tagMatches.length > 0) {
    const first = tagMatches[0];
    issues.push({
      id: 'dangerous_html',
      level: 'error',
      title: 'Tags HTML perigosas',
      description:
        'Tags como <script>, <iframe>, <object> ou <style> não devem aparecer em system prompts — risco de prompt injection ou renderização indesejada.',
      rulePattern: '<\\/?\\s*(script|iframe|object|embed|style|link|meta)\\b[^>]*>',
      occurrences: tagMatches.length,
      affectedLines: uniqueLines(text, tagMatches.map((m) => m.index)),
      sample: buildSample(text, first.index, first.match.length),
      fixerId: 'invisible',
    });
  }

  // 4. javascript: URIs
  const jsMatches = collectMatches(text, JS_URI_RE);
  if (jsMatches.length > 0) {
    const first = jsMatches[0];
    issues.push({
      id: 'js_uri',
      level: 'error',
      title: 'URIs javascript:',
      description: 'URIs com esquema javascript: são vetor clássico de injection — removidos automaticamente.',
      rulePattern: '/javascript\\s*:/i',
      occurrences: jsMatches.length,
      affectedLines: uniqueLines(text, jsMatches.map((m) => m.index)),
      sample: buildSample(text, first.index, first.match.length),
      fixerId: 'invisible',
    });
  }

  // 5. Structural — long lines, empty blocks, char/line limits
  const struct = analyzePromptStructure(text);

  if (struct.exceedsCharLimit) {
    issues.push({
      id: 'exceeds_chars',
      level: 'error',
      title: 'Excede o limite de caracteres',
      description: `O prompt tem ${struct.charCount.toLocaleString('pt-BR')} caracteres — acima do teto de ${PROMPT_LIMITS.MAX_TOTAL.toLocaleString('pt-BR')}. O excedente seria descartado pelo modelo.`,
      rulePattern: `length ≤ ${PROMPT_LIMITS.MAX_TOTAL}`,
      occurrences: 1,
      affectedLines: [],
      fixerId: 'truncate',
    });
  }

  if (struct.exceedsLineLimit) {
    issues.push({
      id: 'exceeds_lines',
      level: 'error',
      title: 'Excede o limite de linhas',
      description: `O prompt tem ${struct.lineCount} linhas — acima do teto de ${PROMPT_LIMITS.MAX_LINES}. Considere consolidar parágrafos.`,
      rulePattern: `lines ≤ ${PROMPT_LIMITS.MAX_LINES}`,
      occurrences: 1,
      affectedLines: [],
    });
  }

  if (struct.longLines.length > 0) {
    const lines = text.split('\n');
    const first = struct.longLines[0];
    const lineText = lines[first.line - 1] ?? '';
    // Build sample anchored at the overflow boundary.
    const matchOffset =
      lines.slice(0, first.line - 1).reduce((acc, l) => acc + l.length + 1, 0) +
      Math.min(PROMPT_LIMITS.MAX_LINE_LENGTH, lineText.length);
    issues.push({
      id: 'long_line',
      level: 'error',
      title: 'Linha muito longa',
      description: `Linhas acima de ${PROMPT_LIMITS.MAX_LINE_LENGTH} caracteres reduzem legibilidade e tendem a indicar parágrafos não quebrados ou JSONs colados.`,
      rulePattern: `line.length ≤ ${PROMPT_LIMITS.MAX_LINE_LENGTH}`,
      occurrences: struct.longLines.length,
      affectedLines: struct.longLines.slice(0, 5).map((l) => l.line),
      sample: buildSample(text, Math.min(matchOffset, text.length - 1), 1),
      fixerId: 'longLines',
    });
  }

  if (struct.consecutiveEmptyBlocks > 0) {
    issues.push({
      id: 'empty_block',
      level: 'warning',
      title: 'Blocos de linhas em branco',
      description: `Mais de ${PROMPT_LIMITS.MAX_EMPTY_BLOCK} linhas em branco consecutivas inflam o prompt sem agregar conteúdo.`,
      rulePattern: `empty_run ≤ ${PROMPT_LIMITS.MAX_EMPTY_BLOCK}`,
      occurrences: struct.consecutiveEmptyBlocks,
      affectedLines: [],
      fixerId: 'empty',
    });
  }

  return issues;
}
