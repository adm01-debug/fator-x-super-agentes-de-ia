/**
 * Word-level diff focused on the two conflicting lines of a contradiction.
 *
 * The full-prompt `PromptDiff` is great for context, but contradictions are
 * almost always a 2-line vs 1-line swap — burying that in 80 lines of
 * unchanged text makes the actual edit hard to see. This component renders
 * ONLY the affected slice (linesA/B before → unifiedRule after) and uses
 * `diff.diffWordsWithSpace` to highlight exactly which tokens were removed
 * and which were added.
 *
 * Pure presentational — receives the original prompt + the built fix and
 * derives everything it needs locally.
 */
import { useMemo } from 'react';
import { diffWordsWithSpace } from 'diff';
import { Minus, Plus, ArrowRight } from 'lucide-react';
import type { ContradictionAutoFix } from '@/lib/validations/contradictionSuggestions';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  fix: ContradictionAutoFix;
}

export function ContradictionWordDiff({ prompt, fix }: Props) {
  const { beforeText, afterText, lineA, lineB } = useMemo(() => {
    const lines = prompt.split('\n');
    const a = lines[fix.conflict.lineA - 1] ?? '';
    const b = lines[fix.conflict.lineB - 1] ?? '';
    return {
      beforeText: `${a}\n${b}`,
      afterText: fix.unifiedRule,
      lineA: a,
      lineB: b,
    };
  }, [prompt, fix]);

  // Token-level diff between the joined "before" block and the unified rule.
  // diffWordsWithSpace keeps whitespace as part of unchanged tokens so the
  // visual flow of the sentence is preserved.
  const parts = useMemo(
    () => diffWordsWithSpace(beforeText, afterText),
    [beforeText, afterText],
  );

  return (
    <div className="space-y-3">
      {/* Side-by-side: only the conflicting lines, with word-level highlights */}
      <div className="grid md:grid-cols-2 gap-3">
        <DiffPane
          label={`Antes (linhas ${fix.conflict.lineA} e ${fix.conflict.lineB})`}
          tone="removed"
        >
          {parts.map((part, i) =>
            part.added ? null : (
              <span
                key={i}
                className={cn(
                  part.removed &&
                    'bg-destructive/20 text-destructive rounded px-0.5 line-through decoration-destructive/60',
                )}
              >
                {part.value}
              </span>
            ),
          )}
        </DiffPane>

        <DiffPane label="Depois (regra unificada)" tone="added">
          {parts.map((part, i) =>
            part.removed ? null : (
              <span
                key={i}
                className={cn(
                  part.added &&
                    'bg-nexus-emerald/20 text-nexus-emerald rounded px-0.5 font-medium',
                )}
              >
                {part.value}
              </span>
            ),
          )}
        </DiffPane>
      </div>

      {/* Token legend — counts give a quick "size of change" signal. */}
      <TokenLegend
        removed={parts.filter((p) => p.removed).length}
        added={parts.filter((p) => p.added).length}
      />

      {/* Compact "what happens to the prompt" summary */}
      <div className="rounded-md border border-border/50 bg-muted/20 px-2.5 py-2 text-[10px] text-muted-foreground space-y-1">
        <p className="flex items-center gap-1.5 font-medium text-foreground/80">
          <ArrowRight className="h-3 w-3" />
          Operação no prompt
        </p>
        <p>
          Linha <span className="font-mono text-foreground">{fix.conflict.lineA}</span> substituída pela regra unificada,
          linha <span className="font-mono text-foreground">{fix.conflict.lineB}</span> removida.
        </p>
        {(lineA.trim() === '' || lineB.trim() === '') && (
          <p className="text-nexus-amber/90">
            Nota: uma das linhas conflitantes está vazia ou só com espaços.
          </p>
        )}
      </div>
    </div>
  );
}

/* ----------------------------- subcomponents ----------------------------- */

function DiffPane({
  label,
  tone,
  children,
}: {
  label: string;
  tone: 'removed' | 'added';
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border overflow-hidden',
        tone === 'removed' ? 'border-destructive/30 bg-destructive/5' : 'border-nexus-emerald/30 bg-nexus-emerald/5',
      )}
    >
      <div
        className={cn(
          'px-2.5 py-1.5 border-b text-[10px] font-semibold uppercase tracking-wider',
          tone === 'removed'
            ? 'border-destructive/20 text-destructive/90 bg-destructive/10'
            : 'border-nexus-emerald/20 text-nexus-emerald bg-nexus-emerald/10',
        )}
      >
        {label}
      </div>
      <div className="px-3 py-2 text-xs font-mono leading-relaxed whitespace-pre-wrap text-foreground/90">
        {children}
      </div>
    </div>
  );
}

function TokenLegend({ removed, added }: { removed: number; added: number }) {
  return (
    <div className="flex items-center justify-center gap-3 text-[10px] text-muted-foreground">
      <span className="flex items-center gap-1">
        <Minus className="h-3 w-3 text-destructive" />
        <span className="font-mono text-destructive font-medium">{removed}</span>
        token{removed === 1 ? '' : 's'} removido{removed === 1 ? '' : 's'}
      </span>
      <span className="text-border">•</span>
      <span className="flex items-center gap-1">
        <Plus className="h-3 w-3 text-nexus-emerald" />
        <span className="font-mono text-nexus-emerald font-medium">{added}</span>
        token{added === 1 ? '' : 's'} adicionado{added === 1 ? '' : 's'}
      </span>
    </div>
  );
}
