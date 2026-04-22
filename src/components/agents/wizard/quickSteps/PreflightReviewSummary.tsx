import { useMemo } from 'react';
import { Rocket, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { compilePrompt } from '@/lib/promptCompiler';
import {
  detectPromptSections,
  getMissingSections,
  REQUIRED_PROMPT_SECTIONS,
  type QuickAgentForm,
  type PromptSectionKey,
} from '@/lib/validations/quickAgentSchema';

export interface ReviewData {
  sections: Record<PromptSectionKey, boolean>;
  missingSections: PromptSectionKey[];
  compiled: ReturnType<typeof compilePrompt>;
  hasUnresolved: boolean;
  hasMissingSections: boolean;
}

export function useReviewData(form: QuickAgentForm): ReviewData {
  return useMemo(() => {
    const sections = detectPromptSections(form.prompt);
    const missingSections = getMissingSections(form.prompt);
    const compiled = compilePrompt(form);
    return {
      sections,
      missingSections,
      compiled,
      hasUnresolved: compiled.unresolvedVariables.length > 0,
      hasMissingSections: missingSections.length > 0,
    };
  }, [form]);
}

interface SummaryProps {
  form: QuickAgentForm;
  /** When true, renders compactly (used inside dialogs). */
  compact?: boolean;
}

export function PreflightReviewSummary({ form, compact = false }: SummaryProps) {
  const { sections, compiled, hasUnresolved, hasMissingSections } = useReviewData(form);
  const totalSections = REQUIRED_PROMPT_SECTIONS.length;
  const presentSections = Object.values(sections).filter(Boolean).length;
  const allGood = !hasMissingSections && !hasUnresolved;

  return (
    <div
      className={cn(
        'rounded-xl border space-y-3',
        compact ? 'p-3' : 'nexus-card',
        allGood ? 'border-nexus-emerald/30' : 'border-nexus-amber/30',
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className={cn(
              'h-8 w-8 rounded-lg flex items-center justify-center shrink-0',
              allGood ? 'bg-nexus-emerald/15 text-nexus-emerald' : 'bg-nexus-amber/15 text-nexus-amber',
            )}
          >
            {allGood ? <Rocket className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-heading font-semibold text-foreground">
              {allGood ? 'Pronto para criar' : 'Revisão antes de criar'}
            </p>
            <p className="text-[11px] text-muted-foreground truncate">
              {form.emoji} {form.name || 'Sem nome'} · {form.type} · {form.model}
            </p>
          </div>
        </div>
        <div className="text-[10px] font-mono text-muted-foreground flex items-center gap-1.5 flex-wrap">
          <span>{compiled.stats.chars.toLocaleString('pt-BR')} chars</span>
          <span className="opacity-50">·</span>
          <span>~{compiled.stats.estimatedTokens.toLocaleString('pt-BR')} tokens</span>
        </div>
      </div>

      {/* Sections checklist */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Seções obrigatórias ({presentSections}/{totalSections})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {REQUIRED_PROMPT_SECTIONS.map((sec) => {
            const present = sections[sec.key];
            return (
              <span
                key={sec.key}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium',
                  present
                    ? 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald'
                    : 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber',
                )}
                title={present ? 'Detectada no prompt' : 'Faltando — adicione um heading'}
              >
                {present ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                {sec.label}
              </span>
            );
          })}
        </div>
      </div>

      {/* Variables */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Variáveis ({compiled.detectedVariables.length})
        </p>
        {compiled.detectedVariables.length === 0 ? (
          <p className="text-[11px] text-muted-foreground/70 italic">Nenhuma variável detectada no prompt.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {compiled.detectedVariables.map((v) => {
              const unresolved = compiled.unresolvedVariables.includes(v);
              return (
                <span
                  key={v}
                  className={cn(
                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono border text-[10px]',
                    unresolved
                      ? 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber'
                      : 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald',
                  )}
                  title={unresolved ? 'Sem valor — ficará literal no prompt salvo' : 'Substituída ao salvar'}
                >
                  {unresolved ? '⚠' : '✓'} {`{{${v}}}`}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* Warnings */}
      {(hasUnresolved || hasMissingSections) && (
        <div className="text-[11px] text-nexus-amber bg-nexus-amber/10 border border-nexus-amber/30 rounded-md px-2.5 py-1.5 space-y-0.5">
          {hasMissingSections && (
            <p>
              <strong>{compiled.unresolvedVariables.length === 0 ? '' : '· '}</strong>
              Faltam seções:{' '}
              {getMissingSections(form.prompt)
                .map((k) => REQUIRED_PROMPT_SECTIONS.find((s) => s.key === k)?.label ?? k)
                .join(', ')}
              .
            </p>
          )}
          {hasUnresolved && (
            <p>
              {compiled.unresolvedVariables.length} variável(eis) sem valor permanecerão literais no prompt salvo.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
