import { useMemo, useState } from 'react';
import { Wand2, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { PromptDiff } from '@/components/prompts/PromptDiff';
import {
  detectAvailableFixes,
  applyAllFixes,
  type AvailableFix,
  type FixResult,
} from '@/lib/promptAutoFixers';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  onApply: (fixed: string, summary: string) => void;
}

interface PreviewState {
  open: boolean;
  title: string;
  result: FixResult | null;
}

export function PromptAutoFixPanel({ prompt, onApply }: Props) {
  const fixes = useMemo(() => detectAvailableFixes(prompt), [prompt]);
  const allFix = useMemo(() => (fixes.length > 1 ? applyAllFixes(prompt) : null), [fixes.length, prompt]);

  const [preview, setPreview] = useState<PreviewState>({ open: false, title: '', result: null });

  if (fixes.length === 0) return null;

  const openPreview = (title: string, result: FixResult) => {
    setPreview({ open: true, title, result });
  };

  const applyFromPreview = () => {
    if (preview.result) {
      onApply(preview.result.fixed, preview.result.summary);
    }
    setPreview({ open: false, title: '', result: null });
  };

  return (
    <>
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs font-semibold text-primary flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Correções automáticas disponíveis
          </p>
          {allFix && (
            <Button
              type="button"
              size="sm"
              variant="default"
              onClick={() => openPreview('Aplicar todas as correções', allFix)}
              className="h-7 gap-1.5 text-[11px]"
            >
              <Wand2 className="h-3 w-3" />
              🪄 Aplicar tudo ({fixes.length})
            </Button>
          )}
        </div>

        <ul className="space-y-1.5">
          {fixes.map((fix) => (
            <FixRow
              key={fix.id}
              fix={fix}
              onPreview={() => openPreview(`${fix.icon} ${fix.label}`, fix.result)}
              onApply={() => onApply(fix.result.fixed, fix.result.summary)}
            />
          ))}
        </ul>
      </div>

      <AlertDialog
        open={preview.open}
        onOpenChange={(open) => !open && setPreview({ open: false, title: '', result: null })}
      >
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              {preview.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p className="text-xs">{preview.result?.summary}</p>
                <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono">
                  {preview.result && preview.result.removedChars !== 0 && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full border',
                        preview.result.removedChars > 0
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald',
                      )}
                    >
                      {preview.result.removedChars > 0 ? '−' : '+'}
                      {Math.abs(preview.result.removedChars).toLocaleString('pt-BR')} chars
                    </span>
                  )}
                  {preview.result && preview.result.removedLines !== 0 && (
                    <span
                      className={cn(
                        'px-2 py-0.5 rounded-full border',
                        preview.result.removedLines > 0
                          ? 'border-destructive/30 bg-destructive/10 text-destructive'
                          : 'border-nexus-amber/30 bg-nexus-amber/10 text-nexus-amber',
                      )}
                    >
                      {preview.result.removedLines > 0 ? '−' : '+'}
                      {Math.abs(preview.result.removedLines)} linhas
                    </span>
                  )}
                  {preview.result && preview.result.affectedLines.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full border border-border bg-secondary/40 text-muted-foreground">
                      {preview.result.affectedLines.length} linha(s) afetada(s)
                    </span>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>

          {preview.result && (
            <div className="my-2 max-h-[420px] overflow-auto">
              <PromptDiff
                textA={prompt}
                textB={preview.result.fixed}
                labelA="Atual"
                labelB="Após correção"
              />
            </div>
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={applyFromPreview}>Aplicar correção</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

interface FixRowProps {
  fix: AvailableFix;
  onPreview: () => void;
  onApply: () => void;
}

function FixRow({ fix, onPreview, onApply }: FixRowProps) {
  return (
    <li className="flex items-center justify-between gap-2 text-xs bg-background/50 rounded-md px-2 py-1.5 border border-border/40">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-base shrink-0" aria-hidden>
          {fix.icon}
        </span>
        <div className="min-w-0">
          <p className="text-foreground font-medium truncate">{fix.label}</p>
          <p className="text-[10px] font-mono text-muted-foreground">{fix.result.description}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onPreview}
          className="h-7 gap-1 text-[11px]"
          aria-label={`Pré-visualizar correção: ${fix.label}`}
        >
          <Eye className="h-3 w-3" /> Prévia
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onApply}
          className="h-7 gap-1 text-[11px] border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
          aria-label={`Aplicar correção: ${fix.label}`}
        >
          <Wand2 className="h-3 w-3" /> Aplicar
        </Button>
      </div>
    </li>
  );
}
