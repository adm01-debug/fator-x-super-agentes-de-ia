import { useRef, type ChangeEvent, type ClipboardEvent } from 'react';
import { toast } from 'sonner';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { CompiledPromptPreview } from './CompiledPromptPreview';
import { PromptSectionChecklist } from './PromptSectionChecklist';
import { PromptVariantSelector } from './PromptVariantSelector';
import { PromptValidationFeedback } from './PromptValidationFeedback';
import { AgentLivePreviewCard } from './AgentLivePreviewCard';
import { QuickAgentTestPanel } from './QuickAgentTestPanel';
import { sanitizePromptInput, PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';
import {
  detectPromptVariant,
  type QuickAgentType,
  type PromptVariantId,
} from '@/data/quickAgentTemplates';

interface Props {
  form: QuickAgentForm;
  errors: Partial<Record<keyof QuickAgentForm, string>>;
  update: <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => void;
  onRestore: () => void;
  onApplyVariant: (id: PromptVariantId) => void;
  highlightField?: keyof QuickAgentForm;
}

export function StepQuickPrompt({ form, errors, update, onRestore, onApplyVariant, highlightField }: Props) {
  const activeVariant = detectPromptVariant(form.type as QuickAgentType, form.prompt);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useRef; // keep ref import used
  const promptHighlight = highlightField === 'prompt';
  // Scroll + focus when highlighted
  // eslint-disable-next-line react-hooks/rules-of-hooks
  useEffectOnHighlight(promptHighlight, textareaRef);

  const handleChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const raw = e.target.value;
    // Sanitize silently against control/zero-width chars and dangerous tags.
    const result = sanitizePromptInput(raw, PROMPT_LIMITS.MAX_TOTAL);
    if (result.removedTags > 0) {
      toast.warning('Conteúdo removido por segurança', {
        description: 'Tags HTML perigosas foram filtradas do prompt.',
      });
    }
    update('prompt', result.clean);
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
    update('prompt', next);

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
        onSelect={onApplyVariant}
      />

      <div className="nexus-card space-y-3">
        <Label htmlFor="qa-prompt" className="sr-only">System prompt</Label>
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
          className={`bg-secondary/50 border-border/50 font-mono text-xs leading-relaxed resize-none ${
            errors.prompt ? 'border-destructive' : ''
          }`}
        />
        {errors.prompt && (
          <div className="text-[11px] text-destructive" role="alert">
            {errors.prompt}
          </div>
        )}
        <div id="qa-prompt-feedback">
          <PromptValidationFeedback prompt={form.prompt} />
        </div>
      </div>

      <PromptSectionChecklist
        prompt={form.prompt}
        onInsert={(snippet) => update('prompt', form.prompt + snippet)}
      />

      <AgentLivePreviewCard form={form} />

      {/* Consolidated prompt preview — final text the LLM will receive */}
      <CompiledPromptPreview form={form} />

      {/* Live test against the LLM with mock payload */}
      <QuickAgentTestPanel form={form} />
    </div>
  );
}
