import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import {
  type PromptSectionKey,
  type QuickAgentForm,
} from '@/lib/validations/quickAgentSchema';
import { detectPromptContradictions } from '@/lib/validations/promptContradictions';
import { locateSections, insertSectionAt } from '@/lib/promptSectionLocator';
import { CompiledPromptPreview } from './CompiledPromptPreview';
import { PromptSectionChecklist } from './PromptSectionChecklist';
import { PromptSectionUsage } from './PromptSectionUsage';
import { PromptVariantSelector } from './PromptVariantSelector';
import { PromptValidationFeedback } from './PromptValidationFeedback';
import { AgentLivePreviewCard } from './AgentLivePreviewCard';
import { QuickAgentTestPanel } from './QuickAgentTestPanel';
import { RealExamplePreview } from './RealExamplePreview';
import { PreflightReviewSummary } from './PreflightReviewSummary';
import { PromptHistoryPanel } from './PromptHistoryPanel';
import { PromptSectionGutter } from './PromptSectionGutter';
import { PromptHighlightOverlay } from './PromptHighlightOverlay';
import { sanitizePromptInput, PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';
import {
  QUICK_AGENT_TEMPLATES,
  PROMPT_VARIANT_META,
  type QuickAgentType,
  type PromptVariantId,
} from '@/data/quickAgentTemplates';

const EDITOR_PADDING_LEFT = 36; // px — leaves room for the gutter

interface Props {
  form: QuickAgentForm;
  errors: Partial<Record<keyof QuickAgentForm, string>>;
  /**
   * Manual prompt edits (typing, paste, snippet insert, history restore)
   * go through this — the wizard uses it to flip the "custom locked" flag.
   */
  onPromptManualEdit: (next: string) => void;
  onRestore: () => void;
  onApplyVariant: (id: PromptVariantId) => void;
  /** When true, the variant selector is locked into "customizado" mode. */
  customLocked: boolean;
  /** Releases the lock without changing the prompt text. */
  onUnlockCustom: () => void;
  /**
   * The variant chip to highlight as active. Computed by the wizard from
   * `selectedVariant ?? detectPromptVariant(...)` so the user's explicit
   * choice persists across sessions.
   */
  activeVariant: PromptVariantId | null;
  highlightField?: keyof QuickAgentForm;
}

export function StepQuickPrompt({ form, errors, onPromptManualEdit, onRestore, onApplyVariant, customLocked, onUnlockCustom, activeVariant, highlightField }: Props) {
  // Active variant template + label — drives the checklist's per-section snippets
  // and the "Completar com X" CTA in real time.
  const activeVariantPrompt = activeVariant
    ? QUICK_AGENT_TEMPLATES[form.type as QuickAgentType]?.promptVariants[activeVariant]?.prompt ?? null
    : null;
  const activeVariantLabel = activeVariant ? PROMPT_VARIANT_META[activeVariant].label : null;
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const promptHighlight = highlightField === 'prompt';
  // Tracks the source of the most recent prompt change to drive the
  // CompiledPromptPreview's pulse + auto-expand behavior.
  const [lastChangeKind, setLastChangeKind] = useState<'variant' | 'manual' | null>(null);
  // Auto-clear the flag so a re-render doesn't re-trigger animations.
  useEffect(() => {
    if (!lastChangeKind) return;
    const t = window.setTimeout(() => setLastChangeKind(null), 800);
    return () => window.clearTimeout(t);
  }, [lastChangeKind]);

  // Wrappers that record the change kind alongside the prompt mutation.
  const handleManualEdit = (next: string) => {
    setLastChangeKind('manual');
    onPromptManualEdit(next);
  };
  const handleApplyVariant = (id: PromptVariantId) => {
    setLastChangeKind('variant');
    onApplyVariant(id);
  };
  // Snapshot of the prompt before an auto-fix, used by the toast's "Desfazer".
  const prevPromptRef = useRef<string>('');
  const handleApplyFix = (fixed: string, summary: string) => {
    prevPromptRef.current = form.prompt;
    handleManualEdit(fixed);
    toast.success('Correção aplicada', {
      description: summary,
      duration: 5000,
      action: {
        label: 'Desfazer',
        onClick: () => handleManualEdit(prevPromptRef.current),
      },
    });
  };
  // Section-level pulse highlight (set briefly after a "jump to section" action).
  const [pulsedSection, setPulsedSection] = useState<PromptSectionKey | null>(null);
  const sectionPulseRef = useRef<number | null>(null);

  useEffect(() => {
    if (!promptHighlight) return;
    const el = textareaRef.current;
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => el.focus(), 250);
    }
  }, [promptHighlight]);

  // Memoized section locations — drives gutter, overlay, and jump targets.
  const locations = useMemo(() => locateSections(form.prompt), [form.prompt]);
  const totalLines = useMemo(() => form.prompt.split('\n').length, [form.prompt]);
  // Lines (1-indexed) that contain a contradiction — drives overlay red highlight.
  const conflictLines = useMemo(() => {
    const conflicts = detectPromptContradictions(form.prompt);
    const set = new Set<number>();
    for (const c of conflicts) {
      set.add(c.lineA);
      set.add(c.lineB);
    }
    return Array.from(set);
  }, [form.prompt]);

  /**
   * Scroll the textarea to a specific 1-indexed line and select that whole line.
   * Used by the "Conflitos detectados" cards in the preflight summary.
   */
  const jumpToLine = (line: number) => {
    const lines = form.prompt.split('\n');
    const idx = Math.max(0, Math.min(lines.length - 1, line - 1));
    let start = 0;
    for (let i = 0; i < idx; i++) start += lines[i].length + 1;
    const end = start + lines[idx].length;

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '0') || 16;
      el.scrollTop = Math.max(0, idx * lineHeight - el.clientHeight / 3);
      try { el.setSelectionRange(start, end); } catch { /* ignore */ }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  /**
   * Insert a section snippet at its canonical position (Persona → Escopo →
   * Formato → Regras), then return the inserted heading char range so the
   * caller can focus / select it.
   */
  const insertSectionSnippet = (key: PromptSectionKey, snippet: string): [number, number] => {
    const { prompt: nextPrompt, insertedRange } = insertSectionAt(form.prompt, key, snippet);
    handleManualEdit(nextPrompt);
    return insertedRange;
  };

  /**
   * Scroll the textarea, place the caret on the section's heading line,
   * select that line, and apply a brief pulse highlight on the editor.
   * If the section heading isn't present yet, insert a snippet at its canonical
   * position first then jump to it.
   */
  const jumpToSection = (key: PromptSectionKey, snippetIfMissing?: string) => {
    let workingPrompt = form.prompt;
    let selRange: [number, number] | null = null;

    const existing = locations.find((l) => l.key === key);
    if ((!existing || existing.status === 'missing') && snippetIfMissing) {
      const inserted = insertSectionSnippet(key, snippetIfMissing);
      // Recompute working prompt locally for offset math (state hasn't flushed yet).
      const { prompt: np, insertedRange } = insertSectionAt(form.prompt, key, snippetIfMissing);
      workingPrompt = np;
      selRange = insertedRange;
      void inserted;
    } else if (existing && existing.status !== 'missing') {
      selRange = [existing.startChar, Math.min(workingPrompt.length, existing.endChar)];
    }

    // Visual pulse on the editor card.
    setPulsedSection(key);
    if (sectionPulseRef.current) window.clearTimeout(sectionPulseRef.current);
    sectionPulseRef.current = window.setTimeout(() => setPulsedSection(null), 1800);

    if (!selRange) return;
    const [start, end] = selRange;

    // Approximate line index from char offset for scrollTop math.
    const linesUpTo = workingPrompt.slice(0, start).split('\n').length - 1;

    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight || '0') || 16;
      el.scrollTop = Math.max(0, linesUpTo * lineHeight - el.clientHeight / 3);
      try { el.setSelectionRange(start, end); } catch { /* ignore */ }
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  };

  useEffect(() => () => {
    if (sectionPulseRef.current) window.clearTimeout(sectionPulseRef.current);
  }, []);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    // Sanitize silently against control/zero-width chars and dangerous tags.
    const result = sanitizePromptInput(raw, PROMPT_LIMITS.MAX_TOTAL);
    if (result.removedTags > 0) {
      toast.warning('Conteúdo removido por segurança', {
        description: 'Tags HTML perigosas foram filtradas do prompt.',
      });
    }
    handleManualEdit(result.clean);
  };

  const handlePaste = (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const pasted = e.clipboardData.getData('text');
    if (!pasted) return;
    e.preventDefault();

    const ta = textareaRef.current;
    const selStart = ta?.selectionStart ?? form.prompt.length;
    const selEnd = ta?.selectionEnd ?? form.prompt.length;
    const before = form.prompt.slice(0, selStart);
    const after = form.prompt.slice(selEnd);
    const remainingBudget = PROMPT_LIMITS.MAX_TOTAL - (before.length + after.length);

    const result = sanitizePromptInput(pasted, Math.max(0, remainingBudget));
    const next = before + result.clean + after;
    handleManualEdit(next);

    // Restore caret after the pasted block on next tick.
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        const pos = before.length + result.clean.length;
        textareaRef.current.selectionStart = pos;
        textareaRef.current.selectionEnd = pos;
      }
    });

    if (result.warnings.length > 0) {
      toast.warning('Texto colado ajustado', {
        description: result.warnings.join(' '),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-heading font-semibold text-foreground">System Prompt</h2>
          <p className="text-sm text-muted-foreground">Instruções de comportamento do agente.</p>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRestore} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Restaurar template
        </Button>
      </div>

      <PromptVariantSelector
        type={form.type as QuickAgentType}
        activeVariant={activeVariant}
        onSelect={handleApplyVariant}
        customLocked={customLocked}
        onUnlock={onUnlockCustom}
      />

      <div
        className={`nexus-card space-y-3 transition-shadow ${
          pulsedSection ? 'ring-2 ring-nexus-amber/60 shadow-[0_0_0_4px_hsl(var(--nexus-amber)/0.15)]' : ''
        }`}
      >
        <Label htmlFor="qa-prompt" className="sr-only">System prompt</Label>
        {pulsedSection && (
          <div
            role="status"
            aria-live="polite"
            className="text-[11px] text-nexus-amber bg-nexus-amber/10 border border-nexus-amber/30 rounded-md px-2.5 py-1 flex items-center justify-between gap-2"
          >
            <span>
              📍 Ancorado em <strong>## {pulsedSection.charAt(0).toUpperCase() + pulsedSection.slice(1)}</strong> — corrija e clique para sair.
            </span>
          </div>
        )}
        <div className="relative">
          <PromptSectionGutter
            locations={locations}
            totalLines={totalLines}
            activeKey={pulsedSection}
            onJump={(loc) => jumpToSection(loc.key, loc.status === 'missing' ? `## ${loc.label}\n- ` : undefined)}
          />
          <PromptHighlightOverlay
            prompt={form.prompt}
            locations={locations}
            textareaRef={textareaRef}
            paddingLeftPx={EDITOR_PADDING_LEFT}
            conflictLines={conflictLines}
          />
          <Textarea
            ref={textareaRef}
            id="qa-prompt"
            value={form.prompt}
            onChange={handleChange}
            onPaste={handlePaste}
            rows={16}
            maxLength={PROMPT_LIMITS.MAX_TOTAL}
            aria-invalid={!!errors.prompt}
            aria-describedby="qa-prompt-feedback"
            placeholder="## Persona&#10;...&#10;&#10;## Escopo&#10;...&#10;&#10;## Formato&#10;...&#10;&#10;## Regras&#10;..."
            style={{ paddingLeft: EDITOR_PADDING_LEFT, position: 'relative', zIndex: 2, background: 'transparent' }}
            className={`bg-secondary/50 border-border/50 font-mono text-xs leading-relaxed resize-none ${
              errors.prompt ? 'border-destructive' : ''
            } ${promptHighlight ? 'ring-2 ring-warning ring-offset-2 ring-offset-background animate-pulse' : ''} ${
              pulsedSection ? 'border-nexus-amber/50' : ''
            }`}
          />
        </div>
        {errors.prompt && (
          <div className="text-[11px] text-destructive" role="alert">
            {errors.prompt}
          </div>
        )}
        <div id="qa-prompt-feedback">
          <PromptValidationFeedback prompt={form.prompt} onApplyFix={handleApplyFix} />
        </div>
      </div>

      <PromptSectionChecklist
        prompt={form.prompt}
        activeVariantPrompt={activeVariantPrompt}
        activeVariantLabel={activeVariantLabel}
        customLocked={customLocked}
        onInsert={(snippet, key) => {
          if (key) {
            const { prompt: nextPrompt } = insertSectionAt(form.prompt, key, snippet);
            handleManualEdit(nextPrompt);
          } else {
            handleManualEdit(form.prompt + snippet);
          }
        }}
        onJumpToSection={jumpToSection}
      />

      <PromptSectionUsage prompt={form.prompt} onJumpToSection={jumpToSection} />

      <PromptHistoryPanel
        prompt={form.prompt}
        type={form.type}
        onRestore={(restored) => handleManualEdit(restored)}
      />

      <AgentLivePreviewCard form={form} />

      {/* Pre-flight review summary — quick "ready to create?" snapshot */}
      <PreflightReviewSummary form={form} onJumpToSection={jumpToSection} onJumpToLine={jumpToLine} />

      {/* Consolidated prompt preview — final text the LLM will receive (open by default on the last step) */}
      <CompiledPromptPreview
        form={form}
        defaultOpen
        lastChangeKind={lastChangeKind}
        activeVariantLabel={customLocked ? 'Customizado' : activeVariantLabel}
      />

      {/* Real example mode — full payload (system + user + params) as the gateway will receive it */}
      <RealExamplePreview
        form={form}
        activeVariantLabel={customLocked ? 'Customizado' : activeVariantLabel}
        lastChangeKind={lastChangeKind}
      />

      {/* Bateria de testes — múltiplas execuções comparativas contra o LLM */}
      <QuickAgentTestPanel form={form} />
    </div>
  );
}
