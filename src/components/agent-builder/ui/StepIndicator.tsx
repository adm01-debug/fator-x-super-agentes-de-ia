import { cn } from '@/lib/utils';
import { TABS } from '@/data/agentBuilderData';

interface StepIndicatorProps {
  currentTab: string;
  variant?: 'text' | 'dots';
  className?: string;
}

export function StepIndicator({ currentTab, variant = 'text', className }: StepIndicatorProps) {
  const idx = TABS.findIndex((t) => t.id === currentTab);
  const current = idx + 1;

  if (variant === 'dots') {
    return (
      <div className={cn('flex items-center gap-1', className)}>
        {TABS.map((tab, i) => (
          <div
            key={tab.id}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === idx ? 'w-4 bg-primary' : i < idx ? 'w-1.5 bg-primary/40' : 'w-1.5 bg-muted'
            )}
          />
        ))}
      </div>
    );
  }

  return (
    <span className={cn('text-xs font-mono text-muted-foreground', className)}>
      {current} / {TABS.length}
    </span>
  );
}
