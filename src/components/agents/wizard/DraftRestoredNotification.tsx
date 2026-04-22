import { CheckCircle2, FileText, AlertCircle, ArrowRight } from 'lucide-react';
import type { DraftResumeTarget } from './draftStore';

export interface DraftRestoredNotificationProps {
  draftName: string;
  mode: 'full' | 'partial';
  stepLabel?: string;
  fieldLabel?: string;
  errorType?: DraftResumeTarget['errorType'];
  onJumpToField?: () => void;
  onDismiss: () => void;
}

const ERROR_TYPE_LABEL: Record<NonNullable<DraftResumeTarget['errorType']>, string> = {
  required: 'Obrigatório',
  too_small: 'Muito curto',
  too_big: 'Muito longo',
  invalid_type: 'Tipo inválido',
  custom: 'Regra de negócio',
  unknown: 'Validação',
};

/**
 * Mini-notificação rica usada como conteúdo de um toast Sonner customizado
 * logo após o usuário restaurar um rascunho. Confirma visualmente:
 *   - de qual rascunho veio (nome + modo: completo/parcial),
 *   - em qual passo o wizard parou,
 *   - qual foi o primeiro campo inválido detectado (com tipo de erro).
 *
 * Quando há campo destacado, expõe um CTA "Ir ao campo" que dispara o mesmo
 * handler do banner de feedback — assim o usuário tem dupla confirmação
 * (toast efêmero + banner persistente) sem perder o foco.
 */
export function DraftRestoredNotification({
  draftName,
  mode,
  stepLabel,
  fieldLabel,
  errorType,
  onJumpToField,
  onDismiss,
}: DraftRestoredNotificationProps) {
  const errorLabel = errorType ? ERROR_TYPE_LABEL[errorType] : null;
  const hasField = !!fieldLabel;

  return (
    <div className="flex items-start gap-3 w-full">
      <div className="h-8 w-8 rounded-md bg-primary/15 flex items-center justify-center shrink-0">
        <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden />
      </div>

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[13px] font-semibold text-foreground truncate">
            Rascunho restaurado
          </span>
          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-secondary/60 text-muted-foreground border border-border/50">
            {mode === 'partial' ? 'Parcial' : 'Completo'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
          <FileText className="h-3 w-3 shrink-0" aria-hidden />
          <span className="font-mono font-medium text-foreground truncate" title={draftName}>
            {draftName || 'sem nome'}
          </span>
          {stepLabel && (
            <>
              <span className="opacity-50">·</span>
              <span className="truncate">passo: <span className="text-foreground">{stepLabel}</span></span>
            </>
          )}
        </div>

        {hasField && (
          <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
            <AlertCircle className="h-3 w-3 text-warning shrink-0" aria-hidden />
            <span className="text-[11px] text-muted-foreground">primeiro campo a corrigir:</span>
            <span className="text-[11px] font-mono font-semibold text-foreground bg-secondary/60 px-1.5 py-0.5 rounded border border-border/50">
              {fieldLabel}
            </span>
            {errorLabel && (
              <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-warning/10 text-warning border border-warning/30">
                {errorLabel}
              </span>
            )}
          </div>
        )}

        {hasField && onJumpToField && (
          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                onJumpToField();
                onDismiss();
              }}
              className="inline-flex items-center gap-1 h-6 px-2 rounded-md text-[11px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Ir ao campo <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
