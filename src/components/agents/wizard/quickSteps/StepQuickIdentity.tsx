import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { FIELD_HIGHLIGHT_CLS } from './useFieldHighlight';
import { expandAncestorContainers } from './expandAncestorContainers';
import { FieldValidationHint, type FieldValidationHintInfo } from './FieldValidationHint';

const EMOJI_SUGGESTIONS = ['🤖', '💬', '✨', '📊', '💼', '🎧', '🔎', '🎼', '🧠', '🚀', '🛡️', '🌟'];

interface Props {
  form: QuickAgentForm;
  errors: Partial<Record<keyof QuickAgentForm, string>>;
  update: <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => void;
  highlightField?: keyof QuickAgentForm;
  /** Resumo do erro de validação que motivou o highlight (após restaurar). */
  highlightHint?: FieldValidationHintInfo | null;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

export function StepQuickIdentity({ form, errors, update, highlightField, highlightHint }: Props) {
  // Track which field is currently pulsing — auto-clears after 3s so the
  // visual cue doesn't linger after the user has acknowledged it.
  const [pulsingField, setPulsingField] = useState<keyof QuickAgentForm | null>(null);
  const pulseTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!highlightField) return;
    const id = `qa-${highlightField === 'description' ? 'desc' : highlightField}`;
    const el = document.getElementById(id);
    if (el) {
      // Garante que ancestrais Collapsible/Accordion/Tabs estejam abertos
      // antes de rolar — sem isso o input pode estar com display:none e o
      // scroll/focus falharia silenciosamente.
      const expanded = expandAncestorContainers(el);
      const delay = expanded ? 60 : 0;
      window.setTimeout(() => {
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }, delay);
      window.setTimeout(() => (el as HTMLElement).focus?.({ preventScroll: true }), 250 + delay);
    }
    setPulsingField(highlightField);
    if (pulseTimerRef.current != null) window.clearTimeout(pulseTimerRef.current);
    pulseTimerRef.current = window.setTimeout(() => setPulsingField(null), 3000);
    return () => {
      if (pulseTimerRef.current != null) window.clearTimeout(pulseTimerRef.current);
    };
  }, [highlightField]);

  const hl = (f: keyof QuickAgentForm) => (pulsingField === f ? ` ${FIELD_HIGHLIGHT_CLS}` : '');

  // Renderiza a hint inline somente para o campo atualmente destacado e
  // apenas enquanto houver `highlightHint` — assim que o usuário corrige,
  // o wizard limpa o highlight e a hint desaparece junto.
  const hintFor = (f: keyof QuickAgentForm) =>
    highlightField === f && highlightHint ? (
      <FieldValidationHint
        info={highlightHint}
        id={`qa-${f === 'description' ? 'desc' : f}-hint`}
      />
    ) : null;


  return (
    <div className="nexus-card space-y-5">
      <div>
        <h2 className="text-lg font-heading font-semibold text-foreground">Identidade do agente</h2>
        <p className="text-sm text-muted-foreground">Como ele se chama e qual o seu propósito.</p>
      </div>

      <div className="grid gap-4">
        <div>
          <Label htmlFor="qa-name" className="text-sm">Nome <span className="text-destructive">*</span></Label>
          <Input
            id="qa-name"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            placeholder="Ex: Aurora, Atlas, Pink Sales..."
            maxLength={60}
            aria-invalid={!!errors.name}
            aria-describedby={highlightField === 'name' && highlightHint ? 'qa-name-hint' : undefined}
            className={`mt-1.5 bg-secondary/50 border-border/50 ${errors.name ? 'border-destructive' : ''}${hl('name')}`}
          />
          <div className="flex justify-between items-start mt-1">
            <FieldError msg={errors.name} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{form.name.length}/60</span>
          </div>
          {hintFor('name')}
        </div>

        <div>
          <Label htmlFor="qa-emoji" className="text-sm">Emoji <span className="text-destructive">*</span></Label>
          <div className="mt-1.5 flex items-center gap-3">
            <Input
              id="qa-emoji"
              value={form.emoji}
              onChange={(e) => update('emoji', e.target.value)}
              maxLength={4}
              aria-invalid={!!errors.emoji}
              aria-describedby={highlightField === 'emoji' && highlightHint ? 'qa-emoji-hint' : undefined}
              className={`w-20 text-center text-xl bg-secondary/50 border-border/50 ${errors.emoji ? 'border-destructive' : ''}${hl('emoji')}`}
            />
            <div className="flex flex-wrap gap-1">
              {EMOJI_SUGGESTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => update('emoji', e)}
                  className={`h-8 w-8 rounded-md text-lg transition-colors ${
                    form.emoji === e ? 'bg-primary/20 ring-1 ring-primary' : 'bg-secondary/50 hover:bg-secondary'
                  }`}
                  aria-label={`Escolher ${e}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <FieldError msg={errors.emoji} />
          {hintFor('emoji')}
        </div>

        <div>
          <Label htmlFor="qa-mission" className="text-sm">Missão <span className="text-destructive">*</span></Label>
          <Textarea
            id="qa-mission"
            value={form.mission}
            onChange={(e) => update('mission', e.target.value)}
            placeholder="Ex: Atender dúvidas técnicas de clientes premium em até 2 minutos."
            rows={3}
            maxLength={500}
            aria-invalid={!!errors.mission}
            aria-describedby={highlightField === 'mission' && highlightHint ? 'qa-mission-hint' : undefined}
            className={`mt-1.5 bg-secondary/50 border-border/50 resize-none ${errors.mission ? 'border-destructive' : ''}${hl('mission')}`}
          />
          <div className="flex justify-between items-start mt-1">
            <FieldError msg={errors.mission} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{form.mission.length}/500</span>
          </div>
          {hintFor('mission')}
        </div>

        <div>
          <Label htmlFor="qa-desc" className="text-sm">Descrição curta (opcional)</Label>
          <Input
            id="qa-desc"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Para listagens e cards"
            maxLength={300}
            aria-describedby={highlightField === 'description' && highlightHint ? 'qa-desc-hint' : undefined}
            className={`mt-1.5 bg-secondary/50 border-border/50${hl('description')}`}
          />
          <div className="flex justify-between items-start mt-1">
            <FieldError msg={errors.description} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{form.description.length}/300</span>
          </div>
          {hintFor('description')}
        </div>
      </div>
    </div>
  );
}
