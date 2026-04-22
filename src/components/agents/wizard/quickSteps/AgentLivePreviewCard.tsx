import { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles, Coins, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import { useDebounce } from '@/hooks/use-debounce';
import { useCostEstimate } from '@/hooks/useCostEstimate';
import { QUICK_AGENT_MOCK_INPUTS, type QuickAgentType } from '@/data/quickAgentTemplates';
import type { QuickAgentForm } from '@/lib/validations/quickAgentSchema';
import { detectPromptSections, REQUIRED_PROMPT_SECTIONS } from '@/lib/validations/quickAgentSchema';
import { PROMPT_LIMITS } from '@/lib/validations/promptSanitizer';

interface Props {
  form: QuickAgentForm;
}

const COLLAPSED_LINES = 12;
const EXPANDED_LINES = 40;

function summarizePrompt(text: string, maxLines: number) {
  const allLines = text.split('\n');
  // Keep headings + non-empty lines for the preview
  const meaningful = allLines.filter((l, i) => {
    const trimmed = l.trim();
    // keep headings always; keep non-empty; collapse runs of empties
    if (trimmed.startsWith('#')) return true;
    if (trimmed.length === 0) {
      const prev = allLines[i - 1]?.trim() ?? '';
      return prev.length > 0; // keep just one blank between blocks
    }
    return true;
  });
  const preview = meaningful.slice(0, maxLines).join('\n');
  const hidden = Math.max(0, meaningful.length - maxLines);
  return { preview, hidden, totalLines: allLines.length };
}

export function AgentLivePreviewCard({ form }: Props) {
  const debounced = useDebounce(form, 200);
  const [expanded, setExpanded] = useState(false);
  const [pulsing, setPulsing] = useState(false);
  const lastSerialized = useRef('');

  // Pulse when debounced form actually changes
  useEffect(() => {
    const sig = JSON.stringify(debounced);
    if (lastSerialized.current && sig !== lastSerialized.current) {
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 600);
      return () => clearTimeout(t);
    }
    lastSerialized.current = sig;
  }, [debounced]);

  const sections = detectPromptSections(debounced.prompt);
  const sectionsCount = Object.values(sections).filter(Boolean).length;
  const sectionsTotal = REQUIRED_PROMPT_SECTIONS.length;
  const charCount = debounced.prompt.length;
  const charDanger = charCount > 0 && charCount < PROMPT_LIMITS.MIN_TOTAL;
  const charWarn = charCount > PROMPT_LIMITS.MAX_TOTAL * 0.9;

  const { preview, hidden, totalLines } = summarizePrompt(
    debounced.prompt,
    expanded ? EXPANDED_LINES : COLLAPSED_LINES,
  );

  const hasPrompt = debounced.prompt.trim().length > 0;

  // Live cost estimate
  const mockInput =
    QUICK_AGENT_MOCK_INPUTS[debounced.type as QuickAgentType]?.[0]?.input ?? '';
  const cost = useCostEstimate({
    model: debounced.model,
    systemPrompt: debounced.prompt,
    userInput: mockInput,
    maxTokens: 1000,
    toolsCount: 0,
  });
  const dailyExecs = 100;
  const dailyUsd = cost.costUsd * dailyExecs;
  const dailyBrl = cost.costBrl * dailyExecs;
  const inputPct = cost.totalTokens > 0
    ? Math.round((cost.inputTokens / cost.totalTokens) * 100)
    : 50;
  const tier: 'low' | 'mid' | 'high' =
    cost.costUsd < 0.01 ? 'low' : cost.costUsd < 0.05 ? 'mid' : 'high';
  const tierColor =
    tier === 'low' ? 'text-nexus-emerald'
    : tier === 'mid' ? 'text-nexus-amber'
    : 'text-destructive';

  return (
    <TooltipProvider delayDuration={200}>
    <div className="nexus-card space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
            Prévia ao vivo
          </p>
        </div>
        <div className="flex items-center gap-1.5" aria-label={pulsing ? 'Atualizado agora' : 'Sincronizado'}>
          <span
            className={`h-1.5 w-1.5 rounded-full transition-colors ${
              pulsing ? 'bg-nexus-amber animate-pulse' : 'bg-nexus-emerald'
            }`}
          />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {pulsing ? 'atualizando' : 'sincronizado'}
          </span>
        </div>
      </div>

      {/* Identity row */}
      <div className="flex items-start gap-3 flex-col sm:flex-row">
        <div className="h-14 w-14 rounded-xl bg-primary/15 flex items-center justify-center text-3xl shrink-0 border border-primary/20">
          {debounced.emoji || '🤖'}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-heading font-semibold text-foreground text-base truncate">
              {debounced.name || 'Sem nome'}
            </p>
            {debounced.type && (
              <Badge variant="secondary" className="text-[10px] uppercase tracking-wider">
                {debounced.type}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground font-mono flex-wrap">
            <span>modelo: {debounced.model}</span>
            <span className="opacity-50">·</span>
            <span className={sectionsCount === sectionsTotal ? 'text-nexus-emerald' : 'text-nexus-amber'}>
              {sectionsCount}/{sectionsTotal} seções
            </span>
            <span className="opacity-50">·</span>
            <span className={charDanger ? 'text-destructive' : charWarn ? 'text-nexus-amber' : ''}>
              {charCount.toLocaleString('pt-BR')} chars
            </span>
          </div>
        </div>
      </div>

      {/* Mission */}
      <div className="space-y-1">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Missão</p>
        <p className="text-xs text-foreground/90 line-clamp-2">
          {debounced.mission || <span className="text-muted-foreground italic">Sem missão definida</span>}
        </p>
      </div>

      {/* Prompt summary */}
      <div className="space-y-2 pt-2 border-t border-border/50">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Resumo do system prompt
          </p>
          {hasPrompt && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setExpanded((v) => !v)}
              className="h-6 px-2 text-[11px] gap-1"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>
                  <ChevronUp className="h-3 w-3" /> Ver menos
                </>
              ) : (
                <>
                  <ChevronDown className="h-3 w-3" /> Ver mais
                </>
              )}
            </Button>
          )}
        </div>

        {hasPrompt ? (
          <div className="relative">
            <pre
              className={`bg-secondary/30 rounded-lg p-3 text-[11px] leading-relaxed font-mono text-foreground/85 overflow-hidden whitespace-pre-wrap break-words ${
                expanded ? 'max-h-[480px] overflow-y-auto' : 'max-h-[280px]'
              }`}
            >
              {preview}
            </pre>
            {!expanded && hidden > 0 && (
              <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-card to-transparent rounded-b-lg" />
            )}
            {hidden > 0 && (
              <p className="text-[10px] text-muted-foreground mt-1.5 font-mono">
                +{hidden} {hidden === 1 ? 'linha oculta' : 'linhas ocultas'} · {totalLines} no total
              </p>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground italic py-3">
            Comece a escrever o prompt para ver a prévia aqui.
          </p>
        )}
      </div>
    </div>
  );
}
