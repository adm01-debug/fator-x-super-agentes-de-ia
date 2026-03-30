import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface CollapsibleCardProps {
  icon?: string;
  title: string;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  accentColor?: string;
}

export function CollapsibleCard({ icon, title, subtitle, badge, defaultOpen = false, children, className, accentColor }: CollapsibleCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div
        className={cn('rounded-xl border bg-card transition-all duration-300', open && 'border-primary/20', className)}
        style={open && accentColor ? { borderColor: `${accentColor}40` } : undefined}
      >
        <CollapsibleTrigger asChild>
          <button className="flex items-center justify-between w-full px-4 py-3 text-left hover:bg-muted/20 rounded-xl transition-colors">
            <div className="flex items-center gap-2.5 min-w-0">
              {icon && <span className="text-lg">{icon}</span>}
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{title}</span>
                  {badge}
                </div>
                {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
              </div>
            </div>
            <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0', open && 'rotate-180')} />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 pb-4 pt-1">{children}</div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
