/**
 * Pure utilities for locating required prompt sections inside a system prompt
 * and computing where to insert missing ones in canonical order
 * (Persona → Escopo → Formato → Regras).
 *
 * Reused by:
 *  - PromptSectionGutter      (visual rail next to the editor)
 *  - PromptHighlightOverlay   (mirrored highlight layer)
 *  - StepQuickPrompt          (insertion + scroll/jump logic)
 */
import {
  REQUIRED_PROMPT_SECTIONS,
  analyzeSectionContent,
  findSectionLineIndex,
  type PromptSectionKey,
} from '@/lib/validations/quickAgentSchema';

export type SectionStatus = 'ok' | 'thin' | 'missing';

export interface SectionLocation {
  key: PromptSectionKey;
  label: string;
  status: SectionStatus;
  /** Reason text when status === 'thin' (e.g. "Muito curto (3/8 palavras)"). */
  thinReason: string | null;
  /**
   * 0-based line index of the heading.
   * - 'ok' / 'thin' → line of the existing heading.
   * - 'missing'     → line where the heading WOULD be inserted (informational only).
   */
  headingLine: number;
  /** Char offset of the start of the section block (heading line start). */
  startChar: number;
  /** Char offset of the end of the section block (start of next section, or EOL). */
  endChar: number;
  /** Char offset where the snippet should be inserted when status === 'missing'. */
  insertChar: number;
}

/** Index of the first char of `lineIdx` in `lines`. */
function lineStartChar(lines: string[], lineIdx: number): number {
  let off = 0;
  for (let i = 0; i < lineIdx; i++) off += lines[i].length + 1; // +1 for '\n'
  return off;
}

/**
 * Compute structured locations for all required sections of the given prompt.
 * Stable canonical order: Persona, Escopo, Formato, Regras.
 */
export function locateSections(prompt: string): SectionLocation[] {
  const lines = prompt.split('\n');
  const reports = analyzeSectionContent(prompt);
  const totalLen = prompt.length;

  // First pass: resolve heading line for every present section.
  const presentLine: Record<PromptSectionKey, number> = {} as Record<PromptSectionKey, number>;
  for (const sec of REQUIRED_PROMPT_SECTIONS) {
    presentLine[sec.key] = findSectionLineIndex(prompt, sec.key);
  }

  // For missing sections, find insertion point = start of the next canonical
  // section that DOES exist; otherwise, end of prompt (with a leading newline pad).
  const canonicalKeys = REQUIRED_PROMPT_SECTIONS.map((s) => s.key);

  return REQUIRED_PROMPT_SECTIONS.map((sec, idx) => {
    const report = reports.find((r) => r.key === sec.key)!;
    const headingLine = presentLine[sec.key];

    if (headingLine !== -1) {
      // Section exists — compute startChar/endChar boundaries.
      const startChar = lineStartChar(lines, headingLine);
      // endChar = start of next existing canonical section after this one (in canonical order),
      // or the end of the prompt.
      let endChar = totalLen;
      for (let j = idx + 1; j < canonicalKeys.length; j++) {
        const nextLine = presentLine[canonicalKeys[j]];
        if (nextLine !== -1 && nextLine > headingLine) {
          endChar = lineStartChar(lines, nextLine);
          break;
        }
      }
      const status: SectionStatus = report.thinReason ? 'thin' : 'ok';
      return {
        key: sec.key,
        label: sec.label,
        status,
        thinReason: report.thinReason,
        headingLine,
        startChar,
        endChar,
        insertChar: startChar,
      };
    }

    // Missing — find where it should land.
    // Look forward in the canonical order for the FIRST section that exists.
    let insertChar = totalLen;
    let insertLine = lines.length;
    for (let j = idx + 1; j < canonicalKeys.length; j++) {
      const nextLine = presentLine[canonicalKeys[j]];
      if (nextLine !== -1) {
        insertChar = lineStartChar(lines, nextLine);
        insertLine = nextLine;
        break;
      }
    }

    return {
      key: sec.key,
      label: sec.label,
      status: 'missing' as const,
      thinReason: null,
      headingLine: insertLine,
      startChar: insertChar,
      endChar: insertChar,
      insertChar,
    };
  });
}

/**
 * Insert a snippet into the prompt at the canonical location for `key`.
 * Ensures a clean separation (`\n\n`) before and a single `\n` after when needed.
 *
 * Returns the new prompt and the char range of the inserted block (useful to
 * focus + select it after the React state flushes).
 */
export function insertSectionAt(
  prompt: string,
  key: PromptSectionKey,
  rawSnippet: string,
): { prompt: string; insertedRange: [number, number] } {
  const locations = locateSections(prompt);
  const target = locations.find((l) => l.key === key);
  const insertAt = target?.insertChar ?? prompt.length;

  // Normalize snippet: trim leading/trailing whitespace, then re-pad with proper separators.
  const trimmed = rawSnippet.replace(/^\n+/, '').replace(/\n+$/, '');
  const before = prompt.slice(0, insertAt);
  const after = prompt.slice(insertAt);

  // Leading separator: ensure exactly two newlines between previous content and snippet.
  let prefix = '';
  if (before.length > 0) {
    if (before.endsWith('\n\n')) prefix = '';
    else if (before.endsWith('\n')) prefix = '\n';
    else prefix = '\n\n';
  }

  // Trailing separator: ensure two newlines between snippet and next existing content.
  let suffix = '';
  if (after.length > 0) {
    if (after.startsWith('\n\n')) suffix = '';
    else if (after.startsWith('\n')) suffix = '\n';
    else suffix = '\n\n';
  } else {
    suffix = '\n';
  }

  const insertedText = prefix + trimmed + suffix;
  const next = before + insertedText + after;
  // Range of the heading itself (skip the prefix newlines so the highlight lands on `## Label`).
  const headingStart = before.length + prefix.length;
  const headingEnd = headingStart + trimmed.length;
  return { prompt: next, insertedRange: [headingStart, headingEnd] };
}

/**
 * Convenience: list only the sections that are not OK, in canonical order.
 */
export function getIncompleteLocations(prompt: string): SectionLocation[] {
  return locateSections(prompt).filter((l) => l.status !== 'ok');
}
