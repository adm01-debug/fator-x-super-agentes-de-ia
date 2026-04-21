import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { CompiledPromptPreview } from './CompiledPromptPreview';
import { PromptSectionChecklist } from './PromptSectionChecklist';
import { PromptVariantSelector } from './PromptVariantSelector';
import { QuickAgentTestPanel } from './QuickAgentTestPanel';
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
}

export function StepQuickPrompt({ form, errors, update, onRestore, onApplyVariant }: Props) {
  const activeVariant = detectPromptVariant(form.type as QuickAgentType, form.prompt);
  const len = form.prompt.length;
  const min = 50;
  const max = 8000;
  const pct = Math.min(100, (len / max) * 100);

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

      <div className="nexus-card space-y-2">
        <Label htmlFor="qa-prompt" className="sr-only">System prompt</Label>
        <Textarea
          id="qa-prompt"
          value={form.prompt}
          onChange={(e) => update('prompt', e.target.value)}
          rows={16}
          maxLength={max}
          aria-invalid={!!errors.prompt}
          placeholder="## Persona&#10;...&#10;&#10;## Escopo&#10;...&#10;&#10;## Formato&#10;..."
          className={`bg-secondary/50 border-border/50 font-mono text-xs leading-relaxed resize-none ${
            errors.prompt ? 'border-destructive' : ''
          }`}
        />
        <div className="flex items-center justify-between text-[11px]">
          <div className="text-destructive">{errors.prompt}</div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="h-1 w-24 bg-secondary rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${
                  len < min ? 'bg-destructive' : len > max * 0.9 ? 'bg-nexus-amber' : 'bg-primary'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="font-mono text-muted-foreground">{len.toLocaleString('pt-BR')} / {max.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      </div>

      <PromptSectionChecklist
        prompt={form.prompt}
        onInsert={(snippet) => update('prompt', form.prompt + snippet)}
      />

      <div className="nexus-card">
        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3">Pré-visualização</p>
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center text-2xl shrink-0">
            {form.emoji || '🤖'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-foreground">{form.name || 'Sem nome'}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{form.mission || 'Sem missão definida'}</p>
            <p className="text-[11px] text-muted-foreground mt-2 font-mono">
              modelo: {form.model} · tipo: {form.type}
            </p>
          </div>
        </div>
      </div>

      {/* Consolidated prompt preview — final text the LLM will receive */}
      <CompiledPromptPreview form={form} />
    </div>
  );
}
