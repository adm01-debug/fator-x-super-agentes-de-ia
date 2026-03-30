import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

interface PipelineStep {
  icon: string;
  label: string;
  sublabel?: string;
  color?: string;
}

interface PipelineFlowProps {
  steps: PipelineStep[];
  className?: string;
}

export function PipelineFlow({ steps, className }: PipelineFlowProps) {
  return (
    <div className={cn('flex items-center gap-1 overflow-x-auto py-3 px-1 scrollbar-hide', className)}>
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1 shrink-0">
          <div
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border bg-card text-xs transition-all hover:bg-muted/30"
            style={step.color ? { borderColor: `${step.color}40` } : undefined}
          >
            <span className="text-sm">{step.icon}</span>
            <div className="min-w-0">
              <span className="font-medium text-foreground whitespace-nowrap">{step.label}</span>
              {step.sublabel && (
                <span className="block text-[10px] text-muted-foreground">{step.sublabel}</span>
              )}
            </div>
          </div>
          {i < steps.length - 1 && (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}
