import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Info, AlertTriangle, XCircle, Download, BookmarkCheck } from 'lucide-react';
import type { ExecutionGroup, TraceLevel } from '@/services/agentTracesService';
import { downloadJSON } from '@/lib/agentExportImport';
import { toast } from 'sonner';
import { listBookmarks, type TraceBookmark } from '@/lib/traceBookmarks';
import { BookmarkButton } from './BookmarkButton';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  execution: ExecutionGroup | null;
  /** Step index to start at when the dialog opens (clamped to bounds). */
  initialStep?: number;
  /**
   * Emitted whenever the active replay step changes (play tick, prev/next,
   * slider drag, restart). Use to keep an external timeline in sync.
   */
  onStepChange?: (step: number) => void;
}

const LEVEL_ICON: Record<TraceLevel, JSX.Element> = {
  info: <Info className="h-3.5 w-3.5 text-nexus-emerald" aria-hidden />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-nexus-amber" aria-hidden />,
  error: <XCircle className="h-3.5 w-3.5 text-destructive" aria-hidden />,
};

export function ReplayDialog({ open, onOpenChange, execution, initialStep = 0, onStepChange }: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  const traces = execution?.traces ?? [];
  const total = traces.length;
  const current = traces[step];

  const accumulated = useMemo(() => {
    let ms = 0, tokens = 0, cost = 0;
    for (let i = 0; i <= step && i < traces.length; i++) {
      ms += traces[i].latency_ms ?? 0;
      tokens += traces[i].tokens_used ?? 0;
      cost += Number(traces[i].cost_usd ?? 0);
    }
    return { ms, tokens, cost };
  }, [step, traces]);

  // Sync starting step on open / execution change / requested initialStep change.
  useEffect(() => {
    if (!open) return;
    const clamped = Math.max(0, Math.min(initialStep, Math.max(0, total - 1)));
    setStep(clamped);
    setPlaying(false);
  }, [open, execution?.session_id, initialStep, total]);

  // Notify parent on every step change while the dialog is open so the external
  // timeline stays highlighted in sync with the replay.
  useEffect(() => {
    if (!open) return;
    onStepChange?.(step);
  }, [open, step, onStepChange]);

  // Player loop
  useEffect(() => {
    if (!playing || !current) return;
    const baseDelay = current.latency_ms ?? 400;
    const delay = Math.max(200, Math.min(2000, baseDelay)) / speed;
    timerRef.current = window.setTimeout(() => {
      setStep((s) => {
        if (s + 1 >= total) { setPlaying(false); return s; }
        return s + 1;
      });
    }, delay);
    return () => { if (timerRef.current) window.clearTimeout(timerRef.current); };
  }, [playing, step, speed, current, total]);

  // Keyboard shortcuts while the dialog is open: ←/→ or j/k step, space toggles play,
  // Home/End jump to bounds, R restarts. Ignored when typing in inputs.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      if (e.key === 'ArrowRight' || e.key === 'l' || e.key === 'j') {
        e.preventDefault();
        setStep((s) => Math.min(total - 1, s + 1));
      } else if (e.key === 'ArrowLeft' || e.key === 'h' || e.key === 'k') {
        e.preventDefault();
        setStep((s) => Math.max(0, s - 1));
      } else if (e.key === ' ') {
        e.preventDefault();
        setPlaying((p) => !p);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setStep(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setStep(Math.max(0, total - 1));
      } else if (e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        setStep(0);
        setPlaying(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, total]);

  if (!execution) return null;

  const handleExport = () => {
    const safeId = execution.session_id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const payload = {
      exported_at: new Date().toISOString(),
      schema_version: 1,
      execution: {
        session_id: execution.session_id,
        agent_id: execution.agent_id,
        started_at: execution.started_at,
        ended_at: execution.ended_at,
        total_ms: execution.total_ms,
        total_tokens: execution.total_tokens,
        total_cost_usd: execution.total_cost,
        counts: execution.counts,
        event_count: execution.traces.length,
      },
      events: execution.traces.map((t, i) => ({
        index: i,
        id: t.id,
        agent_id: t.agent_id,
        session_id: t.session_id,
        level: t.level,
        event: t.event,
        created_at: t.created_at,
        latency_ms: t.latency_ms,
        tokens_used: t.tokens_used,
        cost_usd: t.cost_usd,
        input: t.input,
        output: t.output,
        metadata: t.metadata,
      })),
    };
    try {
      downloadJSON(JSON.stringify(payload, null, 2), `execution-${safeId}-${ts}.json`);
      toast.success('Execução exportada', { description: `${execution.traces.length} eventos salvos como JSON.` });
    } catch (err) {
      toast.error('Falha ao exportar', { description: String(err) });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle className="flex items-center gap-2">
                <Play className="h-4 w-4 text-primary" /> Replay da execução
              </DialogTitle>
              <DialogDescription>
                <span className="font-mono text-[11px]">
                  {execution.session_id.startsWith('auto-') ? '∅ sem session_id' : execution.session_id}
                </span>
                {' · '}{total} eventos · {execution.total_ms}ms total
              </DialogDescription>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleExport}
              className="h-8 shrink-0 mr-6"
              aria-label="Exportar execução como JSON"
              title="Baixar execução completa (eventos + contexto) como JSON"
            >
              <Download className="h-3.5 w-3.5 mr-1.5" /> Exportar JSON
            </Button>
          </div>
        </DialogHeader>

        {/* Controls */}
        <div className="flex items-center gap-2 border-y border-border/40 py-3">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setStep((s) => Math.max(0, s - 1))} aria-label="Passo anterior" title="Passo anterior (← ou h)">
            <SkipBack className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" className="h-8 w-8" onClick={() => setPlaying((p) => !p)} aria-label={playing ? 'Pausar' : 'Reproduzir'} title={`${playing ? 'Pausar' : 'Reproduzir'} (Espaço)`}>
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => setStep((s) => Math.min(total - 1, s + 1))} aria-label="Próximo passo" title="Próximo passo (→ ou l)">
            <SkipForward className="h-3.5 w-3.5" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => { setStep(0); setPlaying(false); }} aria-label="Reiniciar" title="Reiniciar (R)">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>

          <div className="ml-2 flex items-center gap-2">
            <span className="text-[10px] uppercase text-muted-foreground">Velocidade</span>
            <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
              <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0.5">0.5x</SelectItem>
                <SelectItem value="1">1x</SelectItem>
                <SelectItem value="2">2x</SelectItem>
                <SelectItem value="4">4x</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="ml-auto text-[11px] text-muted-foreground tabular-nums">
            Passo {step + 1} / {total}
          </div>
        </div>

        {/* Progress slider */}
        <div className="px-1">
          <Slider
            value={[step]}
            min={0}
            max={Math.max(0, total - 1)}
            step={1}
            onValueChange={(v) => { setStep(v[0]); setPlaying(false); }}
            aria-label="Progresso do replay"
          />
        </div>

        {/* Current step */}
        <div aria-live="polite" className="space-y-3">
          {current && (
            <>
              <div className="flex items-center gap-2 p-3 rounded-md border border-border/40 bg-muted/30">
                {LEVEL_ICON[current.level]}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{current.event}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {new Date(current.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <Badge variant="outline" className="text-[10px]">{current.level}</Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Pane title="Input" data={current.input} />
                <Pane title="Output" data={current.output} />
              </div>

              {current.metadata && Object.keys(current.metadata).length > 0 && (
                <Pane title="Metadata" data={current.metadata} />
              )}

              <div className="grid grid-cols-3 gap-2 text-center">
                <Stat label="Acumulado (ms)" value={accumulated.ms.toLocaleString('pt-BR')} />
                <Stat label="Tokens" value={accumulated.tokens.toLocaleString('pt-BR')} />
                <Stat label="Custo" value={`$${accumulated.cost.toFixed(5)}`} />
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Pane({ title, data }: { title: string; data: unknown }) {
  let body = '';
  try { body = typeof data === 'string' ? data : JSON.stringify(data ?? {}, null, 2); } catch { body = String(data); }
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">{title}</p>
      <pre className="text-[10.5px] font-mono bg-muted/40 border border-border/40 rounded p-2 overflow-auto max-h-40 whitespace-pre-wrap">
        {body || '—'}
      </pre>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 p-2 bg-card/40">
      <p className="text-[10px] uppercase text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground tabular-nums">{value}</p>
    </div>
  );
}
