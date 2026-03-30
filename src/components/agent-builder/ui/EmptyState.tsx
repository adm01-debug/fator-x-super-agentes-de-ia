import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon?: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({ icon = '📭', title, description, actionLabel, onAction, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 text-center', className)}>
      <span className="text-4xl mb-3">{icon}</span>
      <h3 className="text-sm font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-xs text-muted-foreground max-w-xs mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button size="sm" onClick={onAction} className="nexus-gradient-bg text-white">
          {actionLabel}
        </Button>
      )}
    </div>
  );
}
