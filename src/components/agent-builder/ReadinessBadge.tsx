import { useMemo } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAgentBuilderStore } from '@/stores/agentBuilderStore';
import { computeReadinessScore, READINESS_COLORS } from '@/lib/agentReadiness';
import { Check, X, Sparkles } from 'lucide-react';
import { TABS } from '@/data/agentBuilderData';

export function ReadinessBadge() {
  const agent = useAgentBuilderStore((s) => s.agent);
  const setActiveTab = useAgentBuilderStore((s) => s.setActiveTab);
  const result = useMemo(() => computeReadinessScore(agent), [agent]);
  const colors = READINESS_COLORS[result.level];

  const tabLabel = (tabId: string) => TABS.find((t) => t.id === tabId)?.label ?? tabId;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all hover:scale-105 ${colors.bg} ${colors.text} ${colors.border}`}
          aria-label={`Score de prontidão: ${result.score} de 10`}
        >
          <Sparkles className="h-3 w-3" />
          <span>{result.score}/10</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className={`px-4 py-3 border-b ${colors.bg}`}>
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Score de Prontidão</div>
              <div className={`text-2xl font-bold ${colors.text}`}>{result.score}/10</div>
            </div>
            <div className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${colors.text} ${colors.border} border`}>
              {colors.label.toUpperCase()}
            </div>
          </div>
          <div className="mt-2 h-1.5 rounded-full bg-background/50 overflow-hidden">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${(result.passed / result.total) * 100}%`,
                background: 'linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)))',
              }}
            />
          </div>
          <div className="text-[11px] text-muted-foreground mt-1.5">
            {result.passed} de {result.total} critérios atendidos
          </div>
        </div>
        <div className="max-h-72 overflow-y-auto p-2 space-y-0.5">
          {result.checks.map((c) => (
            <button
              key={c.id}
              onClick={() => setActiveTab(c.tabId)}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs hover:bg-muted/50 transition-colors group"
            >
              {c.passed ? (
                <Check className="h-3.5 w-3.5 text-nexus-emerald shrink-0" />
              ) : (
                <X className="h-3.5 w-3.5 text-destructive shrink-0" />
              )}
              <span className={`flex-1 ${c.passed ? 'text-muted-foreground line-through' : 'text-foreground'}`}>
                {c.label}
              </span>
              {!c.passed && (
                <span className="text-[10px] text-muted-foreground group-hover:text-primary transition-colors">
                  → {tabLabel(c.tabId)}
                </span>
              )}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
