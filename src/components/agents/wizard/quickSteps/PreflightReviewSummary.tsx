import { useMemo, useState } from 'react';
import { Rocket, AlertTriangle, CheckCircle2, GitMerge, Lightbulb, Copy, Check, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { compilePrompt } from '@/lib/promptCompiler';
import {
  detectPromptSections,
  getMissingSections,
  analyzeSectionContent,
  REQUIRED_PROMPT_SECTIONS,
  type QuickAgentForm,
  type PromptSectionKey,
  type SectionContentReport,
} from '@/lib/validations/quickAgentSchema';
import {
  detectPromptContradictions,
  CONTRADICTION_KIND_LABEL,
  type PromptContradiction,
} from '@/lib/validations/promptContradictions';
import { suggestContradictionRewrites } from '@/lib/validations/contradictionSuggestions';

export interface ReviewData {
  sections: Record<PromptSectionKey, boolean>;
  missingSections: PromptSectionKey[];
  sectionReports: SectionContentReport[];
  thinSections: SectionContentReport[];
  compiled: ReturnType<typeof compilePrompt>;
  contradictions: PromptContradiction[];
  hasUnresolved: boolean;
  hasMissingSections: boolean;
  hasThinSections: boolean;
  hasContradictions: boolean;
}

export function useReviewData(form: QuickAgentForm): ReviewData {
  return useMemo(() => {
    const sections = detectPromptSections(form.prompt);
    const missingSections = getMissingSections(form.prompt);
    const sectionReports = analyzeSectionContent(form.prompt);
    const thinSections = sectionReports.filter((r) => r.present && r.thinReason !== null);
    const compiled = compilePrompt(form);
    const contradictions = detectPromptContradictions(form.prompt);
    return {
      sections,
      missingSections,
      sectionReports,
      thinSections,
      compiled,
      contradictions,
      hasUnresolved: compiled.unresolvedVariables.length > 0,
      hasMissingSections: missingSections.length > 0,
      hasThinSections: thinSections.length > 0,
      hasContradictions: contradictions.length > 0,
    };
  }, [form]);
}

interface SummaryProps {
  form: QuickAgentForm;
  /** When true, renders compactly (used inside dialogs). */
  compact?: boolean;
  /** When provided, problem chips become clickable and jump the editor to that section. */
  onJumpToSection?: (key: PromptSectionKey) => void;
  /** When provided, contradiction cards become clickable and jump to a specific line. */
  onJumpToLine?: (line: number) => void;
}

export function PreflightReviewSummary({ form, compact = false, onJumpToSection, onJumpToLine }: SummaryProps) {
  const {
    sectionReports,
    thinSections,
    compiled,
    contradictions,
    hasUnresolved,
    hasMissingSections,
    hasThinSections,
    hasContradictions,
  } = useReviewData(form);
  const totalSections = REQUIRED_PROMPT_SECTIONS.length;
  const presentOk = sectionReports.filter((r) => r.present && !r.thinReason).length;
  const allGood = !hasMissingSections && !hasThinSections && !hasUnresolved && !hasContradictions;

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

      {/* Sections checklist with depth */}
      <div className="space-y-1.5">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
          Seções obrigatórias ({presentOk}/{totalSections} completas)
        </p>
        <div className="flex flex-wrap gap-1.5">
          {sectionReports.map((r) => {
            const isOk = r.present && !r.thinReason;
            const isThin = r.present && !!r.thinReason;
            const canJump = !isOk && !!onJumpToSection;
            const Tag: React.ElementType = canJump ? 'button' : 'span';
            return (
              <Tag
                key={r.key}
                type={canJump ? 'button' : undefined}
                onClick={canJump ? () => onJumpToSection!(r.key) : undefined}
                className={cn(
                  'inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-medium transition-colors',
                  isOk
                    ? 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald'
                    : 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber',
                  canJump && 'hover:bg-nexus-amber/20 hover:border-nexus-amber/60 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-amber/50',
                )}
                title={
                  isOk
                    ? `${r.wordCount} palavras`
                    : canJump
                    ? `${isThin ? r.thinReason : 'Heading ausente'} — clique para ir até a seção`
                    : isThin
                    ? `${r.thinReason} (${r.wordCount} palavras)`
                    : 'Heading ausente'
                }
                aria-label={canJump ? `Ir para a seção ${r.label} no editor` : undefined}
              >
                {isOk ? <CheckCircle2 className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                {r.label}
                {isThin && <span className="font-mono opacity-80">·{r.wordCount}p</span>}
              </Tag>
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

      {/* Conflitos detectados */}
      {hasContradictions && (
        <div className="space-y-1.5">
          <p className="text-[10px] uppercase tracking-wider text-nexus-amber flex items-center gap-1.5">
            <GitMerge className="h-3 w-3" />
            Conflitos detectados ({contradictions.length})
          </p>
          <div className="space-y-1.5">
            {contradictions.map((c, idx) => (
              <ConflictCard key={idx} c={c} onJumpToLine={onJumpToLine} />
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {(hasUnresolved || hasMissingSections || hasThinSections || hasContradictions) && (
        <div className="text-[11px] text-nexus-amber bg-nexus-amber/10 border border-nexus-amber/30 rounded-md px-2.5 py-1.5 space-y-0.5">
          {hasMissingSections && (
            <p>
              ⚠ Faltam seções:{' '}
              {getMissingSections(form.prompt)
                .map((k) => REQUIRED_PROMPT_SECTIONS.find((s) => s.key === k)?.label ?? k)
                .join(', ')}
              .
            </p>
          )}
          {hasThinSections && (
            <p>
              ⚠ Conteúdo insuficiente em:{' '}
              {thinSections.map((t) => `${t.label} (${t.thinReason})`).join('; ')}.
            </p>
          )}
          {hasContradictions && (
            <p>
              ⚠ {contradictions.length} conflito(s) entre regras — resolva antes de criar.
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

/* ----------------------------- ConflictCard ----------------------------- */

/**
 * Single contradiction card with an inline "Ver sugestões de reescrita" panel.
 *
 * The card itself is a non-interactive container (so we can host the
 * jump-to-line button, the expander toggle, and per-suggestion copy buttons
 * without nesting a button-in-button). Suggestions come from the offline
 * `suggestContradictionRewrites` util — kind-aware (polarity / numeric /
 * language) and deterministic.
 */
function ConflictCard({
  c,
  onJumpToLine,
}: {
  c: PromptContradiction;
  onJumpToLine?: (line: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const suggestions = useMemo(() => suggestContradictionRewrites(c), [c]);

  const copyRewrite = async (text: string, idx: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(idx);
      toast.success('Sugestão copiada', {
        description: 'Cole no editor para substituir as regras conflitantes.',
      });
      window.setTimeout(() => setCopiedIdx((cur) => (cur === idx ? null : cur)), 1800);
    } catch {
      toast.error('Não foi possível copiar — selecione e copie manualmente.');
    }
  };

  return (
    <div className="rounded-md border border-nexus-amber/40 bg-nexus-amber/10 px-2.5 py-1.5 space-y-1.5">
      <div className="flex items-center gap-1.5 text-[10px] font-mono">
        <span className="px-1.5 py-0.5 rounded-full bg-nexus-amber/20 text-nexus-amber font-semibold">
          {CONTRADICTION_KIND_LABEL[c.kind]}
        </span>
        {onJumpToLine ? (
          <button
            type="button"
            onClick={() => onJumpToLine(c.lineA)}
            className="text-muted-foreground hover:text-nexus-amber underline-offset-2 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-amber/50 rounded px-1 py-0.5 -mx-1 -my-0.5 transition-colors"
            title={`Ir para a linha ${c.lineA} no editor`}
          >
            linha {c.lineA} ↔ {c.lineB}
          </button>
        ) : (
          <span className="text-muted-foreground">linha {c.lineA} ↔ {c.lineB}</span>
        )}
      </div>
      <p className="text-[11px] text-nexus-amber/90 leading-snug">{c.reason}</p>
      <div className="text-[10px] font-mono text-muted-foreground/80 space-y-0.5">
        <div className="truncate">A: {c.snippetA}</div>
        <div className="truncate">B: {c.snippetB}</div>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((x) => !x)}
        aria-expanded={expanded}
        className="flex items-center gap-1 text-[10px] font-medium text-nexus-amber hover:text-nexus-amber/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-nexus-amber/50 rounded transition-colors"
      >
        <Lightbulb className="h-3 w-3" />
        {expanded ? 'Ocultar sugestões' : `Ver ${suggestions.length} sugestões de reescrita`}
        <ChevronDown
          className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && (
        <div className="space-y-1.5 pt-1 animate-fade-in">
          {suggestions.map((s, idx) => {
            const isCopied = copiedIdx === idx;
            return (
              <div
                key={idx}
                className="rounded border border-border/60 bg-background/60 p-2 space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground">{s.title}</p>
                    <p className="text-[10px] text-muted-foreground leading-snug">
                      {s.rationale}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => copyRewrite(s.rewrite, idx)}
                    aria-label={`Copiar sugestão: ${s.title}`}
                    className={cn(
                      'shrink-0 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
                      isCopied
                        ? 'bg-nexus-emerald/20 text-nexus-emerald'
                        : 'bg-secondary hover:bg-secondary/80 text-foreground',
                    )}
                  >
                    {isCopied ? (
                      <>
                        <Check className="h-2.5 w-2.5" />
                        Copiado
                      </>
                    ) : (
                      <>
                        <Copy className="h-2.5 w-2.5" />
                        Copiar
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-[10px] font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap break-words bg-secondary/40 rounded px-1.5 py-1 border border-border/40">
                  {s.rewrite}
                </pre>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
