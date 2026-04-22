import { useEffect, useMemo, useState } from 'react';
import { History, RotateCcw, Trash2, Check, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import {
  loadPromptHistory,
  pushPromptSnapshot,
  deletePromptSnapshot,
  clearPromptHistory,
  type PromptSnapshot,
} from '../promptHistoryStore';

interface Props {
  prompt: string;
  type?: string;
  /** Called when user picks a snapshot to restore — replaces the editor content. */
  onRestore: (prompt: string) => void;
}

const AUTOSAVE_DELAY_MS = 2500;

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return iso;
  const sec = Math.round(diff / 1000);
  if (sec < 5) return 'agora';
  if (sec < 60) return `há ${sec}s`;
  const min = Math.round(sec / 60);
  if (min < 60) return `há ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `há ${h} h`;
  const d = Math.round(h / 24);
  return `há ${d} d`;
}

function formatAbsolute(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function PromptHistoryPanel({ prompt, type, onRestore }: Props) {
  const [snapshots, setSnapshots] = useState<PromptSnapshot[]>(() => loadPromptHistory());
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [justSavedAt, setJustSavedAt] = useState<string | null>(null);

  // Debounced autosave
  useEffect(() => {
    const t = window.setTimeout(() => {
      const { snapshots: next, added } = pushPromptSnapshot(snapshots, prompt, type);
      if (added) {
        setSnapshots(next);
        setJustSavedAt(next[0].savedAt);
      }
    }, AUTOSAVE_DELAY_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, type]);

  // Periodically refresh "há Xs" labels
  const [, setTick] = useState(0);
  useEffect(() => {
    const i = window.setInterval(() => setTick((n) => n + 1), 30_000);
    return () => window.clearInterval(i);
  }, []);

  const lastSavedLabel = useMemo(() => {
    if (snapshots.length === 0) return null;
    return formatRelative(snapshots[0].savedAt);
  }, [snapshots, justSavedAt]);

  const handleRestore = (snap: PromptSnapshot) => {
    onRestore(snap.prompt);
    toast.success('Prompt restaurado', {
      description: `Versão de ${formatAbsolute(snap.savedAt)}`,
    });
  };

  const handleDelete = (id: string) => {
    setSnapshots(deletePromptSnapshot(snapshots, id));
    setConfirmId(null);
    toast('Versão removida do histórico');
  };

  const handleClearAll = () => {
    setSnapshots(clearPromptHistory());
    setConfirmClearAll(false);
    toast('Histórico limpo');
  };

  return (
    <div className="nexus-card">
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center justify-between gap-2">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 text-sm font-medium text-foreground hover:text-primary transition-colors"
            >
              {open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              <History className="h-4 w-4" />
              <span>Histórico do prompt</span>
              <Badge variant="secondary" className="ml-1 text-[10px]">
                {snapshots.length}
              </Badge>
            </button>
          </CollapsibleTrigger>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            {lastSavedLabel ? (
              <span className="flex items-center gap-1">
                <Check className="h-3 w-3 text-primary" />
                Salvo {lastSavedLabel}
              </span>
            ) : (
              <span>Aguardando edição…</span>
            )}
          </div>
        </div>

        <CollapsibleContent className="mt-3 space-y-2">
          {snapshots.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              Nenhuma versão salva ainda. Edite o prompt — uma cópia será salva automaticamente.
            </p>
          ) : (
            <>
              <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {snapshots.map((s, idx) => {
                  const isCurrent = s.prompt === prompt;
                  return (
                    <li
                      key={s.id}
                      className={`flex items-start gap-2 rounded-md border px-2.5 py-2 transition-colors ${
                        isCurrent
                          ? 'border-primary/40 bg-primary/5'
                          : 'border-border/50 bg-secondary/30 hover:bg-secondary/60'
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-medium text-foreground">
                            {idx === 0 ? 'Mais recente' : `Versão ${snapshots.length - idx}`}
                          </span>
                          {isCurrent && (
                            <Badge variant="outline" className="text-[10px] border-primary/40 text-primary">
                              atual
                            </Badge>
                          )}
                          <span
                            className="text-[10px] text-muted-foreground"
                            title={formatAbsolute(s.savedAt)}
                          >
                            {formatRelative(s.savedAt)} · {formatAbsolute(s.savedAt)}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 truncate font-mono">
                          {s.length} chars · {s.prompt.trim().slice(0, 80) || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1"
                          onClick={() => handleRestore(s)}
                          disabled={isCurrent}
                        >
                          <RotateCcw className="h-3 w-3" />
                          Restaurar
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmId(s.id)}
                          aria-label="Remover versão"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
              <div className="flex justify-end pt-1">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-[11px] text-muted-foreground hover:text-destructive"
                  onClick={() => setConfirmClearAll(true)}
                >
                  Limpar histórico
                </Button>
              </div>
            </>
          )}
        </CollapsibleContent>
      </Collapsible>

      <AlertDialog open={!!confirmId} onOpenChange={(o) => !o && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover esta versão?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta cópia salva do prompt será apagada do histórico local. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmId && handleDelete(confirmId)}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirmClearAll} onOpenChange={setConfirmClearAll}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar todo o histórico?</AlertDialogTitle>
            <AlertDialogDescription>
              Todas as {snapshots.length} versões salvas do prompt serão apagadas. Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAll}>Limpar tudo</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
