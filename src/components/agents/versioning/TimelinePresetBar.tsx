import { Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TIMELINE_PRESETS } from './timelineFilters';

interface Props {
  activePresetId: string;
  onChange: (presetId: string) => void;
  /** Contagem de versões que casam com cada preset, opcional para badge. */
  counts?: Record<string, number>;
}

export function TimelinePresetBar({ activePresetId, onChange, counts }: Props) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <Filter className="h-3 w-3 text-muted-foreground" aria-hidden />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mr-1">
          Presets
        </span>
        {TIMELINE_PRESETS.map((preset) => {
          const isActive = preset.id === activePresetId;
          const count = counts?.[preset.id];
          return (
            <Tooltip key={preset.id}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  size="sm"
                  variant={isActive ? 'default' : 'ghost'}
                  onClick={() => onChange(preset.id)}
                  aria-pressed={isActive}
                  className={`h-6 px-2 text-[11px] gap-1 ${
                    isActive
                      ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {preset.label}
                  {typeof count === 'number' && (
                    <span className={`text-[9px] font-mono px-1 rounded ${
                      isActive ? 'bg-primary/20 text-primary' : 'bg-secondary/60 text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                {preset.description}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
