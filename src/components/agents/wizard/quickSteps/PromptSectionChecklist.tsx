import { useMemo } from 'react';
import { CheckCircle2, Circle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  REQUIRED_PROMPT_SECTIONS,
  detectPromptSections,
  type PromptSectionKey,
} from '@/lib/validations/quickAgentSchema';
import { cn } from '@/lib/utils';

interface Props {
  prompt: string;
  onInsert: (snippet: string) => void;
}

const SECTION_SNIPPETS: Record<PromptSectionKey, string> = {
  persona: `\n\n## Persona\n- Tom: profissional e direto\n- Idioma: português brasileiro\n- Trate o usuário como ...\n`,
  scope: `\n\n## Escopo\n- Responder dúvidas sobre ...\n- Executar tarefas relacionadas a ...\n- Encaminhar para humano quando ...\n`,
  format: `\n\n## Formato\n- Máximo 200 palavras por resposta\n- Use listas curtas quando ajudar\n- Sempre entregue a resposta antes do contexto\n`,
  rules: `\n\n## Regras\n- Nunca invente informações; admita quando não souber\n- Não compartilhe dados sensíveis\n- Confirme antes de executar ações irreversíveis\n`,
};

export function PromptSectionChecklist({ prompt, onInsert }: Props) {
  const detected = useMemo(() => detectPromptSections(prompt), [prompt]);
  const total = REQUIRED_PROMPT_SECTIONS.length;
  const ok = REQUIRED_PROMPT_SECTIONS.filter((s) => detected[s.key]).length;
  const allOk = ok === total;
  const missingCount = total - ok;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'nexus-card space-y-2.5 transition-colors',
        allOk ? 'border-nexus-emerald/30 bg-nexus-emerald/5' : 'border-nexus-amber/40 bg-nexus-amber/5',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground">
            Checklist do prompt
          </p>
          <p className="text-[11px] text-muted-foreground">
            Seções mínimas para um system prompt completo
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
            allOk
              ? 'border-nexus-emerald/40 bg-nexus-emerald/15 text-nexus-emerald'
              : 'border-nexus-amber/50 bg-nexus-amber/15 text-nexus-amber',
          )}
        >
          {ok}/{total} ✓
        </span>
      </div>

      <ul className="space-y-1.5">
        {REQUIRED_PROMPT_SECTIONS.map((sec) => {
          const isOk = detected[sec.key];
          return (
            <li
              key={sec.key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOk ? (
                  <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                )}
                <span
                  className={cn(
                    'font-medium truncate',
                    isOk ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {sec.label}
                </span>
                <span className="text-[10px] text-muted-foreground/70 font-mono truncate hidden sm:inline">
                  {isOk ? 'detectada' : `adicione "## ${sec.label}"`}
                </span>
              </div>
              {!isOk && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onInsert(SECTION_SNIPPETS[sec.key])}
                  className="h-7 gap-1 text-[11px] text-primary hover:bg-primary/10 shrink-0"
                  aria-label={`Inserir esqueleto da seção ${sec.label}`}
                >
                  <Plus className="h-3 w-3" /> Inserir
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {!allOk && (
        <div className="text-[11px] text-nexus-amber pt-1 border-t border-nexus-amber/20">
          ⚠ {missingCount === 1
            ? 'Falta 1 seção obrigatória.'
            : `Faltam ${missingCount} seções obrigatórias.`}{' '}
          Inclua-as antes de criar o agente.
        </div>
      )}
    </div>
  );
}
