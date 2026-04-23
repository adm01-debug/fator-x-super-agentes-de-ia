/**
 * Manual-copy fallback dialog.
 *
 * Shown when `navigator.clipboard.writeText` is unavailable or denied
 * (insecure contexts, permission policy, focus issues, restrictive iframes).
 * Displays the value in a pre-selected textarea so the user can copy it
 * manually with Ctrl/Cmd+C.
 *
 * Also tries one extra fallback path: `document.execCommand('copy')` on the
 * textarea selection — some browsers still allow it even when the modern
 * Clipboard API rejects.
 */
import { useEffect, useRef, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface ManualCopyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The value the user wanted to copy. */
  value: string;
  /** Optional human-readable label (e.g. "URL do painel"). */
  label?: string;
  /** Optional reason text shown above the textarea. */
  reason?: string;
}

export function ManualCopyDialog({
  open,
  onOpenChange,
  value,
  label = 'Conteúdo',
  reason,
}: ManualCopyDialogProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [retryStatus, setRetryStatus] = useState<'idle' | 'success'>('idle');

  // Auto-select the value on open so the user can immediately Ctrl/Cmd+C.
  useEffect(() => {
    if (!open) {
      setRetryStatus('idle');
      return;
    }
    // Defer one tick so the textarea is in the DOM and focusable.
    const id = window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.select();
    }, 50);
    return () => window.clearTimeout(id);
  }, [open]);

  const handleRetry = () => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.focus();
    ta.select();
    // Last-ditch attempt — older API but still works in some sandboxed
    // contexts where the async Clipboard API is blocked.
    try {
      const ok = document.execCommand('copy');
      if (ok) {
        setRetryStatus('success');
        window.setTimeout(() => setRetryStatus('idle'), 2000);
      }
    } catch {
      /* execCommand can throw — fall through, user will copy manually. */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Copiar manualmente</DialogTitle>
          <DialogDescription>
            {reason ?? 'Não foi possível acessar a área de transferência automaticamente.'}
            {' '}Selecione o texto abaixo e use <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono">Ctrl</kbd>
            {' '}+ <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono">C</kbd>
            {' '}(ou <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono">⌘</kbd>
            {' '}+ <kbd className="px-1.5 py-0.5 rounded border bg-muted text-[11px] font-mono">C</kbd>) para copiar.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="manual-copy-textarea">
            {label}
          </label>
          <textarea
            id="manual-copy-textarea"
            ref={textareaRef}
            readOnly
            value={value}
            rows={3}
            className="w-full font-mono text-xs p-3 rounded-md border border-input bg-secondary/30 focus-ring resize-none break-all"
            onFocus={(e) => e.currentTarget.select()}
            onClick={(e) => e.currentTarget.select()}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          <Button
            size="sm"
            onClick={handleRetry}
            aria-label="Tentar copiar novamente"
            className="gap-1.5"
          >
            {retryStatus === 'success' ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Tentar copiar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
