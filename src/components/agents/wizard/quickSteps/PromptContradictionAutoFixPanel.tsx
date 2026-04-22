/**
 * One-click auto-fix panel for detected rule contradictions.
 *
 * For each conflict we present a "unified" version of the rules (chosen
 * deterministically by `buildContradictionAutoFixes`) plus actions to:
 *   - Pré-visualizar (open a diff dialog showing before/after)
 *   - Aplicar (splice the unified rule into the prompt and remove the conflicting line)
 *   - Aplicar tudo (sequentially resolves every conflict, re-detecting after
 *     each splice so line numbers stay consistent).
 *
 * Designed to sit ABOVE the existing PromptAutoFixPanel because contradictions
 * block agent creation and have higher priority than housekeeping fixes.
 */
import { useEffect, useMemo, useState } from 'react';
import { GitMerge, Eye, Wand2, Sparkles, Undo2 } from 'lucide-react';
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
import { ContradictionWordDiff } from './ContradictionWordDiff';
import {
  buildContradictionAutoFixes,
  applyAllContradictionFixes,
  buildContradictionFixFromSuggestion,
  suggestContradictionRewrites,
  type ContradictionAutoFix,
} from '@/lib/validations/contradictionSuggestions';
import { CONTRADICTION_KIND_LABEL, type PromptContradiction } from '@/lib/validations/promptContradictions';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  /** Same shape as PromptAutoFixPanel — receives the full new prompt + a toast summary. */
  onApply: (fixed: string, summary: string) => void;
}

interface PreviewState {
  open: boolean;
  title: string;
  fixedPrompt: string;
  summary: string;
  /** When set, render the per-conflict word-level diff instead of the full
   *  prompt diff. Absent for the "Apply all" preview which spans many lines. */
  fix?: ContradictionAutoFix;
}

export function PromptContradictionAutoFixPanel({ prompt, onApply }: Props) {
  const fixes = useMemo(() => buildContradictionAutoFixes(prompt), [prompt]);
  const allAtOnce = useMemo(
    () => (fixes.length > 1 ? applyAllContradictionFixes(prompt) : null),
    [fixes.length, prompt],
  );

  const [preview, setPreview] = useState<PreviewState>({
    open: false,
    title: '',
    fixedPrompt: '',
    summary: '',
  });

  // Histórico de 1 nível: guarda o snapshot do prompt + resumo da última
  // aplicação. Permite "Desfazer" em um clique enquanto o usuário ainda
  // não fez outra edição manual. Invalidado quando o prompt externo muda
  // por algum caminho que não seja a próxima aplicação deste painel.
  const [lastApplied, setLastApplied] = useState<{
    previousPrompt: string;
    appliedPrompt: string;
    summary: string;
    appliedAt: number;
  } | null>(null);

  // Se o prompt externo divergiu do que aplicamos por último (ex: usuário
  // digitou no editor, mudou variante, restaurou snapshot), o histórico
  // perde a referência segura — limpamos para evitar undo "fantasma".
  useEffect(() => {
    if (!lastApplied) return;
    if (prompt !== lastApplied.appliedPrompt) {
      setLastApplied(null);
    }
  }, [prompt, lastApplied]);

  if (fixes.length === 0 && !lastApplied) return null;

  const openPreview = (
    title: string,
    fixedPrompt: string,
    summary: string,
    fix?: ContradictionAutoFix,
  ) => {
    setPreview({ open: true, title, fixedPrompt, summary, fix });
  };

  const applyAndRecord = (fixedPrompt: string, summary: string) => {
    setLastApplied({
      previousPrompt: prompt,
      appliedPrompt: fixedPrompt,
      summary,
      appliedAt: Date.now(),
    });
    onApply(fixedPrompt, summary);
  };

  const closePreview = () =>
    setPreview({ open: false, title: '', fixedPrompt: '', summary: '', fix: undefined });

  const applyFromPreview = () => {
    applyAndRecord(preview.fixedPrompt, preview.summary);
    closePreview();
  };

  const undoLast = () => {
    if (!lastApplied) return;
    onApply(lastApplied.previousPrompt, `Desfeito: ${lastApplied.summary}`);
    setLastApplied(null);
  };

  return (
    <>
      <div className="space-y-2">
      {fixes.length > 0 && (
        <div className="rounded-lg border border-nexus-amber/40 bg-nexus-amber/5 p-2.5 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <p className="text-xs font-semibold text-nexus-amber flex items-center gap-1.5">
              <GitMerge className="h-3.5 w-3.5" />
              Corrigir contradições automaticamente ({fixes.length})
            </p>
            {allAtOnce && allAtOnce.resolved > 0 && (
              <Button
                type="button"
                size="sm"
                variant="default"
                onClick={() =>
                  openPreview(
                    'Aplicar todas as correções de contradições',
                    allAtOnce.fixedPrompt,
                    `${allAtOnce.resolved} contradição(ões) resolvida(s) em sequência.`,
                  )
                }
                className="h-7 gap-1.5 text-[11px] bg-nexus-amber hover:bg-nexus-amber/90 text-background"
              >
                <Sparkles className="h-3 w-3" />
                🪄 Resolver tudo ({allAtOnce.resolved})
              </Button>
            )}
          </div>

          <ul className="space-y-1.5">
            {fixes.map((fix, idx) => (
              <FixRow
                key={idx}
                prompt={prompt}
                conflict={fix.conflict}
                onPreview={(builtFix) =>
                  openPreview(
                    `Unificar regras (${CONTRADICTION_KIND_LABEL[builtFix.conflict.kind]})`,
                    builtFix.fixedPrompt,
                    `Linhas ${builtFix.conflict.lineA} e ${builtFix.conflict.lineB} substituídas pela sugestão escolhida.`,
                  )
                }
                onApply={(builtFix) =>
                  applyAndRecord(
                    builtFix.fixedPrompt,
                    `Contradição (${CONTRADICTION_KIND_LABEL[builtFix.conflict.kind]}) resolvida nas linhas ${builtFix.conflict.lineA} ↔ ${builtFix.conflict.lineB}.`,
                  )
                }
              />
            ))}
          </ul>
        </div>
      )}

      {/* Banner de "Desfazer" — só aparece enquanto o prompt externo bate
          com o que aplicamos por último (sem edição manual no meio). */}
      {lastApplied && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/5 px-2.5 py-2"
        >
          <Undo2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" aria-hidden />
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-[11px] font-semibold text-foreground">
              Última correção de contradição aplicada
            </p>
            <p className="text-[10px] text-muted-foreground leading-snug truncate" title={lastApplied.summary}>
              {lastApplied.summary}
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={undoLast}
            className="h-7 gap-1 text-[11px] border-primary/40 text-primary hover:bg-primary/10 hover:text-primary shrink-0"
            aria-label="Desfazer a última aplicação do painel de contradições"
          >
            <Undo2 className="h-3 w-3" /> Desfazer
          </Button>
        </div>
      )}
      </div>

      <AlertDialog
        open={preview.open}
        onOpenChange={(open) =>
          !open && setPreview({ open: false, title: '', fixedPrompt: '', summary: '' })
        }
      >
        <AlertDialogContent className="max-w-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-nexus-amber" />
              {preview.title}
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <p className="text-xs">{preview.summary}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="my-2 max-h-[420px] overflow-auto">
            <PromptDiff
              textA={prompt}
              textB={preview.fixedPrompt}
              labelA="Atual (com contradição)"
              labelB="Após unificação"
            />
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={applyFromPreview}
              className="bg-nexus-amber hover:bg-nexus-amber/90 text-background"
            >
              Aplicar correção
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ------------------------------- FixRow ------------------------------- */

interface FixRowProps {
  prompt: string;
  conflict: PromptContradiction;
  onPreview: (builtFix: ContradictionAutoFix) => void;
  onApply: (builtFix: ContradictionAutoFix) => void;
}

/**
 * Linha de uma contradição com seletor de sugestão unificada.
 *
 * O usuário pode escolher entre 2–3 reescritas geradas por
 * `suggestContradictionRewrites` (ex.: manter o positivo, adicionar exceção,
 * reformular como condicional). A sugestão escolhida é usada como a "regra
 * unificada" pelo `buildContradictionFixFromSuggestion` — o splice em si
 * é o mesmo, só muda o texto que substitui as duas linhas conflitantes.
 *
 * Estado local porque a escolha é efêmera e não precisa subir até o wizard.
 */
function FixRow({ prompt, conflict, onPreview, onApply }: FixRowProps) {
  const suggestions = useMemo(() => suggestContradictionRewrites(conflict), [conflict]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const builtFix = useMemo(
    () => buildContradictionFixFromSuggestion(prompt, conflict, selectedIdx),
    [prompt, conflict, selectedIdx],
  );
  const { unifiedRule, rationale } = builtFix;

  return (
    <li className="flex flex-col gap-2 text-xs bg-background/60 rounded-md px-2 py-1.5 border border-border/40">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <span
            className={cn(
              'shrink-0 mt-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-mono font-semibold uppercase tracking-wider',
              'bg-nexus-amber/20 text-nexus-amber',
            )}
          >
            {CONTRADICTION_KIND_LABEL[conflict.kind]}
          </span>
          <div className="min-w-0 space-y-0.5 flex-1">
            <p className="text-foreground font-medium">
              Linhas {conflict.lineA} ↔ {conflict.lineB} → regra unificada
            </p>
            <p className="text-[10px] font-mono text-muted-foreground/90 truncate" title={unifiedRule}>
              {unifiedRule}
            </p>
            <p className="text-[10px] text-muted-foreground/70 leading-snug">{rationale}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => onPreview(builtFix)}
            className="h-7 gap-1 text-[11px]"
            aria-label={`Pré-visualizar correção da contradição nas linhas ${conflict.lineA} e ${conflict.lineB}`}
          >
            <Eye className="h-3 w-3" /> Prévia
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onApply(builtFix)}
            className="h-7 gap-1 text-[11px] border-nexus-amber/40 text-nexus-amber hover:bg-nexus-amber/10 hover:text-nexus-amber"
            aria-label={`Aplicar correção da contradição nas linhas ${conflict.lineA} e ${conflict.lineB}`}
          >
            <Wand2 className="h-3 w-3" /> Aplicar
          </Button>
        </div>
      </div>

      {/* Seletor de sugestões — chips clicáveis com a estratégia de cada
          reescrita. Só aparece quando há mais de uma opção disponível. */}
      {suggestions.length > 1 && (
        <fieldset className="flex flex-wrap items-center gap-1.5 pl-1">
          <legend className="sr-only">
            Escolha qual sugestão unificada usar para esta contradição
          </legend>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70 mr-1">
            Sugestão:
          </span>
          {suggestions.map((s, i) => {
            const active = i === selectedIdx;
            return (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedIdx(i)}
                aria-pressed={active}
                title={s.rationale}
                className={cn(
                  'h-6 px-2 rounded-full text-[10px] font-medium border transition-colors',
                  active
                    ? 'bg-nexus-amber/20 text-nexus-amber border-nexus-amber/40'
                    : 'bg-secondary/40 text-muted-foreground border-border/50 hover:bg-secondary',
                )}
              >
                {s.title}
              </button>
            );
          })}
        </fieldset>
      )}
    </li>
  );
}
