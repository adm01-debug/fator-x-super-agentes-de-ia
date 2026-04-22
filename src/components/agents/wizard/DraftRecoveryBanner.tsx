import { Button } from '@/components/ui/button';
import { Check, FileClock, Minus, X } from 'lucide-react';

export interface DraftSummary {
  name: string;
  hasIdentity: boolean;
  hasType: boolean;
  hasModel: boolean;
  hasPrompt: boolean;
}

interface DraftRecoveryBannerProps {
  savedAt: string; // ISO date
  summary: DraftSummary;
  onRestore: () => void;
  onDiscard: () => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'há pouco tempo';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `há ${hr} ${hr === 1 ? 'hora' : 'horas'}`;
  const d = Math.round(hr / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
        ok
          ? 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald'
          : 'border-border/50 bg-secondary/40 text-muted-foreground'
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {label}
    </span>
  );
}

export function DraftRecoveryBanner({
  savedAt,
  summary,
  onRestore,
  onDiscard,
}: DraftRecoveryBannerProps) {
  const subject = summary.name.trim() ? `"${summary.name.trim()}"` : 'sem nome ainda';
  return (
    <div
      role="status"
      aria-live="polite"
      className="nexus-card animate-page-enter border-primary/30 bg-primary/5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <FileClock className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            Rascunho encontrado
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Você começou um agente {subject} {formatRelative(savedAt)}. Quer continuar de onde
            parou?
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <StatusChip label="Identidade" ok={summary.hasIdentity} />
        <StatusChip label="Tipo" ok={summary.hasType} />
        <StatusChip label="Modelo" ok={summary.hasModel} />
        <StatusChip label="Prompt" ok={summary.hasPrompt} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDiscard} className="gap-1.5">
          <X className="h-3.5 w-3.5" /> Descartar
        </Button>
        <Button
          size="sm"
          onClick={onRestore}
          className="gap-1.5 nexus-gradient-bg text-primary-foreground"
        >
          Continuar de onde parei
        </Button>
      </div>
    </div>
  );
}
