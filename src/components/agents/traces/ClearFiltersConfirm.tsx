/**
 * ClearFiltersConfirm — wraps a trigger with a confirmation modal listing
 * the currently active filters that will be reset. Includes a session-scoped
 * "don't ask again" bypass.
 */
import { useState, type ReactNode } from 'react';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { AlertTriangle } from 'lucide-react';

const BYPASS_KEY = 'nexus.traces.clearFilters.skipConfirm';

export function shouldSkipClearConfirm(): boolean {
  try { return sessionStorage.getItem(BYPASS_KEY) === '1'; } catch { return false; }
}

export function setSkipClearConfirm(skip: boolean) {
  try {
    if (skip) sessionStorage.setItem(BYPASS_KEY, '1');
    else sessionStorage.removeItem(BYPASS_KEY);
  } catch { /* ignore */ }
}

interface Props {
  trigger: ReactNode;
  activeFilters: Array<{ label: string; value: string }>;
  onConfirm: () => void;
}

export function ClearFiltersConfirm({ trigger, activeFilters, onConfirm }: Props) {
  const [skip, setSkip] = useState(false);
  const [open, setOpen] = useState(false);

  // If user already opted out this session, run directly via a wrapper.
  if (shouldSkipClearConfirm()) {
    return (
      <span
        onClick={(e) => { e.stopPropagation(); onConfirm(); }}
        onKeyDown={(e) => { if (e.key === 'Enter') onConfirm(); }}
        role="button"
        tabIndex={-1}
        className="contents"
      >
        {trigger}
      </span>
    );
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-nexus-amber" />
            Limpar filtros e preferências?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              <p>
                Os seguintes filtros voltarão ao padrão e suas preferências sincronizadas
                na sua conta também serão removidas:
              </p>
              {activeFilters.length === 0 ? (
                <p className="text-xs italic">Nenhum filtro ativo no momento.</p>
              ) : (
                <ul className="text-xs space-y-1 bg-muted/40 rounded-md p-2.5 max-h-40 overflow-y-auto">
                  {activeFilters.map((f) => (
                    <li key={f.label}>
                      <span className="font-medium">{f.label}:</span>{' '}
                      <span className="text-muted-foreground">{f.value}</span>
                    </li>
                  ))}
                </ul>
              )}
              <label className="flex items-center gap-2 text-xs cursor-pointer">
                <Checkbox checked={skip} onCheckedChange={(v) => setSkip(v === true)} />
                <span>Não perguntar novamente nesta sessão</span>
              </label>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              setSkipClearConfirm(skip);
              onConfirm();
            }}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Limpar tudo
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
