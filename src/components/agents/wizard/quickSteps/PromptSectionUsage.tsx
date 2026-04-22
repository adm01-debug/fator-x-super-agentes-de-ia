import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { CheckCircle2, AlertTriangle, Circle, Flame, Gauge, Scissors, Sparkles } from 'lucide-react';
import { locateSections, type SectionLocation } from '@/lib/promptSectionLocator';
import { PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';
import { type PromptSectionKey } from '@/lib/validations/quickAgentSchema';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  onJumpToSection?: (key: PromptSectionKey) => void;
}

interface SectionUsage {
  key: PromptSectionKey | 'others';
  label: string;
  status: SectionLocation['status'] | 'others';
  chars: number;
  lines: number;
  words: number;
  tokens: number;
  /** % of MAX_TOTAL the section consumes (0–100). */
  pctOfLimit: number;
}

interface UsageSnapshot {
  rows: SectionUsage[];
  totalChars: number;
  sectionsSum: number;
  topKey: PromptSectionKey | null;
  totalPct: number;
  suggestions: ReductionSuggestion[];
}

/**
 * A concrete, low-risk reduction the user can apply to shrink the prompt
 * without losing intent. Generated heuristically from the prompt text.
 */
interface ReductionSuggestion {
  id: string;
  /** Section the cut applies to (drives "Ir para" jump). */
  sectionKey: PromptSectionKey | null;
  sectionLabel: string;
  /** One-line action title shown in bold. */
  title: string;
  /** Short explanation of WHY this is safe. */
  rationale: string;
  /** Estimated characters saved if applied. */
  estCharsSaved: number;
  /** Convenience: estCharsSaved / 4 rounded up. */
  estTokensSaved: number;
}

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Detect 1–2 highest-impact, low-risk reductions inside a single section
 * block. Heuristics are intentionally conservative — they only flag patterns
 * that are very likely safe to remove without losing intent:
 *
 *  • Duplicated lines (same trimmed content appearing 2+ times).
 *  • Bullet items with the same head verb stacked back-to-back (often
 *    redundant rules: "Não faça X / Não faça Y / Não faça Z" → consolidate).
 *  • "Filler" prefaces ("É importante notar que…", "Vale ressaltar que…",
 *    "Lembrando que…") that add tokens without instruction value.
 *  • Excessively long bullet lists in CONSTRAINTS (>12 items) — suggests
 *    pruning the bottom third, which is usually low-priority.
 */
const FILLER_PATTERNS: Array<{ regex: RegExp; label: string }> = [
  { regex: /\b(é|e)\s+importante\s+(notar|destacar|ressaltar|lembrar)\s+que\b[^.\n]*\.?/gi, label: 'preâmbulos "é importante notar que…"' },
  { regex: /\bvale\s+(ressaltar|destacar|notar|lembrar)\s+que\b[^.\n]*\.?/gi, label: 'preâmbulos "vale ressaltar que…"' },
  { regex: /\blembrando\s+que\b[^.\n]*\.?/gi, label: 'preâmbulos "lembrando que…"' },
  { regex: /\b(por\s+favor|please)\b[,.\s]?/gi, label: 'cortesias ("por favor")' },
  { regex: /\b(de\s+forma|de\s+maneira)\s+(clara|objetiva|sucinta|concisa)\b/gi, label: 'redundâncias "de forma clara/objetiva"' },
];

function analyzeBlockReductions(
  block: string,
  sectionKey: PromptSectionKey,
  sectionLabel: string,
): ReductionSuggestion[] {
  const out: ReductionSuggestion[] = [];
  if (block.length < 80) return out;

  // (1) Duplicated lines
  const lines = block.split('\n').map((l) => l.trim()).filter((l) => l.length > 8);
  const counts = new Map<string, number>();
  for (const l of lines) counts.set(l, (counts.get(l) ?? 0) + 1);
  let dupChars = 0;
  let dupCount = 0;
  for (const [line, n] of counts) {
    if (n >= 2) {
      dupChars += line.length * (n - 1);
      dupCount += n - 1;
    }
  }
  if (dupCount >= 1 && dupChars >= 30) {
    out.push({
      id: `${sectionKey}-dups`,
      sectionKey,
      sectionLabel,
      title: `Remover ${dupCount} linha${dupCount > 1 ? 's' : ''} duplicada${dupCount > 1 ? 's' : ''}`,
      rationale: 'Linhas idênticas repetidas no bloco — manter apenas uma preserva 100% da intenção.',
      estCharsSaved: dupChars,
      estTokensSaved: Math.ceil(dupChars / 4),
    });
  }

  // (2) Filler prefaces
  let fillerChars = 0;
  const fillerHits: string[] = [];
  for (const { regex, label } of FILLER_PATTERNS) {
    const matches = block.match(regex);
    if (matches && matches.length > 0) {
      const sum = matches.reduce((s, m) => s + m.length, 0);
      if (sum >= 12) {
        fillerChars += sum;
        fillerHits.push(label);
      }
    }
  }
  if (fillerChars >= 30 && fillerHits.length > 0) {
    out.push({
      id: `${sectionKey}-filler`,
      sectionKey,
      sectionLabel,
      title: 'Cortar preâmbulos e cortesias redundantes',
      rationale: `Frases de preenchimento sem valor instrucional: ${fillerHits.slice(0, 2).join(', ')}.`,
      estCharsSaved: fillerChars,
      estTokensSaved: Math.ceil(fillerChars / 4),
    });
  }

  // (3) Stacked bullets with same head verb (typical of redundant rules)
  const bulletRegex = /^[\s]*[-•*]\s+(.+)$/gm;
  const bulletMatches = [...block.matchAll(bulletRegex)].map((m) => m[1].trim());
  if (bulletMatches.length >= 4) {
    const headCounts = new Map<string, { count: number; chars: number }>();
    for (const b of bulletMatches) {
      const head = b.split(/\s+/).slice(0, 2).join(' ').toLowerCase();
      const prev = headCounts.get(head) ?? { count: 0, chars: 0 };
      headCounts.set(head, { count: prev.count + 1, chars: prev.chars + b.length });
    }
    let stackedHead: string | null = null;
    let stackedSavings = 0;
    for (const [head, { count, chars }] of headCounts) {
      if (count >= 3 && chars >= 60) {
        // Estimate savings = consolidate N bullets into 1, save (N-1)/N of chars
        const saved = Math.floor((chars * (count - 1)) / count);
        if (saved > stackedSavings) {
          stackedSavings = saved;
          stackedHead = head;
        }
      }
    }
    if (stackedHead && stackedSavings >= 40) {
      out.push({
        id: `${sectionKey}-stacked`,
        sectionKey,
        sectionLabel,
        title: `Consolidar regras que começam com "${stackedHead}…"`,
        rationale: 'Vários itens da lista repetem o mesmo verbo/comando — agrupar em uma regra única reduz tokens sem perder cobertura.',
        estCharsSaved: stackedSavings,
        estTokensSaved: Math.ceil(stackedSavings / 4),
      });
    }

    // (4) Very long lists — suggest pruning the tail
    if (bulletMatches.length > 12) {
      const tail = bulletMatches.slice(Math.floor(bulletMatches.length * 0.7));
      const tailChars = tail.reduce((s, b) => s + b.length + 4, 0);
      if (tailChars >= 80) {
        out.push({
          id: `${sectionKey}-longlist`,
          sectionKey,
          sectionLabel,
          title: `Reduzir lista de ${bulletMatches.length} itens (manter top ~70%)`,
          rationale: 'Listas muito longas têm itens de baixa prioridade no final — modelos costumam priorizar os primeiros.',
          estCharsSaved: tailChars,
          estTokensSaved: Math.ceil(tailChars / 4),
        });
      }
    }
  }

  return out;
}

/** Color tone for the bar based on % of MAX_TOTAL. */
function toneClass(pct: number): { bar: string; text: string } {
  if (pct >= 35) return { bar: 'bg-destructive', text: 'text-destructive' };
  if (pct >= 20) return { bar: 'bg-nexus-amber', text: 'text-nexus-amber' };
  return { bar: 'bg-nexus-emerald', text: 'text-nexus-emerald' };
}

/**
 * Heavy work: section locator + per-section stats. Pulled out of the
 * component so we can memoize on a *content hash* (length + sample chars)
 * — typing one character usually mutates `prompt` identity, but the
 * resulting layout rarely changes meaningfully on every keystroke. The
 * cache lets us reuse the previous snapshot until the structure actually
 * shifts.
 */
const computeUsage = (prompt: string): UsageSnapshot => {
  const locations = locateSections(prompt);
  const totalChars = prompt.length;
  const limit = PROMPT_LIMITS.MAX_TOTAL;

  let sectionsSum = 0;
  let topKey: PromptSectionKey | null = null;
  let topChars = 0;

  const sectionRows: SectionUsage[] = locations.map((loc) => {
    if (loc.status === 'missing') {
      return {
        key: loc.key,
        label: loc.label,
        status: loc.status,
        chars: 0,
        lines: 0,
        words: 0,
        tokens: 0,
        pctOfLimit: 0,
      };
    }
    const block = prompt.slice(loc.startChar, loc.endChar);
    const chars = block.length;
    const lines = block.split('\n').filter((l) => l.length > 0).length;
    const words = countWords(block);
    const tokens = Math.ceil(chars / 4);
    sectionsSum += chars;
    if (chars > topChars) {
      topChars = chars;
      topKey = loc.key;
    }
    return {
      key: loc.key,
      label: loc.label,
      status: loc.status,
      chars,
      lines,
      words,
      tokens,
      pctOfLimit: Math.min(100, (chars / limit) * 100),
    };
  });

  const othersChars = Math.max(0, totalChars - sectionsSum);
  const othersRow: SectionUsage = {
    key: 'others',
    label: 'Outros (header, comentários, espaços)',
    status: 'others',
    chars: othersChars,
    lines: 0,
    words: 0,
    tokens: Math.ceil(othersChars / 4),
    pctOfLimit: Math.min(100, (othersChars / limit) * 100),
  };

  return {
    rows: [...sectionRows, othersRow],
    totalChars,
    sectionsSum,
    topKey,
    totalPct: Math.min(100, (totalChars / limit) * 100),
  };
};

// ── Caching layer ───────────────────────────────────────────────────────
// 1) An in-memory LRU keyed by prompt identity (works across remounts in
//    the same session) — instant rehydration when the same text is shown
//    twice (e.g. switching steps and coming back).
// 2) A sessionStorage snapshot of the LAST computed view, so that even
//    after a page refresh the user sees stable numbers immediately while
//    the next compute runs.
const MEMO_CACHE = new Map<string, UsageSnapshot>();
const MEMO_LIMIT = 24;
const SESSION_KEY = 'wizard.promptSectionUsage.lastSnapshot.v1';

function rememberSnapshot(prompt: string, snap: UsageSnapshot) {
  // Bump LRU position
  if (MEMO_CACHE.has(prompt)) MEMO_CACHE.delete(prompt);
  MEMO_CACHE.set(prompt, snap);
  if (MEMO_CACHE.size > MEMO_LIMIT) {
    const oldest = MEMO_CACHE.keys().next().value as string | undefined;
    if (oldest !== undefined) MEMO_CACHE.delete(oldest);
  }
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ prompt, snap }));
  } catch {/* quota / privacy mode — ignore */}
}

function recallSnapshot(prompt: string): UsageSnapshot | null {
  const cached = MEMO_CACHE.get(prompt);
  if (cached) return cached;
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { prompt: string; snap: UsageSnapshot };
    if (parsed?.prompt === prompt && parsed.snap?.rows) {
      MEMO_CACHE.set(prompt, parsed.snap);
      return parsed.snap;
    }
  } catch {/* malformed — ignore */}
  return null;
}

/**
 * Debounce hook tuned for typing. Returns the latest value at most once per
 * `delay` ms. Skips the debounce on the very first call so the UI hydrates
 * synchronously instead of flashing empty.
 */
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  const firstRef = useRef(true);
  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      setDebounced(value);
      return;
    }
    const t = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function PromptSectionUsageImpl({ prompt, onJumpToSection }: Props) {
  // While the user is hammering the keyboard, hold the snapshot back ~80ms.
  // The header chips elsewhere update in real time; this card has 6+ rows
  // and progressbars, so trading a touch of latency for fewer reflows is
  // a clear win.
  const debouncedPrompt = useDebouncedValue(prompt, 80);

  const snapshot = useMemo<UsageSnapshot>(() => {
    const recalled = recallSnapshot(debouncedPrompt);
    if (recalled) return recalled;
    const fresh = computeUsage(debouncedPrompt);
    rememberSnapshot(debouncedPrompt, fresh);
    return fresh;
  }, [debouncedPrompt]);

  const { rows, totalChars, sectionsSum, topKey, totalPct } = snapshot;
  const limit = PROMPT_LIMITS.MAX_TOTAL;
  const sectionsCoverage = totalChars > 0 ? Math.round((sectionsSum / totalChars) * 100) : 0;
  const totalTone = toneClass(totalPct);
  // Visual cue when the displayed snapshot lags behind the live prompt
  // (meaning the debounce is queued). Subtle — no layout shift.
  const isPending = prompt !== debouncedPrompt;

  return (
    <div className={cn('nexus-card space-y-3 transition-opacity', isPending && 'opacity-90')}>
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            Uso por seção
            {isPending && (
              <span
                className="text-[9px] font-mono uppercase tracking-wider text-muted-foreground/70"
                title="Recalculando após pausa na digitação"
              >
                · atualizando…
              </span>
            )}
          </p>
          <p className="text-[11px] text-muted-foreground">
            Quanto cada seção pesa no orçamento total — identifique o que cortar primeiro.
          </p>
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-[11px] font-mono font-semibold tabular-nums', totalTone.text)}>
            {totalChars.toLocaleString('pt-BR')} / {limit.toLocaleString('pt-BR')}
          </div>
          <div className="text-[10px] font-mono text-muted-foreground">
            {totalPct.toFixed(0)}% do limite
          </div>
        </div>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => {
          const isMissing = r.status === 'missing';
          const isOthers = r.status === 'others';
          const isTop = !isMissing && !isOthers && r.key === topKey && r.chars > 0;
          const tone = toneClass(r.pctOfLimit);
          const interactive = !isMissing && !isOthers && !!onJumpToSection;

          const Wrapper: React.ElementType = interactive ? 'button' : 'div';

          return (
            <li key={String(r.key)}>
              <Wrapper
                {...(interactive
                  ? {
                      type: 'button',
                      onClick: () => onJumpToSection?.(r.key as PromptSectionKey),
                      'aria-label': `Pular para a seção ${r.label} no editor`,
                    }
                  : {})}
                className={cn(
                  'w-full text-left space-y-1 rounded-md p-2 transition-colors',
                  interactive && 'hover:bg-secondary/50 cursor-pointer',
                  isOthers && 'opacity-80',
                )}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0">
                    {isOthers ? (
                      <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/30 shrink-0" aria-hidden />
                    ) : r.status === 'ok' ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-nexus-emerald shrink-0" aria-hidden />
                    ) : r.status === 'thin' ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-nexus-amber shrink-0" aria-hidden />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
                    )}
                    <span
                      className={cn(
                        'text-xs font-medium truncate',
                        isMissing ? 'text-muted-foreground' : 'text-foreground',
                      )}
                    >
                      {r.label}
                    </span>
                    {isTop && (
                      <span
                        className="inline-flex items-center gap-1 text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded-full border border-destructive/30 bg-destructive/10 text-destructive shrink-0"
                        title="Seção que mais consome caracteres do limite"
                      >
                        <Flame className="h-2.5 w-2.5" /> Maior
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] font-mono tabular-nums text-muted-foreground shrink-0">
                    {isMissing ? (
                      <span className="italic">— ausente</span>
                    ) : isOthers ? (
                      <>
                        {r.chars.toLocaleString('pt-BR')} chars · ~{r.tokens.toLocaleString('pt-BR')} tk
                      </>
                    ) : (
                      <>
                        {r.chars.toLocaleString('pt-BR')} chars · {r.lines} linhas · {r.words} palavras · ~{r.tokens.toLocaleString('pt-BR')} tk
                      </>
                    )}
                  </div>
                </div>
                {!isMissing && (
                  <div
                    className="h-1.5 rounded-full bg-secondary/60 overflow-hidden"
                    role="progressbar"
                    aria-valuenow={Math.round(r.pctOfLimit)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${r.label}: ${r.pctOfLimit.toFixed(1)}% do limite`}
                  >
                    <div
                      className={cn(
                        'h-full transition-all duration-300',
                        isOthers ? 'bg-muted-foreground/40' : tone.bar,
                      )}
                      style={{ width: `${Math.max(2, r.pctOfLimit)}%` }}
                    />
                  </div>
                )}
                {!isMissing && (
                  <div className="text-[9px] font-mono text-muted-foreground/70">
                    {r.pctOfLimit.toFixed(1)}% do limite
                  </div>
                )}
              </Wrapper>
            </li>
          );
        })}
      </ul>

      <div className="text-[10px] font-mono text-muted-foreground pt-2 border-t border-border/40 flex items-center justify-between gap-2 flex-wrap">
        <span>
          total: <span className={cn('font-semibold', totalTone.text)}>{totalChars.toLocaleString('pt-BR')}</span> / {limit.toLocaleString('pt-BR')} chars ({totalPct.toFixed(0)}%)
        </span>
        {totalChars > 0 && (
          <span>
            4 seções somam <span className="text-foreground font-semibold">{sectionsCoverage}%</span> do prompt
          </span>
        )}
      </div>
    </div>
  );
}

// Skip rerenders when the parent rerenders for unrelated reasons (the
// step component rerenders on every keystroke for the textarea state).
export const PromptSectionUsage = memo(PromptSectionUsageImpl, (prev, next) =>
  prev.prompt === next.prompt && prev.onJumpToSection === next.onJumpToSection,
);
