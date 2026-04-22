import { useMemo, useState } from 'react';
import { ChevronDown, AlertCircle, AlertTriangle, ArrowRight, Wrench, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  diagnosePrompt,
  type PromptDiagnosticIssue,
  type PromptFixerId,
} from '@/lib/validations/promptSanitizer';
import {
  fixInvisibleChars,
  fixEmptyBlocks,
  fixLongLines,
  fixExceedsCharLimit,
} from '@/lib/promptAutoFixers';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  /** Focus the textarea on a given 1-indexed line. */
  onJumpToLine?: (line: number) => void;
  /** Apply a fix; receives the resulting prompt + a PT-BR summary. */
  onApplyFix?: (fixed: string, summary: string) => void;
}

const FIXERS: Record<PromptFixerId, (p: string) => { fixed: string; summary: string }> = {
  invisible: (p) => fixInvisibleChars(p),
  empty: (p) => fixEmptyBlocks(p),
  longLines: (p) => fixLongLines(p),
  truncate: (p) => fixExceedsCharLimit(p),
};

export function PromptDiagnosticsPanel({ prompt, onJumpToLine, onApplyFix }: Props) {
  const issues = useMemo(() => diagnosePrompt(prompt), [prompt]);
  const [open, setOpen] = useState(false);

  if (issues.length === 0) return null;

  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warnCount = issues.length - errorCount;

  const handleApply = (issue: PromptDiagnosticIssue) => {
    if (!issue.fixerId || !onApplyFix) return;
    const fixer = FIXERS[issue.fixerId];
    const result = fixer(prompt);
    if (result.fixed === prompt) return;
    onApplyFix(result.fixed, result.summary);
  };

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-lg border border-border bg-muted/30">
        <CollapsibleTrigger asChild>
          <button
            type="button"
            className="w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left hover:bg-muted/50 transition-colors rounded-lg"
            aria-label="Expandir diagnóstico técnico"
          >
            <div className="flex items-center gap-2">
              <Stethoscope className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold">Diagnóstico técnico</span>
              <span className="flex items-center gap-1">
                {errorCount > 0 && (
                  <Badge variant="destructive" className="h-4 px-1.5 text-[10px] font-mono">
                    {errorCount} erro{errorCount > 1 ? 's' : ''}
                  </Badge>
                )}
                {warnCount > 0 && (
                  <Badge
                    variant="outline"
                    className="h-4 px-1.5 text-[10px] font-mono border-nexus-amber/50 text-nexus-amber"
                  >
                    {warnCount} aviso{warnCount > 1 ? 's' : ''}
                  </Badge>
                )}
              </span>
            </div>
            <ChevronDown
              className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')}
            />
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-2.5 pb-2.5 pt-1 space-y-2">
            <p className="text-[10px] text-muted-foreground">
              Cada cartão mostra a regra interna que disparou, quantas vezes ocorreu e uma amostra do trecho afetado.
            </p>
            {issues.map((issue) => (
              <DiagnosticCard
                key={issue.id}
                issue={issue}
                onJump={onJumpToLine}
                onApply={onApplyFix ? () => handleApply(issue) : undefined}
              />
            ))}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

interface CardProps {
  issue: PromptDiagnosticIssue;
  onJump?: (line: number) => void;
  onApply?: () => void;
}

function DiagnosticCard({ issue, onJump, onApply }: CardProps) {
  const isError = issue.level === 'error';
  const Icon = isError ? AlertCircle : AlertTriangle;
  const firstLine = issue.sample?.line ?? issue.affectedLines[0];

  return (
    <div
      className={cn(
        'rounded-md border p-2.5 space-y-1.5',
        isError ? 'border-destructive/30 bg-destructive/5' : 'border-nexus-amber/30 bg-nexus-amber/5',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-1.5 min-w-0">
          <Icon className={cn('h-3.5 w-3.5 shrink-0 mt-0.5', isError ? 'text-destructive' : 'text-nexus-amber')} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className={cn('text-xs font-semibold', isError ? 'text-destructive' : 'text-nexus-amber')}>
                {issue.title}
              </span>
              <code className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1 py-0.5 rounded">
                {issue.id}
              </code>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{issue.description}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-[10px] text-muted-foreground pl-5">
        <span>
          Regra: <code className="font-mono bg-muted/60 px-1 py-0.5 rounded">{issue.rulePattern}</code>
        </span>
        <span className="opacity-50">·</span>
        <span className="font-mono">
          {issue.occurrences} ocorrênc{issue.occurrences > 1 ? 'ias' : 'ia'}
        </span>
        {issue.affectedLines.length > 0 && (
          <>
            <span className="opacity-50">·</span>
            <span>
              Linha{issue.affectedLines.length > 1 ? 's' : ''}:{' '}
              <span className="font-mono">{issue.affectedLines.join(', ')}</span>
              {issue.occurrences > issue.affectedLines.length && (
                <span> +{issue.occurrences - issue.affectedLines.length}</span>
              )}
            </span>
          </>
        )}
      </div>

      {issue.sample && (
        <div className="ml-5 rounded border border-border/60 bg-background/60 p-1.5 overflow-x-auto">
          <div className="text-[10px] text-muted-foreground mb-0.5">
            Amostra (linha {issue.sample.line}, col {issue.sample.column}
            {issue.sample.escapedMatch && (
              <>
                {' '}
                · match: <code className="font-mono">{issue.sample.escapedMatch}</code>
              </>
            )}
            ):
          </div>
          <pre className="text-[11px] font-mono whitespace-pre leading-tight m-0">
            {issue.sample.context || '(linha vazia)'}
          </pre>
          <pre
            className={cn(
              'text-[11px] font-mono whitespace-pre leading-tight m-0',
              isError ? 'text-destructive' : 'text-nexus-amber',
            )}
            aria-hidden
          >
            {`${' '.repeat(Math.max(0, issue.sample.matchStart))}${'^'.repeat(Math.max(1, Math.min(issue.sample.matchLength, 20)))}`}
          </pre>
        </div>
      )}

      <div className="flex items-center gap-1.5 pl-5 pt-0.5">
        {firstLine && onJump && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={() => onJump(firstLine)}
          >
            <ArrowRight className="h-3 w-3" />
            Ir para linha {firstLine}
          </Button>
        )}
        {issue.fixerId && onApply && (
          <Button
            type="button"
            size="sm"
            variant="default"
            className="h-6 px-2 text-[10px] gap-1"
            onClick={onApply}
          >
            <Wrench className="h-3 w-3" />
            Aplicar correção
          </Button>
        )}
      </div>
    </div>
  );
}
