import { cn } from '@/lib/utils';

interface ConfigCardProps {
  icon?: string;
  title: string;
  description?: string;
  selected?: boolean;
  onClick?: () => void;
  accentColor?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  disabled?: boolean;
}

export function ConfigCard({
  icon,
  title,
  description,
  selected,
  onClick,
  accentColor,
  badge,
  children,
  className,
  disabled,
}: ConfigCardProps) {
  const isClickable = !!onClick && !disabled;

  return (
    <div
      role={isClickable ? 'button' : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onClick={isClickable ? onClick : undefined}
      onKeyDown={isClickable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick?.(); } } : undefined}
      className={cn(
        'rounded-xl border p-4 transition-all duration-300',
        isClickable && 'cursor-pointer',
        selected
          ? 'border-primary/60 bg-primary/5 shadow-[0_0_30px_-10px_hsl(var(--primary)/0.15)]'
          : 'border-border bg-card hover:bg-card/80',
        isClickable && !selected && 'hover:border-primary/30 hover:shadow-[0_0_30px_-10px_hsl(var(--primary)/0.08)]',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      style={selected && accentColor ? { borderColor: accentColor, boxShadow: `0 0 30px -10px ${accentColor}25` } : undefined}
    >
      <div className="flex items-start gap-3">
        {icon && <span className="text-xl shrink-0 mt-0.5">{icon}</span>}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">{title}</span>
            {badge}
          </div>
          {description && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    </div>
  );
}
