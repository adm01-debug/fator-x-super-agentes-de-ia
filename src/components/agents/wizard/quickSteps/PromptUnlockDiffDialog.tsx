/**
 * PromptUnlockDiffDialog
 * Triggered from the "Sair do modo customizado" button. Shows a side-by-side
 * before/after diff against each available variant of the current agent type
 * so the user can see exactly which lines would be replaced if they choose
 * to restore — or keep the text and just release the lock.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PromptDiff, diffLines } from '@/components/prompts/PromptDiff';
import { Unlock, GitCompare, Check, ArrowLeftRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  QUICK_AGENT_TEMPLATES,
  PROMPT_VARIANT_META,
  type QuickAgentType,
  type PromptVariantId,
} from '@/data/quickAgentTemplates';

const ORDER: PromptVariantId[] = ['balanced', 'concise', 'detailed'];

interface Props {
  trigger: ReactNode;
  type: QuickAgentType;
  /** Current prompt text in the editor (the "before" side). */
  currentPrompt: string;
  /** Apply a variant — replaces the editor text and clears the custom lock. */
  onApplyVariant: (id: PromptVariantId) => void;
  /** Just release the custom lock without changing any text. */
  onKeepText: () => void;
}

export function PromptUnlockDiffDialog({
  trigger,
  type,
  currentPrompt,
  onApplyVariant,
  onKeepText,
}: Props) {
  const [open, setOpen] = useState(false);
  const [target, setTarget] = useState<PromptVariantId>('balanced');
  const template = QUICK_AGENT_TEMPLATES[type];

  // Per-variant diff stats so the radio cards can advertise the impact
  // ("12 linhas a mais", "idêntico ao texto atual", etc.) without making
  // the user open each one.
  const stats = useMemo(() => {
    const out: Record<PromptVariantId, { added: number; removed: number; identical: boolean }> = {
      balanced: { added: 0, removed: 0, identical: false },
      concise: { added: 0, removed: 0, identical: false },
      detailed: { added: 0, removed: 0, identical: false },
    };
    for (const id of ORDER) {
      const next = template.promptVariants[id].prompt;
      const { linesA, linesB } = diffLines(currentPrompt, next);
      const removed = linesA.filter((l) => l.type === 'removed').length;
      const added = linesB.filter((l) => l.type === 'added').length;
      out[id] = {
        added,
        removed,
        identical: currentPrompt.trim() === next.trim(),
      };
    }
    return out;
  }, [currentPrompt, template]);

  const targetVariant = template.promptVariants[target];
  const targetMeta = PROMPT_VARIANT_META[target];
  const targetStats = stats[target];

  const handleKeep = () => {
    onKeepText();
    setOpen(false);
  };

  const handleRestore = () => {
    onApplyVariant(target);
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitCompare className="h-4 w-4 text-primary" />
            Sair do modo customizado
          </DialogTitle>
          <DialogDescription>
            Escolha como sair: mantenha o texto atual e apenas libere a detecção
            automática, ou substitua pelo conteúdo de uma variação. A prévia
            mostra exatamente o que será removido (vermelho) e adicionado
            (verde).
          </DialogDescription>
        </DialogHeader>

        {/* Variant picker — each card shows the per-variant diff stats */}
        <div role="radiogroup" aria-label="Variação alvo" className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ORDER.map((id) => {
            const meta = PROMPT_VARIANT_META[id];
            const s = stats[id];
            const isActive = target === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => setTarget(id)}
                className={cn(
                  'text-left rounded-lg border px-3 py-2 transition-all',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                  isActive
                    ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                    : 'border-border bg-secondary/40 hover:bg-secondary/70',
                )}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={cn('text-xs font-semibold', isActive ? 'text-primary' : 'text-foreground')}>
                    {meta.label}
                  </span>
                  {s.identical && (
                    <span className="ml-auto inline-flex items-center gap-0.5 text-[10px] font-mono text-nexus-emerald">
                      <Check className="h-2.5 w-2.5" />
                      idêntico
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug mb-1.5">{meta.description}</p>
                {!s.identical && (
                  <div className="flex items-center gap-2 text-[10px] font-mono">
                    <span className="text-nexus-emerald">+{s.added}</span>
                    <span className="text-destructive">−{s.removed}</span>
                    <span className="text-muted-foreground">linhas</span>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Diff preview */}
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/60 bg-secondary/40 text-[11px] text-muted-foreground">
            <ArrowLeftRight className="h-3 w-3" />
            <span className="font-medium text-foreground">Texto atual</span>
            <span className="opacity-50">→</span>
            <span className="font-medium text-foreground">Variação "{targetMeta.label}"</span>
            <span className="ml-auto font-mono">
              {targetStats.identical ? (
                <span className="text-nexus-emerald">sem mudanças</span>
              ) : (
                <>
                  <span className="text-nexus-emerald">+{targetStats.added}</span>{' '}
                  <span className="text-destructive">−{targetStats.removed}</span>
                </>
              )}
            </span>
          </div>
          <div className="max-h-[45vh] overflow-y-auto">
            {targetStats.identical ? (
              <p className="text-xs text-muted-foreground italic py-6 px-3 text-center">
                O texto atual é idêntico a esta variação — restaurar não muda nada.
              </p>
            ) : (
              <PromptDiff
                textA={currentPrompt}
                textB={targetVariant.prompt}
                labelA="Atual"
                labelB={targetMeta.label}
              />
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2 flex-col sm:flex-row">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button variant="outline" onClick={handleKeep} className="gap-1.5">
            <Unlock className="h-3.5 w-3.5" />
            Manter texto e destravar
          </Button>
          <Button onClick={handleRestore} disabled={targetStats.identical} className="gap-1.5">
            <GitCompare className="h-3.5 w-3.5" />
            Restaurar para "{targetMeta.label}"
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
