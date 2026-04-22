import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { SectionLocation } from '@/lib/promptSectionLocator';

interface Props {
  locations: SectionLocation[];
  /** Total visible lines in the editor (used to position 'ok'/'thin' markers proportionally). */
  totalLines: number;
  /** Section currently pulsed (just jumped to). */
  activeKey?: string | null;
  onJump: (loc: SectionLocation) => void;
}

/**
 * Vertical rail rendered to the left of the textarea showing one marker per
 * required section. Color-coded by status; clicking jumps the editor to the
 * exact line (or insertion point for missing sections).
 *
 * Markers for `ok`/`thin` are positioned proportionally to where their heading
 * lives in the prompt. `missing` markers stack at the bottom (after the last
 * existing one) so the user always sees all 4 slots.
 */
export function PromptSectionGutter({ locations, totalLines, activeKey, onJump }: Props) {
  const denom = Math.max(totalLines, 1);

  return (
    <TooltipProvider delayDuration={200}>
      <ol
        aria-label="Mapa de seções do prompt"
        className="absolute left-0 top-0 bottom-0 w-7 flex flex-col items-center pt-3 pb-3 z-20 pointer-events-none"
      >
        {locations.map((loc, idx) => {
          // ok/thin → proportional to heading line; missing → distribute evenly across the rail.
          const proportional = loc.status === 'missing'
            ? ((idx + 0.5) / locations.length) * 100
            : Math.min(95, Math.max(2, (loc.headingLine / denom) * 100));

          const isActive = activeKey === loc.key;
          const Icon =
            loc.status === 'ok' ? CheckCircle2 :
            loc.status === 'thin' ? AlertTriangle : Circle;

          const colorClass =
            loc.status === 'ok' ? 'text-nexus-emerald' :
            loc.status === 'thin' ? 'text-nexus-amber' : 'text-muted-foreground';

          const ringClass =
            loc.status === 'ok' ? 'ring-nexus-emerald/40' :
            loc.status === 'thin' ? 'ring-nexus-amber/50' : 'ring-border';

          const tooltip =
            loc.status === 'ok'
              ? `${loc.label}: detectada ✓`
              : loc.status === 'thin'
              ? `${loc.label}: ${loc.thinReason ?? 'rasa'} — clique para ir`
              : `${loc.label}: faltando — clique para inserir aqui`;

          return (
            <li
              key={loc.key}
              className="absolute left-1/2 -translate-x-1/2 pointer-events-auto"
              style={{ top: `${proportional}%` }}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    onClick={() => onJump(loc)}
                    aria-label={tooltip}
                    className={cn(
                      'h-5 w-5 rounded-full bg-background flex items-center justify-center ring-2 transition-all',
                      ringClass,
                      colorClass,
                      'hover:scale-125',
                      loc.status === 'thin' && 'animate-pulse',
                      loc.status === 'missing' && 'border border-dashed border-muted-foreground/40',
                      isActive && 'scale-125 ring-4',
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span className="sr-only">{tooltip}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent side="left" className="text-xs">
                  <div className="font-medium">{loc.label}</div>
                  <div className="text-[10px] text-muted-foreground">
                    {loc.status === 'ok' && `Linha ${loc.headingLine + 1} · OK`}
                    {loc.status === 'thin' && `Linha ${loc.headingLine + 1} · ${loc.thinReason}`}
                    {loc.status === 'missing' && `Inserir antes da linha ${loc.headingLine + 1}`}
                  </div>
                </TooltipContent>
              </Tooltip>
            </li>
          );
        })}
      </ol>
    </TooltipProvider>
  );
}
