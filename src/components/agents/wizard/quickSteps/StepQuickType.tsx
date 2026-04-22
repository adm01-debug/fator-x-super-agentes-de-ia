import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Sparkles, Check } from 'lucide-react';
import {
  QUICK_AGENT_TEMPLATES,
  QUICK_AGENT_TYPES,
  type QuickAgentType,
} from '@/data/quickAgentTemplates';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { useFieldHighlight, useFieldHighlightClass } from './useFieldHighlight';

interface Props {
  form: QuickAgentForm;
  errors: Partial<Record<keyof QuickAgentForm, string>>;
  update: <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => void;
  applyTemplate: (type: QuickAgentType) => void;
  highlightField?: keyof QuickAgentForm;
}

export function StepQuickType({ form, errors, update, applyTemplate, highlightField }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pulsing = useFieldHighlight(gridRef, highlightField === 'type');
  const selectedTemplate = form.type ? QUICK_AGENT_TEMPLATES[form.type as QuickAgentType] : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground">Tipo do agente</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o papel principal — depois você pode aplicar um template pronto.
        </p>
      </div>

      <div ref={gridRef} className={`grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-lg p-2 ${pulsing ? FIELD_HIGHLIGHT_CLS : ''}`}>
        {QUICK_AGENT_TYPES.map((t) => {
          const selected = form.type === t.id;
          const tpl = QUICK_AGENT_TEMPLATES[t.id];
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => update('type', t.id)}
              className={`nexus-card text-left transition-all relative ${
                selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{tpl.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm text-foreground">{t.label}</p>
                  <p className="text-[11px] text-muted-foreground">Sugerido: {tpl.suggestedName}</p>
                </div>
                {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
              </div>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          );
        })}
      </div>

      {errors.type && <p className="text-xs text-destructive">{errors.type}</p>}

      {selectedTemplate && (
        <div className="nexus-card flex flex-col sm:flex-row sm:items-center gap-3 bg-primary/5 border-primary/20">
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Template "{selectedTemplate.suggestedName}" disponível
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Preenche nome, missão, modelo recomendado ({selectedTemplate.recommendedModel}) e um system prompt completo.
            </p>
          </div>
          <Button
            type="button"
            variant="default"
            size="sm"
            onClick={() => applyTemplate(form.type as QuickAgentType)}
            className="gap-1.5 shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5" /> Aplicar template
          </Button>
        </div>
      )}
    </div>
  );
}
