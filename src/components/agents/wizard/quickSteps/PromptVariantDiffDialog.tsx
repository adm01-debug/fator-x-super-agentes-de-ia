import { useMemo } from 'react';
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
import { PromptDiff, diffLines } from '@/components/prompts/PromptDiff';
import { Lock, GitCompare } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrompt: string;
  currentLabel: string;
  nextPrompt: string;
  nextLabel: string;
  customLocked: boolean;
  onConfirm: () => void;
}

export function PromptVariantDiffDialog({
  open,
  onOpenChange,
  currentPrompt,
  currentLabel,
  nextPrompt,
  nextLabel,
  customLocked,
  onConfirm,
}: Props) {
  const stats = useMemo(() => {
    if (!open) return { added: 0, removed: 0, same: 0 };
    const { linesA, linesB } = diffLines(currentPrompt, nextPrompt);
    const removed = linesA.filter((l) => l.type === 'removed').length;
    const added = linesB.filter((l) => l.type === 'added').length;
    const same = linesA.filter((l) => l.type === 'same' && l.text !== '').length;
    return { added, removed, same };
  }, [open, currentPrompt, nextPrompt]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Trocar para "{nextLabel}"?
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-2">
              <p>
                {customLocked ? (
                  <>
                    <Lock className="inline h-3 w-3 mr-1 text-primary" />
                    Você editou o prompt manualmente ({currentPrompt.length.toLocaleString('pt-BR')} chars).
                    Aplicar <strong>"{nextLabel}"</strong> vai sobrescrever o texto atual e destravar o modo customizado.
                  </>
                ) : (
                  <>
                    Substituir o prompt de <strong>"{currentLabel}"</strong> por <strong>"{nextLabel}"</strong>.
                    Revise as diferenças abaixo antes de confirmar.
                  </>
                )}
              </p>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className="text-nexus-emerald">+{stats.added} adicionadas</span>
                <span className="text-destructive">−{stats.removed} removidas</span>
                <span className="text-muted-foreground">{stats.same} inalteradas</span>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="max-h-[55vh] overflow-y-auto -mx-1 px-1">
          <PromptDiff
            textA={currentPrompt}
            textB={nextPrompt}
            labelA={`Atual — ${currentLabel}`}
            labelB={`Nova — ${nextLabel}`}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Aplicar "{nextLabel}"</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
