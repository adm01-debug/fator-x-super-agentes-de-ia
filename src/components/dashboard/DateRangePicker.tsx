import { Button } from "@/components/ui/button";
import { Calendar } from "lucide-react";

export type DateRange = '7d' | '14d' | '30d' | '90d';

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: '7d', label: '7 dias' },
  { value: '14d', label: '14 dias' },
  { value: '30d', label: '30 dias' },
  { value: '90d', label: '90 dias' },
];

export function DateRangePicker({ value, onChange }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border/50 bg-secondary/30 p-0.5">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground ml-2 mr-1 shrink-0" aria-hidden="true" />
      {OPTIONS.map(opt => (
        <Button
          key={opt.value}
          variant="ghost"
          size="sm"
          onClick={() => onChange(opt.value)}
          className={`h-7 px-2.5 text-xs font-medium rounded-md transition-all ${
            value === opt.value
              ? 'bg-primary/10 text-primary shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {opt.label}
        </Button>
      ))}
    </div>
  );
}

export function getDateRangeDays(range: DateRange): number {
  switch (range) {
    case '7d': return 7;
    case '14d': return 14;
    case '30d': return 30;
    case '90d': return 90;
  }
}
