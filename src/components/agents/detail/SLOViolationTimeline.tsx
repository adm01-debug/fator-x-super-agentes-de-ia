import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import type { ViolationDay } from './agentMetricsHelpers';
import type { DailyPoint } from './agentMetricsHelpers';

interface Props {
  data: ViolationDay[];
  daily: DailyPoint[];
  onDayClick?: (day: DailyPoint) => void;
}

const SEGMENTS = 14;

export function SLOViolationTimeline({ data, daily, onDayClick }: Props) {
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
                  <span className="text-[11px] tabular-nums text-muted-foreground min-w-[80px] text-right">
                    {totalViolations === 0 ? 'sem violações' : `${totalViolations} violaç${totalViolations === 1 ? 'ão' : 'ões'}`}
                  </span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs">
                <div className="space-y-0.5">
                  <p className="font-semibold">{day.label} · {day.total} trace{day.total !== 1 ? 's' : ''}</p>
                  <p className="text-nexus-amber">⚠ {day.p95Violations} acima de p95</p>
                  <p className="text-destructive">✕ {day.p99Violations} acima de p99</p>
                  <p className="text-destructive">● {day.errors} erro{day.errors !== 1 ? 's' : ''}</p>
                  <p className="text-muted-foreground pt-1 border-t border-border/50 mt-1">Clique para detalhar</p>
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
