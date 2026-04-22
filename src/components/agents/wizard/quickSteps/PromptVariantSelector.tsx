import { Scale, Minus, Plus, Sparkles, Lock, Unlock } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  QUICK_AGENT_TEMPLATES,
  PROMPT_VARIANT_META,
  type QuickAgentType,
  type PromptVariantId,
} from '@/data/quickAgentTemplates';
import { PromptUnlockDiffDialog } from './PromptUnlockDiffDialog';

interface Props {
  type: QuickAgentType;
  /** Variação detectada como ativa, ou null se o prompt é customizado. */
  activeVariant: PromptVariantId | null;
  onSelect: (id: PromptVariantId) => void;
  /**
   * When true, the user manually edited the prompt and the variant chips
   * are intentionally locked into "customizado" — auto-detection is disabled
   * until the user picks a variant or explicitly unlocks.
   */
  customLocked?: boolean;
  /** Called when the user clicks "Sair do modo customizado". */
  onUnlock?: () => void;
  /** Current prompt text — needed to render the unlock diff preview. */
  currentPrompt?: string;
}

const ICONS = {
  scale: Scale,
  minus: Minus,
  plus: Plus,
} as const;

const ORDER: PromptVariantId[] = ['balanced', 'concise', 'detailed'];

export function PromptVariantSelector({ type, activeVariant, onSelect, customLocked, onUnlock, currentPrompt }: Props) {
  const template = QUICK_AGENT_TEMPLATES[type];
  const isCustom = activeVariant === null;
  const showLocked = !!customLocked && isCustom;

  return (
    <div className="nexus-card space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Variações de prompt para "{template.suggestedName}"
          </p>
          <p className="text-[11px] text-muted-foreground">
            {showLocked
              ? 'Modo customizado travado — clique numa variação para substituir o texto atual.'
              : 'Escolha um estilo para preencher o editor — você pode editar depois.'}
          </p>
        </div>
        {isCustom && (
          <div className="flex items-center gap-1.5 shrink-0">
            <span
              className={cn(
                'text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1',
                showLocked
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber',
              )}
              title={
                showLocked
                  ? 'Edição manual detectada — chips não vão alternar automaticamente.'
                  : 'O texto não bate exatamente com nenhuma variação.'
              }
            >
              {showLocked ? <Lock className="h-2.5 w-2.5" /> : null}
              customizado
            </span>
            {showLocked && onUnlock && currentPrompt !== undefined ? (
              <PromptUnlockDiffDialog
                type={type}
                currentPrompt={currentPrompt}
                onApplyVariant={onSelect}
                onKeepText={onUnlock}
                trigger={
                  <button
                    type="button"
                    className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                    title="Ver prévia do que muda em cada variação antes de destravar. Atalho: Ctrl/Cmd+U destrava direto."
                  >
                    <Unlock className="h-2.5 w-2.5" />
                    Sair do modo custom
                    <kbd className="ml-1 hidden sm:inline-flex items-center gap-0.5 px-1 rounded border border-border/60 bg-background/60 text-[9px] font-mono text-muted-foreground">
                      ⌘U
                    </kbd>
                  </button>
                }
              />
            ) : (
              showLocked && onUnlock && (
                <button
                  type="button"
                  onClick={onUnlock}
                  className="text-[10px] inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-border/60 bg-secondary/50 text-muted-foreground hover:text-foreground hover:bg-secondary/80 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                  title="Manter o texto e voltar à detecção automática das variações."
                >
                  <Unlock className="h-2.5 w-2.5" />
                  Sair do modo custom
                </button>
              )
            )}
          </div>
        )}
      </div>

      <div
        role="radiogroup"
        aria-label="Variações de prompt"
        className="grid grid-cols-1 sm:grid-cols-3 gap-2"
      >
        {ORDER.map((id) => {
          const meta = PROMPT_VARIANT_META[id];
          const Icon = ICONS[meta.icon];
          const isActive = activeVariant === id;
          const charCount = template.promptVariants[id].prompt.length;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              onClick={() => onSelect(id)}
              className={cn(
                'group text-left rounded-lg border px-3 py-2.5 transition-all',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                isActive
                  ? 'border-primary bg-primary/10 ring-1 ring-primary/40'
                  : 'border-border bg-secondary/40 hover:bg-secondary/70 hover:border-border/80',
                showLocked && !isActive && 'opacity-70',
              )}
              title={
                showLocked
                  ? `Substituir o prompt customizado pela variação "${meta.label}"`
                  : undefined
              }
            >
              <div className="flex items-center gap-2 mb-1">
                <Icon
                  className={cn(
                    'h-3.5 w-3.5 shrink-0',
                    isActive ? 'text-primary' : 'text-muted-foreground',
                  )}
                  aria-hidden
                />
                <span
                  className={cn(
                    'text-xs font-semibold',
                    isActive ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {meta.label}
                </span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground/80">
                  {charCount.toLocaleString('pt-BR')}c
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                {meta.description}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
