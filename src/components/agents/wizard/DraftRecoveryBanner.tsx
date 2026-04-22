import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Check, FileClock, FolderOpen, Minus, X } from 'lucide-react';

export interface DraftSummary {
  name: string;
  hasIdentity: boolean;
  hasType: boolean;
  hasModel: boolean;
  hasPrompt: boolean;
}

export interface DraftBannerEntry {
  id: string;
  savedAt: string;
  summary: DraftSummary;
  typeLabel?: string;
  restorable?: boolean;
  restoreBlockedReason?: string;
}

interface DraftRecoveryBannerProps {
  drafts: DraftBannerEntry[];
  onRestore: (id: string) => void;
  onDiscardOne: (id: string) => void;
  onDiscardAll: () => void;
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'há pouco tempo';
  const diffMs = Date.now() - then;
  const min = Math.round(diffMs / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} ${min === 1 ? 'minuto' : 'minutos'}`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `há ${hr} ${hr === 1 ? 'hora' : 'horas'}`;
  const d = Math.round(hr / 24);
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`;
}

function StatusChip({ label, ok }: { label: string; ok: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border ${
        ok
          ? 'border-nexus-emerald/30 bg-nexus-emerald/10 text-nexus-emerald'
          : 'border-border/50 bg-secondary/40 text-muted-foreground'
      }`}
    >
      {ok ? <Check className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
      {label}
    </span>
  );
}

function subjectOf(summary: DraftSummary): string {
  return summary.name.trim() ? `"${summary.name.trim()}"` : 'sem nome ainda';
}

export function DraftRecoveryBanner({
  drafts,
  onRestore,
  onDiscardOne,
  onDiscardAll,
}: DraftRecoveryBannerProps) {
  const [selectedId, setSelectedId] = useState<string>(drafts[0]?.id ?? '');
  const itemsRef = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (!drafts.find((d) => d.id === selectedId)) {
      setSelectedId(drafts[0]?.id ?? '');
    }
  }, [drafts, selectedId]);

  if (drafts.length === 0) return null;

  // ───── Single-draft mode (compat) ─────
  if (drafts.length === 1) {
    const only = drafts[0];
    const blocked = only.restorable === false;
    return (
      <div
        role="status"
        aria-live="polite"
        className="nexus-card animate-page-enter border-primary/30 bg-primary/5 space-y-3"
      >
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <FileClock className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-sm font-heading font-semibold text-foreground">
              Rascunho encontrado
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Você começou um agente {subjectOf(only.summary)} {formatRelative(only.savedAt)}. Quer continuar de onde parou?
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <StatusChip label="Identidade" ok={only.summary.hasIdentity} />
          <StatusChip label="Tipo" ok={only.summary.hasType} />
          <StatusChip label="Modelo" ok={only.summary.hasModel} />
          <StatusChip label="Prompt" ok={only.summary.hasPrompt} />
          {blocked && (
            <span className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-warning/30 bg-warning/10 text-warning">
              Incompleto
            </span>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={() => onDiscardOne(only.id)} className="gap-1.5">
            <X className="h-3.5 w-3.5" /> Descartar
          </Button>
          <Button
            size="sm"
            onClick={() => onRestore(only.id)}
            autoFocus
            disabled={blocked}
            title={blocked ? (only.restoreBlockedReason ?? 'Rascunho incompleto demais para retomar') : undefined}
            className="gap-1.5 nexus-gradient-bg text-primary-foreground"
          >
            Continuar de onde parei
          </Button>
        </div>
      </div>
    );
  }

  // ───── Multi-draft mode ─────
  const handleKeyNav = (e: React.KeyboardEvent, currentIdx: number) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const nextIdx =
      e.key === 'ArrowDown'
        ? (currentIdx + 1) % drafts.length
        : (currentIdx - 1 + drafts.length) % drafts.length;
    const nextId = drafts[nextIdx].id;
    setSelectedId(nextId);
    itemsRef.current[nextId]?.focus();
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className="nexus-card animate-page-enter border-primary/30 bg-primary/5 space-y-3"
    >
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <FolderOpen className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-heading font-semibold text-foreground">
            {drafts.length} rascunhos encontrados
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Selecione qual deseja retomar. Os outros continuam salvos.
          </p>
        </div>
      </div>

      <div role="radiogroup" aria-label="Rascunhos disponíveis" className="space-y-1.5">
        {drafts.map((d, idx) => {
          const checked = selectedId === d.id;
          return (
            <div
              key={d.id}
              ref={(el) => { itemsRef.current[d.id] = el; }}
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              onClick={() => setSelectedId(d.id)}
              onKeyDown={(e) => {
                handleKeyNav(e, idx);
                if (e.key === ' ' || e.key === 'Enter') {
                  e.preventDefault();
                  setSelectedId(d.id);
                }
              }}
              className={`group flex items-start gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                checked
                  ? 'border-primary/50 bg-primary/10'
                  : 'border-border/50 bg-background/40 hover:border-border hover:bg-background/60'
              }`}
            >
              <div
                className={`mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                  checked ? 'border-primary' : 'border-muted-foreground/40'
                }`}
                aria-hidden
              >
                {checked && <div className="h-2 w-2 rounded-full bg-primary" />}
              </div>

              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {subjectOf(d.summary)}
                  </span>
                  {d.typeLabel && (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-secondary/60 text-muted-foreground">
                      {d.typeLabel}
                    </span>
                  )}
                  <span className="text-[11px] text-muted-foreground">·</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatRelative(d.savedAt)}
                  </span>
                  {d.restorable === false && (
                    <span
                      className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded border border-warning/30 bg-warning/10 text-warning"
                      title={d.restoreBlockedReason ?? 'Incompleto demais para retomar'}
                    >
                      Incompleto
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1">
                  <StatusChip label="Identidade" ok={d.summary.hasIdentity} />
                  <StatusChip label="Tipo" ok={d.summary.hasType} />
                  <StatusChip label="Modelo" ok={d.summary.hasModel} />
                  <StatusChip label="Prompt" ok={d.summary.hasPrompt} />
                </div>
              </div>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDiscardOne(d.id);
                }}
                className="opacity-60 hover:opacity-100 hover:text-destructive transition shrink-0 p-1 rounded-md hover:bg-destructive/10"
                aria-label={`Descartar rascunho ${subjectOf(d.summary)}`}
                title="Descartar este rascunho"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2 pt-1">
        <Button variant="ghost" size="sm" onClick={onDiscardAll} className="gap-1.5 text-muted-foreground hover:text-destructive">
          <X className="h-3.5 w-3.5" /> Descartar todos
        </Button>
        {(() => {
          const selected = drafts.find((d) => d.id === selectedId);
          const blocked = selected?.restorable === false;
          return (
            <Button
              size="sm"
              onClick={() => selectedId && onRestore(selectedId)}
              disabled={!selectedId || blocked}
              title={blocked ? (selected?.restoreBlockedReason ?? 'Rascunho incompleto demais para retomar') : undefined}
              className="gap-1.5 nexus-gradient-bg text-primary-foreground"
            >
              Continuar selecionado
            </Button>
          );
        })()}
      </div>
    </div>
  );
}
