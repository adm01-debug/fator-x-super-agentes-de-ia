import { AlertCircle } from 'lucide-react';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import type { DraftResumeTarget } from '../draftStore';

export interface FieldValidationHintInfo {
  /** Tipo do erro classificado (mesma taxonomia do RestoreFeedbackBanner). */
  errorType?: DraftResumeTarget['errorType'];
  /** Mensagem original vinda do schema. */
  errorMessage?: string;
}

interface Props {
  info: FieldValidationHintInfo;
  /** ID do campo que esta hint descreve — usado para `aria-describedby` no input. */
  id?: string;
  className?: string;
}

const ERROR_TYPE_LABEL: Record<NonNullable<DraftResumeTarget['errorType']>, string> = {
  required: 'Obrigatório',
  too_small: 'Muito curto',
  too_big: 'Muito longo',
  invalid_type: 'Tipo inválido',
  custom: 'Regra de negócio',
  unknown: 'Validação',
};

const ERROR_TYPE_TONE: Record<NonNullable<DraftResumeTarget['errorType']>, string> = {
  required: 'border-destructive/40 bg-destructive/10 text-destructive',
  too_small: 'border-warning/40 bg-warning/10 text-warning',
  too_big: 'border-warning/40 bg-warning/10 text-warning',
  invalid_type: 'border-destructive/40 bg-destructive/10 text-destructive',
  custom: 'border-primary/40 bg-primary/10 text-primary',
  unknown: 'border-border bg-secondary/40 text-muted-foreground',
};

/**
 * Hint inline exibida ao lado do campo destacado durante a retomada do
 * rascunho. Espelha o tipo + mensagem do `RestoreFeedbackBanner`, mas em
 * formato compacto para ficar próximo ao input — assim o usuário vê o
 * motivo da validação imediatamente, sem precisar olhar para o topo.
 *
 * Auto-anima com `slide-in` salvo quando o usuário pediu redução de movimento.
 */
export function FieldValidationHint({ info, id, className = '' }: Props) {
  const reduced = usePrefersReducedMotion();
  const errorType = info.errorType ?? 'unknown';
  const tone = ERROR_TYPE_TONE[errorType];
  const label = ERROR_TYPE_LABEL[errorType];
  const animation = reduced ? '' : 'animate-in fade-in slide-in-from-left-2 duration-300';

  return (
    <div
      id={id}
      role="status"
      aria-live="polite"
      className={`mt-1.5 flex items-start gap-2 rounded-md border px-2.5 py-1.5 ${tone} ${animation} ${className}`}
    >
      <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-semibold uppercase tracking-wider">
            {label}
          </span>
          <span className="text-[10px] opacity-70">— motivo da validação</span>
        </div>
        {info.errorMessage && (
          <p className="text-[11px] leading-snug italic opacity-90">
            "{info.errorMessage}"
          </p>
        )}
      </div>
    </div>
  );
}
