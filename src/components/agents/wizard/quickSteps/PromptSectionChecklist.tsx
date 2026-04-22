import { useMemo } from 'react';
import { CheckCircle2, Circle, Plus, Wand2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  REQUIRED_PROMPT_SECTIONS,
  analyzeSectionContent,
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
  const reports = useMemo(() => analyzeSectionContent(prompt), [prompt]);
  const total = REQUIRED_PROMPT_SECTIONS.length;
  const ok = reports.filter((r) => r.present && !r.thinReason).length;
  const allOk = ok === total;
  const missingCount = reports.filter((r) => !r.present).length;
  const thinCount = reports.filter((r) => r.present && r.thinReason).length;
  const incompleteKeys = reports.filter((r) => !r.present || r.thinReason).map((r) => r.key);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'nexus-card space-y-2.5 transition-colors',
        allOk ? 'border-nexus-emerald/30 bg-nexus-emerald/5' : 'border-nexus-amber/40 bg-nexus-amber/5',
      )}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-heading font-semibold text-foreground">
            Checklist do prompt
          </p>
          <p className="text-[11px] text-muted-foreground">
            Seções mínimas + conteúdo suficiente em cada uma
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!allOk && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                const combined = incompleteKeys
                  .map((k) => SECTION_SNIPPETS[k])
                  .join('');
                onInsert(combined);
              }}
              className="h-7 gap-1.5 text-[11px] border-nexus-amber/40 text-nexus-amber hover:bg-nexus-amber/10 hover:text-nexus-amber hover:border-nexus-amber/60"
              aria-label={`Inserir esqueletos de ${incompleteKeys.length} ${incompleteKeys.length === 1 ? 'seção pendente' : 'seções pendentes'}`}
            >
              <Wand2 className="h-3 w-3" />
              Inserir {incompleteKeys.length === 1 ? 'a pendente' : `as ${incompleteKeys.length} pendentes`}
            </Button>
          )}
          <span
            className={cn(
              'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
              allOk
                ? 'border-nexus-emerald/40 bg-nexus-emerald/15 text-nexus-emerald'
                : 'border-nexus-amber/50 bg-nexus-amber/15 text-nexus-amber',
            )}
          >
            {ok}/{total} ✓
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {reports.map((r) => {
          const isOk = r.present && !r.thinReason;
          const isThin = r.present && !!r.thinReason;
          return (
            <li
              key={r.key}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isOk ? (
                  <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" aria-hidden />
                ) : isThin ? (
                  <AlertTriangle className="h-4 w-4 text-nexus-amber shrink-0" aria-hidden />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                )}
                <span
                  className={cn(
                    'font-medium truncate',
                    isOk ? 'text-foreground' : isThin ? 'text-nexus-amber' : 'text-muted-foreground',
                  )}
                >
                  {r.label}
                </span>
                <span
                  className={cn(
                    'text-[10px] font-mono truncate hidden sm:inline',
                    isThin ? 'text-nexus-amber/80' : 'text-muted-foreground/70',
                  )}
                >
                  {isOk
                    ? `detectada · ${r.wordCount} palavras`
                    : isThin
                    ? `${r.thinReason}`
                    : `adicione "## ${r.label}"`}
                </span>
              </div>
              {!isOk && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => onInsert(SECTION_SNIPPETS[r.key])}
                  className="h-7 gap-1 text-[11px] text-primary hover:bg-primary/10 shrink-0"
                  aria-label={`${isThin ? 'Reinserir esqueleto da' : 'Inserir esqueleto da'} seção ${r.label}`}
                >
                  <Plus className="h-3 w-3" /> {isThin ? 'Expandir' : 'Inserir'}
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {!allOk && (
        <div className="text-[11px] text-nexus-amber pt-1 border-t border-nexus-amber/20 space-y-0.5">
          {missingCount > 0 && (
            <p>
              ⚠ {missingCount === 1 ? 'Falta 1 seção obrigatória.' : `Faltam ${missingCount} seções obrigatórias.`}
            </p>
          )}
          {thinCount > 0 && (
            <p>
              ⚠ {thinCount === 1 ? '1 seção com conteúdo insuficiente' : `${thinCount} seções com conteúdo insuficiente`}{' '}
              (mín. 8 palavras cada).
            </p>
          )}
          <p className="text-muted-foreground">Resolva antes de criar o agente.</p>
        </div>
      )}
    </div>
  );
}
