import { LucideIcon, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
  illustration?: 'default' | 'agents' | 'data' | 'search';
}

const ILLUSTRATIONS: Record<string, string> = {
  default: '📭',
  agents: '🤖',
  data: '📊',
  search: '🔍',
};

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
  illustration = 'default',
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center animate-fade-in-up" role="status" aria-label={title}>
      {/* Illustrated circle with glow */}
      <div className="relative mb-6">
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center border border-primary/10" aria-hidden="true">
          <span className="text-3xl">{ILLUSTRATIONS[illustration]}</span>
        </div>
        <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-xl bg-card border border-border flex items-center justify-center shadow-sm">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      <h3 className="text-lg font-heading font-semibold text-foreground mb-1.5">{title}</h3>
      {description && (
        <p className="text-sm text-muted-foreground max-w-md leading-relaxed">{description}</p>
      )}

      <div className="flex items-center gap-2 mt-5">
        {actionLabel && onAction && (
          <Button onClick={onAction} size="sm" className="gap-1.5">
            {actionLabel}
          </Button>
        )}
        {secondaryLabel && onSecondary && (
          <Button onClick={onSecondary} variant="outline" size="sm" className="gap-1.5">
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
