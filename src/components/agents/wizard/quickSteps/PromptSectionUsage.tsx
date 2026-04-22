import { useMemo } from 'react';
import { CheckCircle2, AlertTriangle, Circle, Flame, Gauge } from 'lucide-react';
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

function countWords(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/** Color tone for the bar based on % of MAX_TOTAL. */
function toneClass(pct: number): { bar: string; text: string } {
  if (pct >= 35) return { bar: 'bg-destructive', text: 'text-destructive' };
  if (pct >= 20) return { bar: 'bg-nexus-amber', text: 'text-nexus-amber' };
  return { bar: 'bg-nexus-emerald', text: 'text-nexus-emerald' };
}

export function PromptSectionUsage({ prompt, onJumpToSection }: Props) {
  const { rows, totalChars, sectionsSum, topKey, totalPct } = useMemo(() => {
    const locations = locateSections(prompt);
    const totalCharsLocal = prompt.length;
    const limit = PROMPT_LIMITS.MAX_TOTAL;

    let sectionsSumLocal = 0;
    let topKeyLocal: PromptSectionKey | null = null;
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
      sectionsSumLocal += chars;
      if (chars > topChars) {
        topChars = chars;
        topKeyLocal = loc.key;
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

    // "Outros" — chars fora das 4 seções canônicas (header, comentários, etc.)
    const othersChars = Math.max(0, totalCharsLocal - sectionsSumLocal);
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
      totalChars: totalCharsLocal,
      sectionsSum: sectionsSumLocal,
      topKey: topKeyLocal,
      totalPct: Math.min(100, (totalCharsLocal / limit) * 100),
    };
  }, [prompt]);

  const limit = PROMPT_LIMITS.MAX_TOTAL;
  const sectionsCoverage = totalChars > 0 ? Math.round((sectionsSum / totalChars) * 100) : 0;
  const totalTone = toneClass(totalPct);

  return (
    <div className="nexus-card space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground flex items-center gap-1.5">
            <Gauge className="h-3.5 w-3.5 text-primary" />
            Uso por seção
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
