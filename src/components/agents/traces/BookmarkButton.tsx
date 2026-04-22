import { useEffect, useState } from 'react';
import { Bookmark, BookmarkCheck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import {
  findBookmark, removeBookmark, upsertBookmark, type TraceBookmark,
} from '@/lib/traceBookmarks';
import { toast } from 'sonner';

interface Props {
  sessionId: string;
  traceId: string;
  stepIndex: number;
  /** Visual variant for trigger button. */
  variant?: 'icon' | 'inline';
  /** Notified after a save/delete so parents can refresh their bookmark list. */
  onChange?: (bookmarks: TraceBookmark[]) => void;
}

/** Toggle/edit a step bookmark with an optional free-text note. */
export function BookmarkButton({
  sessionId, traceId, stepIndex, variant = 'icon', onChange,
}: Props) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [existing, setExisting] = useState<TraceBookmark | undefined>(undefined);

  // Re-read state whenever the popover opens or the target changes.
  useEffect(() => {
    if (!sessionId || !traceId) return;
    const found = findBookmark(sessionId, traceId);
    setExisting(found);
    setNote(found?.note ?? '');
  }, [sessionId, traceId, open]);

  const isMarked = !!existing;

  const handleSave = () => {
    const next = upsertBookmark(sessionId, {
      traceId,
      stepIndex,
      note: note.trim(),
      updatedAt: new Date().toISOString(),
    });
    onChange?.(next);
    setOpen(false);
    toast.success(isMarked ? 'Marcador atualizado' : 'Passo marcado', {
      description: note.trim() ? `"${note.trim().slice(0, 60)}"` : `Passo #${stepIndex + 1}`,
    });
  };

  const handleRemove = () => {
    const next = removeBookmark(sessionId, traceId);
    onChange?.(next);
    setOpen(false);
    toast.success('Marcador removido', { description: `Passo #${stepIndex + 1}` });
  };

  const Trigger = (
    <Button
      type="button"
      size={variant === 'icon' ? 'icon' : 'sm'}
      variant={isMarked ? 'secondary' : 'outline'}
      className={cn(
        variant === 'icon' ? 'h-7 w-7' : 'h-7 px-2 gap-1.5 text-[11px]',
        isMarked && 'text-nexus-amber border-nexus-amber/40 bg-nexus-amber/10 hover:bg-nexus-amber/20',
      )}
      aria-label={isMarked ? 'Editar marcador' : 'Marcar este passo'}
      title={isMarked ? `Editar marcador${existing?.note ? `: "${existing.note}"` : ''}` : 'Marcar este passo (com anotação opcional)'}
      onClick={(e) => { e.stopPropagation(); setOpen(true); }}
    >
      {isMarked
        ? <BookmarkCheck className={cn(variant === 'icon' ? 'h-3.5 w-3.5' : 'h-3 w-3')} />
        : <Bookmark className={cn(variant === 'icon' ? 'h-3.5 w-3.5' : 'h-3 w-3')} />}
      {variant === 'inline' && (isMarked ? 'Marcado' : 'Marcar')}
    </Button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{Trigger}</PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-72 p-3 space-y-2"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          {isMarked
            ? <BookmarkCheck className="h-3.5 w-3.5 text-nexus-amber" />
            : <Bookmark className="h-3.5 w-3.5 text-primary" />}
          <p className="text-xs font-semibold text-foreground">
            {isMarked ? 'Editar marcador' : 'Marcar passo'} <span className="font-mono text-muted-foreground">#{stepIndex + 1}</span>
          </p>
        </div>
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Anotação opcional (ex: erro de timeout aqui, validar prompt, etc.)"
          rows={3}
          className="text-xs resize-none"
          maxLength={280}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleSave(); }
          }}
        />
        <p className="text-[10px] text-muted-foreground">
          {note.length}/280 · <kbd className="font-mono">⌘/Ctrl+Enter</kbd> para salvar
        </p>
        <div className="flex items-center justify-between gap-2 pt-1">
          {isMarked ? (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={handleRemove}
            >
              <Trash2 className="h-3 w-3 mr-1" /> Remover
            </Button>
          ) : <span />}
          <div className="flex items-center gap-1.5">
            <Button type="button" size="sm" variant="ghost" className="h-7 text-[11px]" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="h-7 text-[11px]" onClick={handleSave}>
              Salvar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
