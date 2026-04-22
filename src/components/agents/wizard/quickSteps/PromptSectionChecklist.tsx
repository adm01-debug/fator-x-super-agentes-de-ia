import { useMemo, useState } from 'react';
import { CheckCircle2, Circle, Plus, Wand2, AlertTriangle, Crosshair, Lock, Sparkles, FileSearch } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  REQUIRED_PROMPT_SECTIONS,
  analyzeSectionContent,
  type PromptSectionKey,
} from '@/lib/validations/quickAgentSchema';
import { extractSectionFromPrompt } from '@/lib/promptSectionLocator';
import { cn } from '@/lib/utils';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';

interface Props {
  prompt: string;
  /**
   * Insert a snippet at the canonical position for `key` (or append if no key).
   * The parent is responsible for actually splicing into the prompt string.
   */
  onInsert: (snippet: string, key?: PromptSectionKey) => void;
  /**
   * Called when the user wants to jump the editor to a specific section.
   * If the section is missing, `snippetIfMissing` is provided so the parent
   * can insert the skeleton before scrolling.
   */
  onJumpToSection?: (key: PromptSectionKey, snippetIfMissing?: string) => void;
  /**
   * Full text of the currently active variant template (Equilibrado / Conciso /
   * Detalhado). When provided, the checklist uses this as the source of snippets
   * for missing sections — so "Inserir + ir" preenche com o conteúdo da variação,
   * não com o esqueleto genérico.
   */
  activeVariantPrompt?: string | null;
  /** Display label of the active variant (e.g. "Conciso"). */
  activeVariantLabel?: string | null;
  /** Whether the prompt is in custom-locked mode (no variant active). */
  customLocked?: boolean;
}

export const SECTION_SNIPPETS: Record<PromptSectionKey, string> = {
  persona: `\n\n## Persona\n- Tom: profissional e direto\n- Idioma: português brasileiro\n- Trate o usuário como ...\n`,
  scope: `\n\n## Escopo\n- Responder dúvidas sobre ...\n- Executar tarefas relacionadas a ...\n- Encaminhar para humano quando ...\n`,
  format: `\n\n## Formato\n- Máximo 200 palavras por resposta\n- Use listas curtas quando ajudar\n- Sempre entregue a resposta antes do contexto\n`,
  rules: `\n\n## Regras\n- Nunca invente informações; admita quando não souber\n- Não compartilhe dados sensíveis\n- Confirme antes de executar ações irreversíveis\n`,
};

/** Count words in a snippet (used for the "preencheria com ~N palavras" hint). */
function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function PromptSectionChecklist({
  prompt,
  onInsert,
  onJumpToSection,
  activeVariantPrompt,
  activeVariantLabel,
  customLocked,
}: Props) {
  const reports = useMemo(() => analyzeSectionContent(prompt), [prompt]);
  const total = REQUIRED_PROMPT_SECTIONS.length;
  const ok = reports.filter((r) => r.present && !r.thinReason).length;
  const allOk = ok === total;
  const missingCount = reports.filter((r) => !r.present).length;
  const thinCount = reports.filter((r) => r.present && r.thinReason).length;
  const incompleteKeys = reports.filter((r) => !r.present || r.thinReason).map((r) => r.key);

  // Per-section effective snippet: prefer the active variant's content, fall
  // back to the generic skeleton. Recomputed in real time.
  const effectiveSnippets = useMemo(() => {
    const out = {} as Record<PromptSectionKey, { snippet: string; fromVariant: boolean; words: number }>;
    for (const sec of REQUIRED_PROMPT_SECTIONS) {
      const fromVariant = activeVariantPrompt
        ? extractSectionFromPrompt(activeVariantPrompt, sec.key)
        : null;
      const snippet = fromVariant ?? SECTION_SNIPPETS[sec.key];
      out[sec.key] = {
        snippet,
        fromVariant: !!fromVariant,
        words: wordCount(snippet),
      };
    }
    return out;
  }, [activeVariantPrompt]);

  const hasVariant = !!activeVariantPrompt && !customLocked;

  // Per-section extracted body from the *current* prompt — feeds the drawer.
  const sectionBodies = useMemo(() => {
    const out = {} as Record<PromptSectionKey, { body: string | null; words: number }>;
    for (const sec of REQUIRED_PROMPT_SECTIONS) {
      const body = extractSectionFromPrompt(prompt, sec.key);
      out[sec.key] = { body, words: body ? wordCount(body) : 0 };
    }
    return out;
  }, [prompt]);
  const totalWords = Object.values(sectionBodies).reduce((acc, s) => acc + s.words, 0);

  const [drawerOpen, setDrawerOpen] = useState(false);

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
            {hasVariant
              ? `Cobertura mínima — fonte: variação "${activeVariantLabel}"`
              : customLocked
              ? 'Cobertura mínima — modo customizado (snippets genéricos)'
              : 'Seções mínimas + conteúdo suficiente em cada uma'}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Variant badge — clarifies the "4/4" reference. */}
          {hasVariant && activeVariantLabel && (
            <span
              className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 border-primary/40 bg-primary/10 text-primary"
              title={`O preenchimento das seções pendentes virá da variação "${activeVariantLabel}".`}
            >
              <Sparkles className="h-2.5 w-2.5" />
              {activeVariantLabel}
            </span>
          )}
          {customLocked && (
            <span
              className="text-[10px] uppercase tracking-wider font-mono px-2 py-0.5 rounded-full border inline-flex items-center gap-1 border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber"
              title="Edição manual detectada — usando snippets genéricos."
            >
              <Lock className="h-2.5 w-2.5" />
              customizado
            </span>
          )}
          {/* Drawer trigger — opens the side panel with extracted bodies. */}
          <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
            <SheetTrigger asChild>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 gap-1.5 text-[11px]"
                aria-label="Inspecionar conteúdo extraído de cada seção"
                title="Ver corpo extraído + contagem de palavras de cada seção"
              >
                <FileSearch className="h-3 w-3" />
                Inspecionar
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
              <SheetHeader className="space-y-1.5">
                <SheetTitle className="flex items-center gap-2">
                  <FileSearch className="h-4 w-4 text-primary" />
                  Inspeção das seções
                </SheetTitle>
                <SheetDescription>
                  Conteúdo extraído do prompt atual, agrupado por seção.{' '}
                  <span className="font-mono tabular-nums">{totalWords}</span>{' '}
                  palavra{totalWords === 1 ? '' : 's'} no total · {ok}/{total} seções completas.
                </SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-4">
                {reports.map((r) => {
                  const body = sectionBodies[r.key];
                  const isOk = r.present && !r.thinReason;
                  const isThin = r.present && !!r.thinReason;
                  const tone = isOk
                    ? 'border-nexus-emerald/30 bg-nexus-emerald/5'
                    : isThin
                    ? 'border-nexus-amber/40 bg-nexus-amber/5'
                    : 'border-border/50 bg-secondary/30';
                  return (
                    <section
                      key={r.key}
                      className={cn('rounded-lg border p-3 space-y-2 transition-colors', tone)}
                    >
                      <header className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 min-w-0">
                          {isOk ? (
                            <CheckCircle2 className="h-4 w-4 text-nexus-emerald shrink-0" aria-hidden />
                          ) : isThin ? (
                            <AlertTriangle className="h-4 w-4 text-nexus-amber shrink-0" aria-hidden />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
                          )}
                          <h3 className="text-sm font-medium text-foreground truncate">
                            ## {r.label}
                          </h3>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span
                            className={cn(
                              'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                              isOk
                                ? 'border-nexus-emerald/40 bg-nexus-emerald/10 text-nexus-emerald'
                                : isThin
                                ? 'border-nexus-amber/40 bg-nexus-amber/10 text-nexus-amber'
                                : 'border-border bg-background text-muted-foreground',
                            )}
                            title={isOk ? 'Cobertura suficiente' : isThin ? r.thinReason : 'Seção ausente'}
                          >
                            {body.words} palavra{body.words === 1 ? '' : 's'}
                          </span>
                          {onJumpToSection && r.present && (
                            <Button
                              type="button"
                              size="sm"
                              variant="ghost"
                              onClick={() => { onJumpToSection(r.key); setDrawerOpen(false); }}
                              className="h-6 gap-1 text-[10px] text-primary hover:bg-primary/10 px-2"
                              aria-label={`Ir para a seção ${r.label} no editor`}
                            >
                              <Crosshair className="h-3 w-3" /> Ir
                            </Button>
                          )}
                        </div>
                      </header>
                      {body.body ? (
                        <pre className="text-[12px] leading-relaxed whitespace-pre-wrap break-words font-mono text-foreground/85 max-h-64 overflow-y-auto bg-background/60 rounded-md p-2.5 border border-border/40">
                          {body.body.trim()}
                        </pre>
                      ) : (
                        <p className="text-[11px] italic text-muted-foreground">
                          Seção não encontrada no prompt atual.
                          {hasVariant
                            ? ` "Inserir + ir" preencheria com ~${effectiveSnippets[r.key].words} palavras da variação ${activeVariantLabel}.`
                            : ' Use "Inserir + ir" para adicionar o esqueleto.'}
                        </p>
                      )}
                    </section>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
          {!allOk && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                for (const k of incompleteKeys) {
                  onInsert(effectiveSnippets[k].snippet, k);
                }
              }}
              className="h-7 gap-1.5 text-[11px] border-nexus-amber/40 text-nexus-amber hover:bg-nexus-amber/10 hover:text-nexus-amber hover:border-nexus-amber/60"
              aria-label={
                hasVariant
                  ? `Completar com variação ${activeVariantLabel} (${incompleteKeys.length} pendentes)`
                  : `Inserir esqueletos de ${incompleteKeys.length} ${incompleteKeys.length === 1 ? 'seção pendente' : 'seções pendentes'}`
              }
            >
              <Wand2 className="h-3 w-3" />
              {hasVariant
                ? `Completar com ${activeVariantLabel}`
                : `Inserir ${incompleteKeys.length === 1 ? 'a pendente' : `as ${incompleteKeys.length} pendentes`}`}
            </Button>
          )}
          <span
            className={cn(
              'text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border',
              allOk
                ? 'border-nexus-emerald/40 bg-nexus-emerald/15 text-nexus-emerald'
                : 'border-nexus-amber/50 bg-nexus-amber/15 text-nexus-amber',
            )}
            title={`${ok} de ${total} seções obrigatórias com conteúdo suficiente`}
          >
            {ok}/{total} ✓
          </span>
        </div>
      </div>

      <ul className="space-y-1.5">
        {reports.map((r) => {
          const isOk = r.present && !r.thinReason;
          const isThin = r.present && !!r.thinReason;
          const eff = effectiveSnippets[r.key];
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
                    : hasVariant && eff.fromVariant
                    ? `${activeVariantLabel} preenche com ~${eff.words} palavras`
                    : `adicione "## ${r.label}"`}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {isThin && onJumpToSection && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onJumpToSection(r.key)}
                    className="h-7 gap-1 text-[11px] text-nexus-amber hover:bg-nexus-amber/10"
                    aria-label={`Ir para a seção ${r.label} no editor`}
                    title="Pular para esta seção no editor"
                  >
                    <Crosshair className="h-3 w-3" /> Ir para
                  </Button>
                )}
                {!isOk && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      if (!r.present && onJumpToSection) {
                        // Insert + jump in a single action.
                        onJumpToSection(r.key, eff.snippet);
                      } else {
                        // Splice at canonical position via key-aware onInsert.
                        onInsert(eff.snippet, r.key);
                        if (onJumpToSection) onJumpToSection(r.key);
                      }
                    }}
                    className="h-7 gap-1 text-[11px] text-primary hover:bg-primary/10"
                    aria-label={`${isThin ? 'Reinserir' : 'Inserir'} seção ${r.label}${eff.fromVariant ? ` da variação ${activeVariantLabel}` : ''}`}
                  >
                    <Plus className="h-3 w-3" /> {isThin ? 'Expandir' : 'Inserir + ir'}
                  </Button>
                )}
              </div>
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
