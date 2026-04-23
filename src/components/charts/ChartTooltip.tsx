import { type TooltipState } from './types';

interface Props {
  tooltip: TooltipState | null;
  containerRect?: DOMRect | null;
}

export function ChartTooltip({ tooltip }: Props) {
  if (!tooltip) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs shadow-xl min-w-[160px] max-w-[260px]"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: 'translate(-50%, -110%)',
      }}
    >
      {tooltip.title && (
        <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
          {tooltip.title}
        </div>
      )}
      {tooltip.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-mono font-medium text-foreground ml-auto pl-3">{item.value}</span>
        </div>
      ))}
      {tooltip.extras?.map((section, si) => (
        <div key={si} className="mt-1.5 pt-1.5 border-t border-border/40">
          {section.title && (
            <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              {section.title}
            </div>
          )}
          {section.rows.map((row, ri) => (
            <div key={ri} className="flex items-center gap-2 whitespace-nowrap">
              {row.color !== undefined ? (
                <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: row.color }} />
              ) : (
                <div className="h-2 w-2 shrink-0" />
              )}
              <span className="text-muted-foreground">{row.label}</span>
              {row.value !== undefined && (
                <span className="font-mono font-medium text-foreground ml-auto pl-3">{row.value}</span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
