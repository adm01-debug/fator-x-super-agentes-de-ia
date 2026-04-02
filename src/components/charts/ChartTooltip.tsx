import { type TooltipState } from './types';

interface Props {
  tooltip: TooltipState | null;
  containerRect?: DOMRect | null;
}

export function ChartTooltip({ tooltip }: Props) {
  if (!tooltip) return null;

  return (
    <div
      className="absolute pointer-events-none z-50 rounded-lg border border-border/50 bg-card px-2.5 py-1.5 text-xs shadow-xl"
      style={{
        left: tooltip.x,
        top: tooltip.y,
        transform: 'translate(-50%, -110%)',
      }}
    >
      {tooltip.items.map((item, i) => (
        <div key={i} className="flex items-center gap-2 whitespace-nowrap">
          <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          <span className="text-muted-foreground">{item.label}</span>
          <span className="font-mono font-medium text-foreground ml-auto pl-3">{item.value}</span>
        </div>
      ))}
    </div>
  );
}
