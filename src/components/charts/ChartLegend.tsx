import { type LegendItem } from './types';

export function ChartLegend({ items }: { items: LegendItem[] }) {
  return (
    <div className="flex items-center justify-center gap-4 pt-2">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <div className="h-2 w-2 rounded-sm shrink-0" style={{ backgroundColor: item.color }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}
