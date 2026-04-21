import { AlertTriangle, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { VersionValidationResult, VersionValidationIssue } from '@/lib/validations/agentVersionValidator';

interface VersionValidationPanelProps {
  result: VersionValidationResult;
}

function IssueRow({ issue }: { issue: VersionValidationIssue }) {
  const isError = issue.level === 'error';
  const Icon = isError ? ShieldAlert : AlertTriangle;
  const color = isError ? 'text-destructive' : 'text-nexus-amber';
  return (
    <li className="flex items-start gap-2 text-xs">
      <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${color}`} aria-hidden />
      <div className="min-w-0 flex-1">
        <span className={`${color} font-medium`}>{isError ? 'Erro' : 'Aviso'}</span>
        <span className="text-foreground/90"> · {issue.message}</span>
        <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{issue.code}</span>
      </div>
    </li>
  );
}

export function VersionValidationPanel({ result }: VersionValidationPanelProps) {
  const { errors, warnings } = result;
  const total = errors.length + warnings.length;

  if (total === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="rounded-lg border border-nexus-emerald/30 bg-nexus-emerald/5 p-2.5 flex items-center gap-2"
      >
        <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" aria-hidden />
        <span className="text-xs text-nexus-emerald font-medium">Validações OK — pronto para salvar</span>
      </div>
    );
  }

  const headerColor = errors.length > 0 ? 'text-destructive' : 'text-nexus-amber';
  const borderColor =
    errors.length > 0
      ? 'border-destructive/30 bg-destructive/5'
      : 'border-nexus-amber/30 bg-nexus-amber/5';

  return (
    <div
      role={errors.length > 0 ? 'alert' : 'status'}
      aria-live="polite"
      className={`rounded-lg border ${borderColor} p-2.5 space-y-2`}
    >
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium ${headerColor} flex items-center gap-1.5`}>
          <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
          Validação antes de salvar
        </span>
        <span className="text-[11px] text-muted-foreground font-mono">
          {errors.length} {errors.length === 1 ? 'erro' : 'erros'} · {warnings.length} {warnings.length === 1 ? 'aviso' : 'avisos'}
        </span>
      </div>
      <ul className="space-y-1.5">
        {errors.map((e) => (
          <IssueRow key={`${e.code}-${e.message}`} issue={e} />
        ))}
        {warnings.map((w) => (
          <IssueRow key={`${w.code}-${w.message}`} issue={w} />
        ))}
      </ul>
    </div>
  );
}
