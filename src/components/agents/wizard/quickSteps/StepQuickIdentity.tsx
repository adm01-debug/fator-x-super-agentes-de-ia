import { useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';

const EMOJI_SUGGESTIONS = ['🤖', '💬', '✨', '📊', '💼', '🎧', '🔎', '🎼', '🧠', '🚀', '🛡️', '🌟'];

interface Props {
  form: QuickAgentForm;
  errors: Partial<Record<keyof QuickAgentForm, string>>;
  update: <K extends keyof QuickAgentForm>(key: K, value: QuickAgentForm[K]) => void;
  highlightField?: keyof QuickAgentForm;
}

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p className="text-xs text-destructive mt-1">{msg}</p>;
}

const HIGHLIGHT_CLS = 'ring-2 ring-warning ring-offset-2 ring-offset-background animate-pulse';

export function StepQuickIdentity({ form, errors, update, highlightField }: Props) {
  useEffect(() => {
    if (!highlightField) return;
    const el = document.getElementById(`qa-${highlightField === 'description' ? 'desc' : highlightField}`);
    if (el) {
      el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      window.setTimeout(() => (el as HTMLElement).focus?.(), 250);
    }
  }, [highlightField]);

  const hl = (f: keyof QuickAgentForm) => (highlightField === f ? ` ${HIGHLIGHT_CLS}` : '');

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
            className={`mt-1.5 bg-secondary/50 border-border/50 ${errors.name ? 'border-destructive' : ''}${hl('name')}`}
          />
          <div className="flex justify-between items-start mt-1">
            <FieldError msg={errors.name} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{form.name.length}/60</span>
          </div>
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
              className={`w-20 text-center text-xl bg-secondary/50 border-border/50 ${errors.emoji ? 'border-destructive' : ''}`}
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
            className={`mt-1.5 bg-secondary/50 border-border/50 resize-none ${errors.mission ? 'border-destructive' : ''}`}
          />
          <div className="flex justify-between items-start mt-1">
            <FieldError msg={errors.mission} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{form.mission.length}/500</span>
          </div>
        </div>

        <div>
          <Label htmlFor="qa-desc" className="text-sm">Descrição curta (opcional)</Label>
          <Input
            id="qa-desc"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            placeholder="Para listagens e cards"
            maxLength={300}
            className="mt-1.5 bg-secondary/50 border-border/50"
          />
          <div className="flex justify-between items-start mt-1">
            <FieldError msg={errors.description} />
            <span className="text-[10px] text-muted-foreground ml-auto font-mono">{form.description.length}/300</span>
          </div>
        </div>
      </div>
    </div>
  );
}
