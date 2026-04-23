/**
 * EventTypeFilter — filtro multi-seleção por tipo de evento (tag) na timeline.
 *
 * Diferente do TimelinePresetBar (escolha única de receita pré-fabricada),
 * aqui o usuário liga/desliga várias tags ao mesmo tempo. As tags aplicam
 * em AND com o preset ativo, então "Prompt" preset + ["tools","rag"] mostra
 * versões que tenham prompt E (tools OU rag).
 *
 * Persistido na URL via `types=prompt,tools,rag` para sobreviver a reload e
 * compartilhamento. Vazio = sem filtro extra.
 */
import { Code2, FileText, Cpu, Shield, Database, RotateCcw, AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { TimelineTag } from './timelineFilters';

interface TagConfig {
  tag: TimelineTag;
  label: string;
  icon: typeof Code2;
  description: string;
  /** Classe extra para destacar quando ativo — alinha com cor semântica do tipo. */
  activeClass: string;
}

const EVENT_TYPES: TagConfig[] = [
  {
    tag: 'tools',
    label: 'Tool',
    icon: Code2,
    description: 'Versões que mexem em ferramentas/integrações.',
    activeClass: 'bg-nexus-cyan/15 text-nexus-cyan border-nexus-cyan/40 hover:bg-nexus-cyan/25',
  },
  {
    tag: 'prompt',
    label: 'Prompt',
    icon: FileText,
    description: 'Mudanças no system prompt, persona ou missão.',
    activeClass: 'bg-primary/15 text-primary border-primary/40 hover:bg-primary/25',
  },
  {
    tag: 'guardrails',
    label: 'Guardrail',
    icon: Shield,
    description: 'Alterações em políticas, safety ou guardrails.',
    activeClass: 'bg-nexus-amber/15 text-nexus-amber border-nexus-amber/40 hover:bg-nexus-amber/25',
  },
  {
    tag: 'rag',
    label: 'RAG',
    icon: Database,
    description: 'Knowledge base, retrieval, embeddings, chunks.',
    activeClass: 'bg-nexus-violet/15 text-nexus-violet border-nexus-violet/40 hover:bg-nexus-violet/25',
  },
  {
    tag: 'model',
    label: 'Modelo',
    icon: Cpu,
    description: 'Trocas de modelo ou parâmetros (temperature, max_tokens).',
    activeClass: 'bg-nexus-emerald/15 text-nexus-emerald border-nexus-emerald/40 hover:bg-nexus-emerald/25',
  },
  {
    tag: 'rollback',
    label: 'Rollback',
    icon: RotateCcw,
    description: 'Versões criadas a partir de uma restauração.',
    activeClass: 'bg-foreground/10 text-foreground border-foreground/30 hover:bg-foreground/20',
  },
  {
    tag: 'failure',
    label: 'Erro',
    icon: AlertTriangle,
    description: 'Marcadas como falha, regressão ou bug.',
    activeClass: 'bg-destructive/15 text-destructive border-destructive/40 hover:bg-destructive/25',
  },
];

interface Props {
  /** Conjunto atual de tags ativas. */
  active: Set<TimelineTag>;
  onToggle: (tag: TimelineTag) => void;
  onClear: () => void;
  /** Contagem por tag (sobre a lista pré-filtro), opcional para badge. */
  counts?: Partial<Record<TimelineTag, number>>;
}

export function EventTypeFilter({ active, onToggle, onClear, counts }: Props) {
  const hasAny = active.size > 0;
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          Tipo
        </span>
        {EVENT_TYPES.map(({ tag, label, icon: Icon, description, activeClass }) => {
          const isOn = active.has(tag);
          const count = counts?.[tag];
          return (
            <Tooltip key={tag}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-pressed={isOn}
                  onClick={() => onToggle(tag)}
                  className={`h-6 px-2 text-[11px] gap-1 border transition-colors ${
                    isOn
                      ? activeClass
                      : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {label}
                  {typeof count === 'number' && (
                    <span className={`text-[9px] font-mono px-1 rounded ${
                      isOn ? 'bg-current/20' : 'bg-secondary/60 text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                {description}
              </TooltipContent>
            </Tooltip>
          );
        })}
        {hasAny && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClear}
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-destructive gap-1"
            title="Remover todos os filtros de tipo"
          >
            <X className="h-2.5 w-2.5" /> Limpar
          </Button>
        )}
      </div>
    </TooltipProvider>
  );
}
