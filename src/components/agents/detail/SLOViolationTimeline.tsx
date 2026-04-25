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
              <TooltipContent side="top" className="text-xs max-w-[280px]">
                <div className="space-y-1">
                  <p className="font-semibold">{day.label} · {day.total} trace{day.total !== 1 ? 's' : ''}</p>

                  <div className="pt-1 border-t border-border/50 space-y-0.5">
                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">Latência observada</p>
                    <div className="flex justify-between gap-3 font-mono">
                      <span className="text-muted-foreground">p50</span>
                      <span>{day.p50Ms}ms</span>
                    </div>
                    <div className="flex justify-between gap-3 font-mono">
                      <span className="text-muted-foreground">p95</span>
                      <span className={day.p95Ms > day.thresholds.p95 ? 'text-nexus-amber font-semibold' : ''}>
                        {day.p95Ms}ms
                      </span>
                    </div>
                    {day.maxLatencyMs > day.thresholds.p99 && (
                      <div className="flex justify-between gap-3 font-mono">
                        <span className="text-muted-foreground">máx</span>
                        <span className="text-destructive font-semibold">{day.maxLatencyMs}ms</span>
                      </div>
                    )}
                  </div>

                  {day.matchedRules.length > 0 ? (
                    <div className="pt-1 border-t border-border/50 space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold">
                        Regras correspondidas ({day.matchedRules.length})
                      </p>
                      {day.matchedRules.includes('p95') && (
                        <p className="text-nexus-amber">
                          ⚠ p95 &gt; {day.thresholds.p95}ms — {day.p95Violations} trace{day.p95Violations !== 1 ? 's' : ''}
                          {day.p95Ms > day.thresholds.p95 && (
                            <span className="text-muted-foreground"> (+{day.p95Ms - day.thresholds.p95}ms)</span>
                          )}
                        </p>
                      )}
                      {day.matchedRules.includes('p99') && (
                        <p className="text-destructive">
                          ✕ p99 &gt; {day.thresholds.p99}ms — {day.p99Violations} trace{day.p99Violations !== 1 ? 's' : ''}
                          {day.maxLatencyMs > day.thresholds.p99 && (
                            <span className="text-muted-foreground"> (+{day.maxLatencyMs - day.thresholds.p99}ms no pico)</span>
                          )}
                        </p>
                      )}
                      {day.matchedRules.includes('error') && (
                        <p className="text-destructive">
                          ● erro/critical — {day.errors} trace{day.errors !== 1 ? 's' : ''}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="pt-1 border-t border-border/50 text-nexus-emerald">✓ dentro dos SLOs</p>
                  )}

                  <p className="text-muted-foreground pt-1 border-t border-border/50 text-[10px]">
                    Clique numa pílula para drill-down · linha = visão geral
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
