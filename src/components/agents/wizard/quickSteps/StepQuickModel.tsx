import { useRef } from 'react';
import { Badge } from '@/components/ui/badge';
import { Check, Star } from 'lucide-react';
import { MODELS } from '../wizardConstants';
import { QUICK_AGENT_TEMPLATES, type QuickAgentType } from '@/data/quickAgentTemplates';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { useFieldHighlight, useFieldHighlightClass } from './useFieldHighlight';

interface Props {
  form: QuickAgentForm;
  errors: Partial<Record<keyof QuickAgentForm, string>>;
  update: <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => void;
  highlightField?: keyof QuickAgentForm;
}

export function StepQuickModel({ form, errors, update, highlightField }: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const pulsing = useFieldHighlight(gridRef, highlightField === 'model');
  const ringCls = useFieldHighlightClass(pulsing);

  const recommended = form.type
    ? QUICK_AGENT_TEMPLATES[form.type as QuickAgentType]?.recommendedModel
    : null;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground">Modelo base</h2>
        <p className="text-sm text-muted-foreground">
          Escolha o LLM. Marcamos com ⭐ o recomendado para o tipo selecionado.
        </p>
      </div>

      <div ref={gridRef} className={`grid gap-3 sm:grid-cols-2 rounded-lg p-2 ${ringCls}`}>
        {MODELS.map((m) => {
          const selected = form.model === m.id;
          const isRecommended = recommended === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => update('model', m.id)}
              className={`nexus-card text-left transition-all relative ${
                selected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-secondary/60'
              }`}
            >
              <div className="flex items-center justify-between mb-2 gap-2">
                <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                  {isRecommended && <Star className="h-3.5 w-3.5 fill-nexus-amber text-nexus-amber" />}
                  {m.name}
                </span>
                <Badge variant="outline" className="text-[11px]">{m.provider}</Badge>
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                <span>Custo: <strong className="text-foreground">{m.cost}</strong></span>
                <span>Velocidade: <strong className="text-foreground">{m.speed}</strong></span>
                <span>Qualidade: <strong className="text-foreground">{m.quality}</strong></span>
              </div>
              {selected && <Check className="h-4 w-4 text-primary absolute top-3 right-3" />}
            </button>
          );
        })}
      </div>

      {errors.model && <p className="text-xs text-destructive">{errors.model}</p>}
    </div>
  );
}
