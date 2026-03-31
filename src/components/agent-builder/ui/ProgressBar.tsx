import { cn } from '@/lib/utils';

interface ProgressBarProps {
  value: number;
  max?: number;
  color?: string;
  className?: string;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  label?: string;
}

export function ProgressBar({ value, max = 100, color, className, showLabel, size = 'sm', label }: ProgressBarProps) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div
        className={cn('flex-1 rounded-full bg-muted overflow-hidden', size === 'sm' ? 'h-1.5' : 'h-2.5')}
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? `Progresso: ${Math.round(pct)}%`}
      >
        <div
          className="h-full rounded-full transition-all duration-800 ease-out"
          style={{
            width: `${pct}%`,
            background: color ?? 'hsl(var(--primary))',
          }}
        />
      </div>
      {showLabel && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{Math.round(pct)}%</span>}
    </div>
  );
}
