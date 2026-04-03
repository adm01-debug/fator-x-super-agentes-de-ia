import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  description?: string;
  className?: string;
}

export function SliderField({ label, value, onChange, min = 0, max = 100, step = 1, unit = '', description, className }: SliderFieldProps) {
  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-foreground">{label}</label>
        <span className="text-xs font-mono text-primary font-semibold">
          {value}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
        className="w-full"
      />
      {description && <p className="text-[11px] text-muted-foreground">{description}</p>}
    </div>
  );
}
