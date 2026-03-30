import { cn } from '@/lib/utils';

type BadgeVariant = 'filled' | 'outline';
type BadgeColor = 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'orange' | 'teal' | 'muted';

const COLOR_MAP: Record<BadgeColor, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'bg-[hsl(var(--nexus-blue)/0.12)]',   text: 'text-[hsl(var(--nexus-blue))]',   border: 'border-[hsl(var(--nexus-blue)/0.3)]' },
  green:  { bg: 'bg-[hsl(var(--nexus-green)/0.12)]',  text: 'text-[hsl(var(--nexus-green))]',  border: 'border-[hsl(var(--nexus-green)/0.3)]' },
  yellow: { bg: 'bg-[hsl(var(--nexus-yellow)/0.12)]', text: 'text-[hsl(var(--nexus-yellow))]', border: 'border-[hsl(var(--nexus-yellow)/0.3)]' },
  red:    { bg: 'bg-[hsl(var(--nexus-red)/0.12)]',    text: 'text-[hsl(var(--nexus-red))]',    border: 'border-[hsl(var(--nexus-red)/0.3)]' },
  purple: { bg: 'bg-[hsl(var(--nexus-purple)/0.12)]', text: 'text-[hsl(var(--nexus-purple))]', border: 'border-[hsl(var(--nexus-purple)/0.3)]' },
  orange: { bg: 'bg-[hsl(var(--nexus-orange)/0.12)]', text: 'text-[hsl(var(--nexus-orange))]', border: 'border-[hsl(var(--nexus-orange)/0.3)]' },
  teal:   { bg: 'bg-[hsl(var(--nexus-teal)/0.12)]',   text: 'text-[hsl(var(--nexus-teal))]',   border: 'border-[hsl(var(--nexus-teal)/0.3)]' },
  muted:  { bg: 'bg-muted',                            text: 'text-muted-foreground',            border: 'border-border' },
};

interface NexusBadgeProps {
  children: React.ReactNode;
  color?: BadgeColor;
  variant?: BadgeVariant;
  className?: string;
}

export function NexusBadge({ children, color = 'blue', variant = 'filled', className }: NexusBadgeProps) {
  const c = COLOR_MAP[color];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold leading-tight',
        variant === 'filled' ? cn(c.bg, c.text) : cn('bg-transparent border', c.border, c.text),
        className
      )}
    >
      {children}
    </span>
  );
}
