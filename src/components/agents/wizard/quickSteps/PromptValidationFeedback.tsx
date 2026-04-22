import { AlertCircle, AlertTriangle, FileText } from 'lucide-react';
import { analyzePromptStructure, getPromptIssues, PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';
import { PromptAutoFixPanel } from './PromptAutoFixPanel';

interface Props {
  prompt: string;
  /** When provided, shows 1-click auto-fix actions for any detected issues. */
  onApplyFix?: (fixed: string, summary: string) => void;
}

export function PromptValidationFeedback({ prompt, onApplyFix }: Props) {
  const stats = analyzePromptStructure(prompt);
  const issues = getPromptIssues(prompt);

  const charPct = Math.min(100, (stats.charCount / PROMPT_LIMITS.MAX_TOTAL) * 100);
  const linePct = Math.min(100, (stats.lineCount / PROMPT_LIMITS.MAX_LINES) * 100);
  const charDanger = stats.charCount < PROMPT_LIMITS.MIN_TOTAL || stats.exceedsCharLimit;
  const charWarn = stats.charCount > PROMPT_LIMITS.MAX_TOTAL * 0.9;
  const lineDanger = stats.exceedsLineLimit;
  const lineWarn = stats.lineCount > PROMPT_LIMITS.MAX_LINES * 0.9;

  const errors = issues.filter((i) => i.level === 'error');
  const warnings = issues.filter((i) => i.level === 'warning');

  return (
    <div className="space-y-2">
      {/* Counters */}
      <div className="flex items-center justify-between gap-4 text-[11px] flex-wrap">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="h-3 w-3" />
          <span className="font-mono">
            {stats.charCount.toLocaleString('pt-BR')} / {PROMPT_LIMITS.MAX_TOTAL.toLocaleString('pt-BR')} chars
          </span>
          <span className="opacity-50">·</span>
          <span className="font-mono">
            {stats.lineCount} / {PROMPT_LIMITS.MAX_LINES} linhas
          </span>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <div className="flex flex-col gap-0.5">
            <div className="h-1 w-24 bg-secondary rounded-full overflow-hidden" aria-label="Progresso de caracteres">
              <div
                className={`h-full transition-all ${
                  charDanger ? 'bg-destructive' : charWarn ? 'bg-nexus-amber' : 'bg-primary'
                }`}
                style={{ width: `${charPct}%` }}
              />
            </div>
            <div className="h-1 w-24 bg-secondary rounded-full overflow-hidden" aria-label="Progresso de linhas">
              <div
                className={`h-full transition-all ${
                  lineDanger ? 'bg-destructive' : lineWarn ? 'bg-nexus-amber' : 'bg-primary/60'
                }`}
                style={{ width: `${linePct}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Errors (blocking) */}
      {errors.length > 0 && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 space-y-1"
        >
          {errors.map((e, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-destructive">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{e.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Warnings (non-blocking) */}
      {warnings.length > 0 && (
        <div
          role="status"
          aria-live="polite"
          className="rounded-lg border border-nexus-amber/30 bg-nexus-amber/5 p-2.5 space-y-1"
        >
          {warnings.map((w, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-nexus-amber">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
