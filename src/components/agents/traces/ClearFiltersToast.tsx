/**
 * Custom Sonner toast shown after "Limpar filtros" — lists exactly which
 * filters were reset, which storage keys were cleared, and offers Undo (5s).
 */
import { Undo2, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface ClearedField {
  label: string;
  from: string;
  to: string;
}

interface Props {
  toastId: string | number;
  cleared: ClearedField[];
  storageKeys: string[];
  onUndo: () => void;
  onClose: () => void;
}

export function ClearFiltersToast({ toastId, cleared, storageKeys, onUndo, onClose }: Props) {
  return (
    <div className="w-[360px] rounded-xl bg-card/95 backdrop-blur-xl border border-border/50 shadow-2xl p-4 space-y-3"
         role="status"
         aria-label="Filtros limpos">
      <div className="flex items-start gap-2">
        <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight">Filtros limpos</p>
          <p className="text-[11px] text-muted-foreground">
            {cleared.length} {cleared.length === 1 ? 'filtro voltou' : 'filtros voltaram'} ao padrão
          </p>
        </div>
      </div>

      {cleared.length > 0 && (
        <ul className="space-y-1 text-[11px] max-h-32 overflow-y-auto pr-1">
          {cleared.map((c) => (
            <li key={c.label} className="flex items-baseline gap-1.5">
              <span className="font-medium text-foreground/90">{c.label}:</span>
              <span className="text-muted-foreground line-through">{c.from}</span>
              <span className="text-muted-foreground">→</span>
              <span className="text-foreground">{c.to}</span>
            </li>
          ))}
        </ul>
      )}

      {storageKeys.length > 0 && (
        <div className="flex items-start gap-1.5 text-[10px] text-muted-foreground bg-muted/40 rounded-md p-2">
          <Trash2 className="h-3 w-3 mt-0.5 shrink-0" />
          <div className="min-w-0">
            Removido do storage:{' '}
            {storageKeys.map((k, i) => (
              <span key={k}>
                <code className="font-mono text-[10px]">{k}</code>
                {i < storageKeys.length - 1 ? ', ' : ''}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => { onUndo(); onClose(); }}
          className="h-7 text-xs gap-1.5"
        >
          <Undo2 className="h-3 w-3" /> Desfazer
        </Button>
        <button
          onClick={onClose}
          className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar notificação"
        >
          Dispensar
        </button>
      </div>
      {/* eslint-disable-next-line @typescript-eslint/no-unused-expressions */}
      {toastId && null}
    </div>
  );
}
