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
