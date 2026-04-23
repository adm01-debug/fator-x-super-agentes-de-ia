/**
 * RestoreValidationPanel — exibe issues de pré-validação do rollback.
 * Errors aparecem com tom destrutivo e bloqueiam a confirmação;
 * warnings ficam em âmbar e são apenas informativos.
 */
import { AlertOctagon, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Info } from 'lucide-react';
import { useState } from 'react';
import type { RestoreValidation, ValidationIssue } from './restoreValidation';

interface Props {
  validation: RestoreValidation;
}

const groupLabel: Record<ValidationIssue['group'], string> = {
  prompt: 'Prompt',
  tools: 'Ferramentas',
  model: 'Modelo',
  general: 'Geral',
};

export function RestoreValidationPanel({ validation }: Props) {
  const { errors, warnings, issues } = validation;

  if (issues.length === 0) {
    return (
      <div
        role="status"
        className="flex items-center gap-2 rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 px-3 py-2 text-xs text-nexus-emerald"
      >
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>Validação OK — nenhuma incompatibilidade detectada.</span>
      </div>
    );
  }

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-lg border overflow-hidden ${
        errors.length
          ? 'border-destructive/40 bg-destructive/[0.04]'
          : 'border-nexus-amber/40 bg-nexus-amber/[0.04]'
      }`}
    >
      <header
        className={`flex items-center justify-between gap-2 px-3 py-2 border-b ${
          errors.length
            ? 'bg-destructive/[0.07] border-destructive/25'
            : 'bg-nexus-amber/[0.07] border-nexus-amber/25'
        }`}
      >
        <div className="flex items-center gap-1.5">
          {errors.length ? (
            <AlertOctagon className="h-3.5 w-3.5 text-destructive" aria-hidden />
          ) : (
            <AlertTriangle className="h-3.5 w-3.5 text-nexus-amber" aria-hidden />
          )}
          <h4 className={`text-xs font-semibold ${errors.length ? 'text-destructive' : 'text-nexus-amber'}`}>
            {errors.length
              ? `${errors.length} erro${errors.length === 1 ? '' : 's'} ${
                  warnings.length ? `· ${warnings.length} aviso${warnings.length === 1 ? '' : 's'}` : ''
                }`
              : `${warnings.length} aviso${warnings.length === 1 ? '' : 's'}`}
          </h4>
        </div>
        <span className="text-[10px] font-mono text-muted-foreground">
          {errors.length ? 'rollback bloqueado' : 'rollback permitido'}
        </span>
      </header>

      <ul className="divide-y divide-border/40">
        {issues.map((issue) => (
          <IssueRow key={issue.id} issue={issue} />
        ))}
      </ul>
    </div>
  );
}

function IssueRow({ issue }: { issue: ValidationIssue }) {
  const [open, setOpen] = useState(issue.severity === 'error');
  const isError = issue.severity === 'error';
  const Icon = isError ? AlertOctagon : Info;
  const tone = isError ? 'text-destructive' : 'text-nexus-amber';

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <Icon className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${tone}`} aria-hidden />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={`text-[11px] font-semibold ${isError ? 'text-foreground' : 'text-foreground/90'}`}>
              {issue.title}
            </span>
            <span className="text-[9px] font-mono uppercase tracking-wider px-1 py-0.5 rounded bg-muted/60 text-muted-foreground">
              {groupLabel[issue.group]}
            </span>
          </div>
        </div>
        {open ? (
          <ChevronDown className="h-3 w-3 mt-1 text-muted-foreground shrink-0" aria-hidden />
        ) : (
          <ChevronRight className="h-3 w-3 mt-1 text-muted-foreground shrink-0" aria-hidden />
        )}
      </button>
      {open && (
        <div className="px-3 pb-2.5 pl-8 space-y-1">
          <p className="text-[11px] text-foreground/85 leading-relaxed">{issue.detail}</p>
          {issue.hint && (
            <p className="text-[10px] text-muted-foreground italic border-l-2 border-border pl-2">
              💡 {issue.hint}
            </p>
          )}
        </div>
      )}
    </li>
  );
}
