import { useState } from 'react';
import { AlertCircle, ArrowRight, Check, Link2, X } from 'lucide-react';
import type { DraftResumeTarget } from './draftStore';

export interface RestoreFeedbackInfo extends DraftResumeTarget {
  /** Label legível do campo (ex: "Missão" em vez de "mission"). */
  fieldLabel?: string;
  /** Modo de restauração que produziu este feedback. */
  mode: 'full' | 'partial';
}

interface Props {
  info: RestoreFeedbackInfo;
  onJumpToField: () => void;
  onDismiss: () => void;
}

// Tradução do tipo de erro vindo do zod para uma label curta e visual.
const ERROR_TYPE_LABEL: Record<NonNullable<DraftResumeTarget['errorType']>, string> = {
  required: 'Campo obrigatório',
  too_small: 'Muito curto',
  too_big: 'Muito longo',
  invalid_type: 'Tipo inválido',
  custom: 'Regra de negócio',
  unknown: 'Erro de validação',
};

const ERROR_TYPE_TONE: Record<NonNullable<DraftResumeTarget['errorType']>, string> = {
  required: 'border-destructive/40 bg-destructive/10 text-destructive',
  too_small: 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber',
  too_big: 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber',
  invalid_type: 'border-destructive/40 bg-destructive/10 text-destructive',
  custom: 'border-primary/40 bg-primary/10 text-primary',
  unknown: 'border-border/50 bg-secondary/40 text-muted-foreground',
};

/**
 * Banner inline que aparece logo após o usuário restaurar um rascunho,
 * destacando o primeiro erro encontrado: tipo, campo, passo e mensagem.
 * Espelha o `highlightField` — quando o usuário corrige o campo, o banner
 * é dispensado pelo wizard.
 */
export function RestoreFeedbackBanner({ info, onJumpToField, onDismiss }: Props) {
  const errorType = info.errorType ?? 'unknown';
  const typeLabel = ERROR_TYPE_LABEL[errorType];
  const typeTone = ERROR_TYPE_TONE[errorType];
  const fieldLabel = info.fieldLabel ?? info.field ?? '—';

  return (
    <div
      role="status"
      aria-live="polite"
      className="nexus-card animate-page-enter border-primary/30 bg-primary/5 flex items-start gap-3 py-2.5 px-3"
    >
      <div className="h-7 w-7 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
        <AlertCircle className="h-3.5 w-3.5 text-primary" aria-hidden />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground/70">
            Restaurado{info.mode === 'partial' ? ' (parcial)' : ''} — primeiro item a corrigir
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border font-medium ${typeTone}`}>
            {typeLabel}
          </span>
          <span className="text-[11px] text-muted-foreground">no campo</span>
          <span className="text-[12px] font-mono font-semibold text-foreground bg-secondary/60 px-1.5 py-0.5 rounded border border-border/50">
            {fieldLabel}
          </span>
          {info.stepLabel && (
            <>
              <span className="text-[11px] text-muted-foreground/60">·</span>
              <span className="text-[11px] text-muted-foreground">passo {info.stepLabel}</span>
            </>
          )}
        </div>

        {info.errorMessage && (
          <p className="text-[11px] text-muted-foreground italic leading-snug">
            "{info.errorMessage}"
          </p>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={onJumpToField}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
          title="Rolar até o campo destacado"
        >
          Ir ao campo <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onDismiss}
          className="h-7 w-7 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
          aria-label="Dispensar resumo do erro"
          title="Dispensar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
