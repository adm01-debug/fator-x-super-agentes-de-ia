import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ViolationDay } from './agentMetricsHelpers';
import type { DailyPoint } from './agentMetricsHelpers';

export type ViolationKind = 'p95' | 'p99' | 'error';

interface Props {
  data: ViolationDay[];
  daily: DailyPoint[];
  onDayClick?: (day: DailyPoint) => void;
  onViolationClick?: (bucket: ViolationDay, kind: ViolationKind) => void;
}

const SEGMENTS = 14;

export function SLOViolationTimeline({ data, daily, onDayClick, onViolationClick }: Props) {
  const maxSeverity = Math.max(1, ...data.map((d) => d.p95Violations + d.p99Violations * 2 + d.errors * 2));
  const dailyByDate = new Map(daily.map((d) => [d.date, d]));

  const handleClick = (date: string) => {
    const d = dailyByDate.get(date);
    if (d && onDayClick) onDayClick(d);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div role="list" className="space-y-1.5">
        {data.map((day) => {
          const severity = day.p95Violations + day.p99Violations * 2 + day.errors * 2;
          const filled = Math.min(SEGMENTS, Math.round((severity / maxSeverity) * SEGMENTS));
          const status: 'healthy' | 'warning' | 'critical' =
            day.errors > 0 || day.p99Violations > 0 ? 'critical' : day.p95Violations > 0 ? 'warning' : 'healthy';
          const segColor =
            status === 'critical' ? 'bg-destructive' : status === 'warning' ? 'bg-nexus-amber' : 'bg-nexus-emerald';
          const totalViolations = day.p95Violations + day.p99Violations + day.errors;

          const handleViolationClick = (e: React.MouseEvent, kind: ViolationKind) => {
            e.stopPropagation();
            onViolationClick?.(day, kind);
          };

          return (
            <Tooltip key={day.date}>
              <TooltipTrigger asChild>
                <div
                  role="listitem"
                  tabIndex={0}
                  onClick={() => handleClick(day.date)}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleClick(day.date); } }}
                  className="grid grid-cols-[44px_1fr_auto] items-center gap-3 py-1 px-2 -mx-2 rounded-md hover:bg-secondary/40 cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="text-[11px] font-mono text-muted-foreground tabular-nums">{day.label}</span>
                  <div className="flex items-center gap-0.5">
                    {Array.from({ length: SEGMENTS }).map((_, i) => (
                      <div
                        key={i}
                        className={`h-2.5 flex-1 rounded-sm ${i < filled ? segColor : 'bg-secondary/60'}`}
                      />
                    ))}
                  </div>
                  <div className="flex items-center gap-1 min-w-[80px] justify-end">
                    {totalViolations === 0 ? (
                      <span className="text-[11px] tabular-nums text-muted-foreground">sem violações</span>
                    ) : (
                      <>
                        {day.p95Violations > 0 && (
                          <button
                            type="button"
                            onClick={(e) => handleViolationClick(e, 'p95')}
                            className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-nexus-amber/15 text-nexus-amber hover:bg-nexus-amber/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-nexus-amber"
                            aria-label={`${day.p95Violations} violações p95 — abrir drill-down`}
                            title="Detalhar violações p95"
                          >
                            ⚠ {day.p95Violations}
                          </button>
                        )}
                        {day.p99Violations > 0 && (
                          <button
                            type="button"
                            onClick={(e) => handleViolationClick(e, 'p99')}
                            className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                            aria-label={`${day.p99Violations} violações p99 — abrir drill-down`}
                            title="Detalhar violações p99"
                          >
                            ✕ {day.p99Violations}
                          </button>
                        )}
                        {day.errors > 0 && (
                          <button
                            type="button"
                            onClick={(e) => handleViolationClick(e, 'error')}
                            className="px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded bg-destructive/15 text-destructive hover:bg-destructive/25 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive"
                            aria-label={`${day.errors} erros — abrir drill-down`}
                            title="Detalhar erros / critical"
                          >
                            ● {day.errors}
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold">{day.label} · {day.total} trace{day.total !== 1 ? 's' : ''}</p>
                  <p className="text-nexus-amber">⚠ {day.p95Violations} acima de p95</p>
                  <p className="text-destructive">✕ {day.p99Violations} acima de p99</p>
                  <p className="text-destructive">● {day.errors} erro{day.errors !== 1 ? 's' : ''}</p>
                  <p className="text-muted-foreground pt-1 border-t border-border/50 mt-1">
                    Clique numa pílula para drill-down por tipo · linha = visão geral
                  </p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
