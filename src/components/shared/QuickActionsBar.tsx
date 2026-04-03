import { useNavigate } from "react-router-dom";
import { LucideIcon } from "lucide-react";

interface QuickAction {
  label: string;
  icon: LucideIcon;
  onClick?: () => void;
  path?: string;
  variant?: 'default' | 'primary';
}

interface QuickActionsBarProps {
  actions: QuickAction[];
}

export function QuickActionsBar({ actions }: QuickActionsBarProps) {
  const navigate = useNavigate();

  if (actions.length === 0) return null;

  return (
    <div className="flex items-center gap-2 flex-wrap" role="toolbar" aria-label="Ações rápidas">
      {actions.map((action) => {
        const Icon = action.icon;
        const isPrimary = action.variant === 'primary';
        return (
          <button
            key={action.label}
            onClick={() => {
              if (action.onClick) action.onClick();
              else if (action.path) navigate(action.path);
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all min-h-[32px] ${
              isPrimary
                ? 'nexus-gradient-bg text-primary-foreground hover:opacity-90'
                : 'border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:border-primary/30 hover:bg-primary/5'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
