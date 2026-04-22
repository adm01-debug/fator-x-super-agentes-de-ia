/**
 * PromptLockEventLog
 * Small in-page activity log that shows when the prompt's "Custom" mode
 * was locked (manual edit) and when it was unlocked (template applied,
 * variant applied, type changed, draft restored, safe reset, manual unlock).
 *
 * Pure presentational — events are owned by the wizard.
 */
import { useState } from 'react';
import { ChevronDown, Lock, Unlock, History } from 'lucide-react';
import { cn } from '@/lib/utils';

export type PromptLockEventKind =
  | 'locked-manual-edit'
  | 'locked-paste'
  | 'unlocked-template'
  | 'unlocked-variant'
  | 'unlocked-type-change'
  | 'unlocked-draft-restore'
  | 'unlocked-safe-reset'
  | 'unlocked-manual'
  | 'unlocked-restore-template';

export interface PromptLockEvent {
  id: string;
  at: number;
  kind: PromptLockEventKind;
  /** Short context — variant label, type label, template name, draft name, etc. */
  detail?: string;
}

const KIND_LABEL: Record<PromptLockEventKind, string> = {
  'locked-manual-edit': 'Modo Custom travado (edição manual)',
  'locked-paste': 'Modo Custom travado (conteúdo colado)',
  'unlocked-template': 'Destravado — template aplicado',
  'unlocked-variant': 'Destravado — variação aplicada',
  'unlocked-type-change': 'Destravado — tipo do agente alterado',
  'unlocked-draft-restore': 'Destravado — rascunho restaurado',
  'unlocked-safe-reset': 'Destravado — estado seguro restaurado',
  'unlocked-manual': 'Destravado manualmente',
  'unlocked-restore-template': 'Destravado — prompt restaurado do template',
};

function formatTime(ts: number): string {
  try {
    return new Date(ts).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

interface Props {
  events: PromptLockEvent[];
  /** Maximum number of events to display (newest first). Default 8. */
  max?: number;
}

export function PromptLockEventLog({ events, max = 8 }: Props) {
  const [open, setOpen] = useState(true);
  if (events.length === 0) return null;

  const sorted = [...events].sort((a, b) => b.at - a.at).slice(0, max);
  const last = sorted[0];
  const isLocked = last.kind === 'locked-manual-edit';

  return (
    <div className="rounded-lg border border-border/60 bg-secondary/30 text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((x) => !x)}
        aria-expanded={open}
        className="w-full flex items-center gap-2 px-2.5 py-1.5 hover:bg-secondary/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-colors"
      >
        <History className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <span className="text-[11px] font-medium text-foreground">Histórico de bloqueio Custom</span>
        <span
          className={cn(
            'ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono',
            isLocked
              ? 'bg-nexus-amber/15 text-nexus-amber'
              : 'bg-nexus-emerald/15 text-nexus-emerald',
          )}
          title={isLocked ? 'Estado atual: travado' : 'Estado atual: destravado'}
        >
          {isLocked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
          {isLocked ? 'Travado' : 'Destravado'}
        </span>
        <span className="ml-auto text-[10px] text-muted-foreground font-mono">
          {events.length} evento{events.length === 1 ? '' : 's'}
        </span>
        <ChevronDown
          className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', open && 'rotate-180')}
        />
      </button>

      {open && (
        <ul className="divide-y divide-border/40 border-t border-border/40 max-h-40 overflow-y-auto" aria-label="Eventos de bloqueio do prompt">
          {sorted.map((ev) => {
            const locked = ev.kind === 'locked-manual-edit';
            return (
              <li key={ev.id} className="flex items-start gap-2 px-2.5 py-1.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full',
                    locked ? 'bg-nexus-amber/15 text-nexus-amber' : 'bg-nexus-emerald/15 text-nexus-emerald',
                  )}
                  aria-hidden
                >
                  {locked ? <Lock className="h-2.5 w-2.5" /> : <Unlock className="h-2.5 w-2.5" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-foreground leading-snug">
                    {KIND_LABEL[ev.kind]}
                    {ev.detail && (
                      <span className="text-muted-foreground"> — {ev.detail}</span>
                    )}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                  {formatTime(ev.at)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
