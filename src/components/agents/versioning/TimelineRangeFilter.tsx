import { useMemo, useState } from 'react';
import { Clock, GitBranch, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import type { AgentVersion } from '@/services/agentsService';

export type RangeMode = 'off' | 'version' | 'time';

export interface TimelineRange {
  mode: RangeMode;
  /** Version range (inclusive). Undefined = open boundary. */
  vMin?: number;
  vMax?: number;
  /** Time window minutes — quando definido, calcula a janela "últimos N min" relativa ao mais recente. */
  lastMinutes?: number;
  /** Janela absoluta entre dois timestamps ISO (inclusive). */
  fromIso?: string;
  toIso?: string;
}

interface Props {
  range: TimelineRange;
  onChange: (range: TimelineRange) => void;
  versions: AgentVersion[];
}

/** Quick presets de janela em minutos (relativo à versão mais recente). */
const QUICK_WINDOWS: Array<{ label: string; minutes: number }> = [
  { label: '15min', minutes: 15 },
  { label: '1h', minutes: 60 },
  { label: '6h', minutes: 60 * 6 },
  { label: '24h', minutes: 60 * 24 },
  { label: '7d', minutes: 60 * 24 * 7 },
];

export function TimelineRangeFilter({ range, onChange, versions }: Props) {
  const [open, setOpen] = useState(false);
  const minVersion = useMemo(
    () => versions.reduce((min, v) => Math.min(min, v.version), Number.POSITIVE_INFINITY),
    [versions],
  );
  const maxVersion = useMemo(
    () => versions.reduce((max, v) => Math.max(max, v.version), 0),
    [versions],
  );

  const isActive = range.mode !== 'off';
  const summary = useMemo(() => {
    if (range.mode === 'version') {
      const a = range.vMin ?? minVersion;
      const b = range.vMax ?? maxVersion;
      return `v${Math.min(a, b)}–v${Math.max(a, b)}`;
    }
    if (range.mode === 'time') {
      if (range.lastMinutes) {
        const m = range.lastMinutes;
        if (m < 60) return `últimos ${m}min`;
        if (m < 60 * 24) return `últimas ${Math.round(m / 60)}h`;
        return `últimos ${Math.round(m / 60 / 24)}d`;
      }
      if (range.fromIso || range.toIso) {
        const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '…');
        return `${fmt(range.fromIso)} → ${fmt(range.toIso)}`;
      }
    }
    return 'Intervalo';
  }, [range, minVersion, maxVersion]);

  const setMode = (mode: RangeMode) => {
    if (mode === 'off') return onChange({ mode: 'off' });
    if (mode === 'version') return onChange({ mode: 'version', vMin: minVersion, vMax: maxVersion });
    return onChange({ mode: 'time', lastMinutes: 60 * 24 });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant={isActive ? 'default' : 'ghost'}
          className={`h-6 px-2 text-[11px] gap-1 ${
            isActive
              ? 'bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
          aria-pressed={isActive}
        >
          <Clock className="h-3 w-3" aria-hidden />
          {isActive ? summary : 'Intervalo'}
          {isActive && (
            <span
              role="button"
              tabIndex={0}
              aria-label="Limpar intervalo"
              className="ml-0.5 hover:text-destructive"
              onClick={(e) => {
                e.stopPropagation();
                onChange({ mode: 'off' });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange({ mode: 'off' });
                }
              }}
            >
              <X className="h-2.5 w-2.5" aria-hidden />
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-3 space-y-3">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
            Tipo de intervalo
          </p>
          <div className="flex items-center gap-1">
            <Button
              type="button" size="sm"
              variant={range.mode === 'off' ? 'default' : 'ghost'}
              className="h-6 px-2 text-[11px] flex-1"
              onClick={() => setMode('off')}
            >
              Desligado
            </Button>
            <Button
              type="button" size="sm"
              variant={range.mode === 'version' ? 'default' : 'ghost'}
              className="h-6 px-2 text-[11px] gap-1 flex-1"
              onClick={() => setMode('version')}
            >
              <GitBranch className="h-3 w-3" aria-hidden /> Versão
            </Button>
            <Button
              type="button" size="sm"
              variant={range.mode === 'time' ? 'default' : 'ghost'}
              className="h-6 px-2 text-[11px] gap-1 flex-1"
              onClick={() => setMode('time')}
            >
              <Clock className="h-3 w-3" aria-hidden /> Tempo
            </Button>
          </div>
        </div>

        {range.mode === 'version' && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Entre dois checkpoints (v{minVersion}–v{maxVersion})
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span>De (vMin)</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={minVersion}
                  max={maxVersion}
                  value={range.vMin ?? minVersion}
                  className="h-7 text-xs font-mono"
                  onChange={(e) => onChange({ ...range, mode: 'version', vMin: Number(e.target.value) || minVersion })}
                />
              </label>
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span>Até (vMax)</span>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={minVersion}
                  max={maxVersion}
                  value={range.vMax ?? maxVersion}
                  className="h-7 text-xs font-mono"
                  onChange={(e) => onChange({ ...range, mode: 'version', vMax: Number(e.target.value) || maxVersion })}
                />
              </label>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Dica: você pode usar isso para focar nos passos entre os checkpoints A e B.
            </p>
          </div>
        )}

        {range.mode === 'time' && (
          <div className="space-y-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Janela rápida
            </p>
            <div className="flex flex-wrap gap-1">
              {QUICK_WINDOWS.map((w) => {
                const isCurrent = range.lastMinutes === w.minutes;
                return (
                  <Button
                    key={w.label}
                    type="button" size="sm"
                    variant={isCurrent ? 'default' : 'ghost'}
                    className={`h-6 px-2 text-[11px] ${
                      isCurrent
                        ? 'bg-primary/15 text-primary border border-primary/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    onClick={() => onChange({ mode: 'time', lastMinutes: w.minutes })}
                  >
                    {w.label}
                  </Button>
                );
              })}
            </div>

            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold pt-1">
              Janela absoluta
            </p>
            <div className="grid grid-cols-2 gap-2">
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span>De</span>
                <Input
                  type="datetime-local"
                  className="h-7 text-xs"
                  value={range.fromIso ? toLocalInput(range.fromIso) : ''}
                  onChange={(e) => onChange({ mode: 'time', lastMinutes: undefined, fromIso: fromLocalInput(e.target.value), toIso: range.toIso })}
                />
              </label>
              <label className="text-[11px] text-muted-foreground space-y-1">
                <span>Até</span>
                <Input
                  type="datetime-local"
                  className="h-7 text-xs"
                  value={range.toIso ? toLocalInput(range.toIso) : ''}
                  onChange={(e) => onChange({ mode: 'time', lastMinutes: undefined, fromIso: range.fromIso, toIso: fromLocalInput(e.target.value) })}
                />
              </label>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-border/50">
          <p className="text-[10px] text-muted-foreground">{isActive ? summary : 'Sem filtro de intervalo'}</p>
          <Button
            type="button" size="sm" variant="ghost"
            className="h-6 px-2 text-[10px] text-muted-foreground hover:text-foreground"
            onClick={() => { onChange({ mode: 'off' }); setOpen(false); }}
          >
            Limpar
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Converte ISO para o formato esperado por <input type="datetime-local"> em horário local. */
function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | undefined {
  if (!local) return undefined;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

/* ---------- helpers de filtragem reutilizáveis ---------- */

export function filterByRange(versions: AgentVersion[], range: TimelineRange): AgentVersion[] {
  if (range.mode === 'off') return versions;

  if (range.mode === 'version') {
    const lo = Math.min(range.vMin ?? -Infinity, range.vMax ?? Infinity);
    const hi = Math.max(range.vMin ?? -Infinity, range.vMax ?? Infinity);
    return versions.filter((v) => v.version >= lo && v.version <= hi);
  }

  // mode === 'time'
  if (range.lastMinutes && versions.length > 0) {
    // Âncora = versão mais recente (top da lista geralmente); usamos Math.max p/ robustez.
    const anchor = versions.reduce(
      (max, v) => Math.max(max, new Date(v.created_at).getTime()),
      0,
    );
    const cutoff = anchor - range.lastMinutes * 60_000;
    return versions.filter((v) => new Date(v.created_at).getTime() >= cutoff);
  }

  if (range.fromIso || range.toIso) {
    const from = range.fromIso ? new Date(range.fromIso).getTime() : -Infinity;
    const to = range.toIso ? new Date(range.toIso).getTime() : Infinity;
    return versions.filter((v) => {
      const t = new Date(v.created_at).getTime();
      return t >= from && t <= to;
    });
  }

  return versions;
}

/** Serializa para a URL como `range=version:1-5` ou `range=time:60` ou `range=time:abs:from~to`. */
export function serializeRange(range: TimelineRange): string | null {
  if (range.mode === 'off') return null;
  if (range.mode === 'version') {
    const a = range.vMin ?? '';
    const b = range.vMax ?? '';
    return `version:${a}-${b}`;
  }
  if (range.lastMinutes) return `time:${range.lastMinutes}`;
  if (range.fromIso || range.toIso) return `time:abs:${range.fromIso ?? ''}~${range.toIso ?? ''}`;
  return null;
}

export function parseRange(raw: string | null): TimelineRange {
  if (!raw) return { mode: 'off' };
  if (raw.startsWith('version:')) {
    const [a, b] = raw.slice('version:'.length).split('-');
    return {
      mode: 'version',
      vMin: a ? Number(a) : undefined,
      vMax: b ? Number(b) : undefined,
    };
  }
  if (raw.startsWith('time:abs:')) {
    const [from, to] = raw.slice('time:abs:'.length).split('~');
    return { mode: 'time', fromIso: from || undefined, toIso: to || undefined };
  }
  if (raw.startsWith('time:')) {
    const m = Number(raw.slice('time:'.length));
    if (Number.isFinite(m) && m > 0) return { mode: 'time', lastMinutes: m };
  }
  return { mode: 'off' };
}
