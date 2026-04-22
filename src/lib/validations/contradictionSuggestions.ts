/**
 * Suggestion generator for the rule-conflict cards in the preflight review.
 *
 * Given a detected `PromptContradiction`, produces 2–3 concrete rewrite
 * examples the user can paste back into the prompt to eliminate the conflict
 * before creating the agent. 100% offline, no LLM calls — pattern-based and
 * deterministic so the suggestions are stable across renders.
 *
 * Each suggestion is rendered by the UI as: a short `title`, a one-line
 * `rationale` explaining the fix, and a `rewrite` block (the actual text the
 * user can copy). For polarity/language conflicts we propose three angles:
 *   1. Keep-the-positive (drop the prohibition or vice versa)
 *   2. Add a scoped exception ("exceto quando…") so both rules can coexist
 *   3. Reframe as conditional / priority order
 * For numeric conflicts we propose either picking one side or merging into a
 * single explicit range.
 */

import {
  detectPromptContradictions,
  type PromptContradiction,
  type ContradictionKind,
} from './promptContradictions';

export interface ContradictionSuggestion {
  /** Short label rendered as the suggestion's heading. */
  title: string;
  /** One-line explanation of WHY this rewrite resolves the conflict. */
  rationale: string;
  /** The rewritten rules block — multiline, ready to paste into the prompt. */
  rewrite: string;
}

/* ------------------------------- helpers ------------------------------- */

/** Strip leading bullet markers / numbering so we can re-prefix consistently. */
function stripBullet(line: string): string {
  return line
    .replace(/^\s*[-*•]\s+/, '')
    .replace(/^\s*\d+[.)]\s+/, '')
    .trim();
}

/* ----------------------------- per-kind ------------------------------ */

function polaritySuggestions(c: PromptContradiction): ContradictionSuggestion[] {
  const a = stripBullet(c.snippetA);
  const b = stripBullet(c.snippetB);

  return [
    {
      title: 'Manter apenas uma das regras',
      rationale:
        'Escolha o lado que reflete o comportamento desejado e remova o outro — elimina a contradição na raiz.',
      rewrite: `- ${a}\n# (remover linha conflitante: "${b}")`,
    },
    {
      title: 'Adicionar exceção explícita',
      rationale:
        'Mantém ambas as regras coexistindo ao definir quando cada uma se aplica — útil quando há contextos diferentes.',
      rewrite: `- ${a}, exceto quando [condição específica], caso em que: ${b.toLowerCase()}.`,
    },
    {
      title: 'Reescrever como prioridade condicional',
      rationale:
        'Define ordem de precedência clara para que o modelo saiba qual instrução vence em caso de ambiguidade.',
      rewrite: `- Prioridade 1: ${a}\n- Prioridade 2 (somente se a primeira não se aplicar): ${b}`,
    },
  ];
}

function numericSuggestions(c: PromptContradiction): ContradictionSuggestion[] {
  // Try to pull the two numbers out of the reason message — that's the safest source.
  const nums = c.reason.match(/(\d+)/g)?.map((n) => parseInt(n, 10)) ?? [];
  const [v1, v2] = nums;
  const isRangeViolation = c.reason.toLowerCase().includes('mínimo');
  const unit = c.reason.match(/(palavras?|caracteres?|chars?|linhas?|frases?|paragrafos?|tokens?|minutos?|segundos?)/i)?.[1] ?? 'unidades';

  if (isRangeViolation && v1 != null && v2 != null) {
    // min > max: swap them OR pick one tight value.
    const lo = Math.min(v1, v2);
    const hi = Math.max(v1, v2);
    return [
      {
        title: `Corrigir intervalo para ${lo}–${hi} ${unit}`,
        rationale:
          'Inverte os papéis de mínimo e máximo para que o intervalo faça sentido matematicamente.',
        rewrite: `- Resposta deve ter entre ${lo} e ${hi} ${unit}.`,
      },
      {
        title: `Fixar um valor único (${Math.round((lo + hi) / 2)} ${unit})`,
        rationale:
          'Elimina a ambiguidade do intervalo escolhendo um alvo único — mais previsível para o modelo.',
        rewrite: `- Resposta deve ter aproximadamente ${Math.round((lo + hi) / 2)} ${unit}.`,
      },
    ];
  }

  if (v1 != null && v2 != null) {
    // Two `eq` claims with different values.
    return [
      {
        title: `Manter ${v1} ${unit}`,
        rationale:
          'Adota o primeiro valor como canônico e remove a segunda regra contraditória.',
        rewrite: `- Resposta deve ter exatamente ${v1} ${unit}.`,
      },
      {
        title: `Manter ${v2} ${unit}`,
        rationale: 'Adota o segundo valor como canônico — escolha conforme a intenção real.',
        rewrite: `- Resposta deve ter exatamente ${v2} ${unit}.`,
      },
      {
        title: `Trocar por intervalo ${Math.min(v1, v2)}–${Math.max(v1, v2)} ${unit}`,
        rationale:
          'Quando ambos os valores são aceitáveis, um intervalo dá flexibilidade sem contradição.',
        rewrite: `- Resposta deve ter entre ${Math.min(v1, v2)} e ${Math.max(v1, v2)} ${unit}.`,
      },
    ];
  }

  return [
    {
      title: 'Unificar em uma única regra numérica',
      rationale:
        'Reescreva os dois limites em uma sentença única para evitar interpretações divergentes.',
      rewrite: `- [definir um único valor ou intervalo claro de ${unit}]`,
    },
  ];
}

function languageSuggestions(c: PromptContradiction): ContradictionSuggestion[] {
  // Pull both language names from the reason: "Idiomas distintos exigidos: X vs Y."
  const m = c.reason.match(/:\s*(.+?)\s+vs\s+(.+?)\.$/);
  const langA = m?.[1]?.trim() ?? 'idioma A';
  const langB = m?.[2]?.trim() ?? 'idioma B';

  return [
    {
      title: `Padronizar tudo em ${langA}`,
      rationale:
        'Mantém uma única instrução de idioma — a mais simples e previsível para o modelo.',
      rewrite: `- Sempre responder em ${langA}, independentemente do idioma da pergunta.`,
    },
    {
      title: `Padronizar tudo em ${langB}`,
      rationale: 'Alternativa: usa o segundo idioma como padrão único.',
      rewrite: `- Sempre responder em ${langB}, independentemente do idioma da pergunta.`,
    },
    {
      title: 'Espelhar o idioma da pergunta',
      rationale:
        'Se ambos os idiomas são válidos, deixe o modelo decidir com base no input do usuário.',
      rewrite: `- Responder no mesmo idioma da última mensagem do usuário (${langA} ou ${langB}).`,
    },
  ];
}

/* -------------------------------- main ------------------------------- */

const DISPATCH: Record<
  ContradictionKind,
  (c: PromptContradiction) => ContradictionSuggestion[]
> = {
  polarity: polaritySuggestions,
  numeric: numericSuggestions,
  language: languageSuggestions,
};

/**
 * Produce 2–3 concrete rewrite examples that, if applied, would eliminate the
 * given contradiction. Suggestions are deterministic — same input ⇒ same output.
 */
export function suggestContradictionRewrites(
  c: PromptContradiction,
): ContradictionSuggestion[] {
  return DISPATCH[c.kind](c);
}

/* ----------------------------- auto-fix ------------------------------ */

export interface ContradictionAutoFix {
  /** The original contradiction this fix targets. */
  conflict: PromptContradiction;
  /** Single unified rule line that replaces both conflicting lines. */
  unifiedRule: string;
  /** PT-BR explanation of why this is the canonical merge. */
  rationale: string;
  /** The full rewritten prompt with both lines replaced. */
  fixedPrompt: string;
  /** 1-indexed line numbers in the ORIGINAL prompt that were affected. */
  affectedLines: number[];
}

/**
 * Pick the canonical "unified" rewrite for a single contradiction. We always
 * use the FIRST suggestion of each kind because those are the safest defaults:
 *   - polarity → keep one rule, drop the other
 *   - numeric  → fix the range or pick the first explicit value
 *   - language → standardize on the first declared language
 *
 * The user can still pick a different rewrite manually from the per-conflict
 * suggestion list if the default isn't right.
 */
function pickUnifiedRule(c: PromptContradiction): { line: string; rationale: string } {
  const all = suggestContradictionRewrites(c);
  return extractUnifiedFromSuggestion(all[0]);
}

/**
 * Extract a single "unified rule" line from a multiline suggestion rewrite.
 * Picks the first non-comment, non-empty line — same logic used by the default
 * pick, but exposed so the UI can build a fix from any chosen suggestion.
 */
function extractUnifiedFromSuggestion(s: ContradictionSuggestion): { line: string; rationale: string } {
  const firstLine = s.rewrite
    .split('\n')
    .map((l) => l.trim())
    .find((l) => l.length > 0 && !l.startsWith('#'));
  return { line: firstLine ?? s.rewrite.trim(), rationale: s.rationale };
}

/**
 * Replace the two conflicting lines (1-indexed `lineA` / `lineB`) with a single
 * unified rule line. Inserts the unified rule at the position of the FIRST
 * conflicting line and removes the second; preserves leading indentation.
 */
function spliceUnifiedRule(
  prompt: string,
  lineA: number,
  lineB: number,
  unified: string,
): { fixedPrompt: string; affectedLines: number[] } {
  const lines = prompt.split('\n');
  const firstIdx = Math.min(lineA, lineB) - 1;
  const secondIdx = Math.max(lineA, lineB) - 1;
  if (firstIdx < 0 || secondIdx >= lines.length) {
    return { fixedPrompt: prompt, affectedLines: [] };
  }

  // Preserve indentation of the first conflicting line.
  const indentMatch = lines[firstIdx].match(/^(\s*)/);
  const indent = indentMatch?.[1] ?? '';
  const out = [...lines];
  out[firstIdx] = indent + unified;
  // Remove the second conflicting line.
  out.splice(secondIdx, 1);

  return {
    fixedPrompt: out.join('\n'),
    affectedLines: [Math.min(lineA, lineB), Math.max(lineA, lineB)],
  };
}

/**
 * Compute auto-fix proposals for every contradiction in the prompt. Each
 * proposal can be applied independently, OR the consumer can apply them all
 * sequentially via `applyAllContradictionFixes` (which re-detects after each
 * splice to keep line numbers consistent).
 */
export function buildContradictionAutoFixes(prompt: string): ContradictionAutoFix[] {
  const conflicts = detectPromptContradictions(prompt);
  return conflicts.map((c) => {
    const { line: unifiedRule, rationale } = pickUnifiedRule(c);
    const { fixedPrompt, affectedLines } = spliceUnifiedRule(
      prompt,
      c.lineA,
      c.lineB,
      unifiedRule,
    );
    return {
      conflict: c,
      unifiedRule,
      rationale,
      fixedPrompt,
      affectedLines,
    };
  });
}

/**
 * Apply every contradiction fix sequentially. After each splice we re-detect
 * conflicts so the next fix's line numbers stay valid against the freshly
 * mutated prompt — important because each splice removes one line.
 *
 * Returns the final prompt + the count of conflicts actually resolved.
 */
export function applyAllContradictionFixes(prompt: string): {
  fixedPrompt: string;
  resolved: number;
} {
  let working = prompt;
  let resolved = 0;
  // Cap iterations defensively to avoid infinite loops if a fix re-introduces
  // a conflict (shouldn't happen, but be safe).
  for (let i = 0; i < 50; i++) {
    const fixes = buildContradictionAutoFixes(working);
    if (fixes.length === 0) break;
    const next = fixes[0];
    if (next.fixedPrompt === working) break; // no-op safeguard
    working = next.fixedPrompt;
    resolved += 1;
  }
  return { fixedPrompt: working, resolved };
}
