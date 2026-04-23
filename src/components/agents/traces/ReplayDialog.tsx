import { useEffect, useMemo, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Pause, Play, RotateCcw, SkipBack, SkipForward, Info, AlertTriangle, XCircle, Download, BookmarkCheck, ArrowLeftRight, GitCompare, Search, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useDebounce } from '@/hooks/use-debounce';
import type { ExecutionGroup, TraceLevel } from '@/services/agentTracesService';
import { downloadJSON } from '@/lib/agentExportImport';
import { toast } from 'sonner';
import { listBookmarks, type TraceBookmark } from '@/lib/traceBookmarks';
import { loadReplayState, saveReplayState } from '@/lib/replayState';
import { BookmarkButton } from './BookmarkButton';
import { TraceCompareDialog } from './TraceCompareDialog';
import { cn } from '@/lib/utils';

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

/**
 * Velocidades disponíveis no player. A ordem importa: o atalho `+`/`-` move
 * pelo array (com clamp nas pontas), e o select renderiza nesta ordem.
 * 1x é o "default" e o destino do atalho `0` (reset).
 */
const SPEEDS = [0.5, 1, 1.5, 2, 4] as const;
const DEFAULT_SPEED = 1;

export function ReplayDialog({ open, onOpenChange, execution, initialStep = 0, onStepChange }: Props) {
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timerRef = useRef<number | null>(null);

  const traces = execution?.traces ?? [];
  const total = traces.length;
  const current = traces[step];

  // Bookmarks for the current execution (refreshed on open + after save/remove).
  const sessionId = execution?.session_id ?? '';
  const [bookmarks, setBookmarks] = useState<TraceBookmark[]>([]);
  useEffect(() => {
    if (open && sessionId) setBookmarks(listBookmarks(sessionId));
    else if (!open) setBookmarks([]);
  }, [open, sessionId]);
  const currentBookmark = current ? bookmarks.find((b) => b.traceId === current.id) : undefined;

  /** Jump player to next/previous bookmark relative to the current step. */
  const jumpBookmark = (dir: 1 | -1) => {
    if (bookmarks.length === 0) return;
    const indexes = bookmarks.map((b) => b.stepIndex).sort((a, b) => a - b);
    const target = dir === 1
      ? (indexes.find((i) => i > step) ?? indexes[0])
      : ([...indexes].reverse().find((i) => i < step) ?? indexes[indexes.length - 1]);
    setStep(target);
    setPlaying(false);
  };

  // A/B selection for side-by-side comparison. Stores trace ids so the choice
  // survives play/seek without depending on the moving `step` cursor.
  const [pickA, setPickA] = useState<string | null>(null);
  const [pickB, setPickB] = useState<string | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  // Reset picks whenever the user opens a different execution.
  useEffect(() => { setPickA(null); setPickB(null); setCompareOpen(false); }, [sessionId]);

  const indexA = pickA ? traces.findIndex((t) => t.id === pickA) : -1;
  const indexB = pickB ? traces.findIndex((t) => t.id === pickB) : -1;
  const traceA = indexA >= 0 ? traces[indexA] : null;
  const traceB = indexB >= 0 ? traces[indexB] : null;
  const currentIsA = current ? current.id === pickA : false;
  const currentIsB = current ? current.id === pickB : false;

  /** Mark current step as slot A or B. Re-clicking same slot clears it. */
  const toggleSlot = (slot: 'A' | 'B') => {
    if (!current) return;
    const id = current.id;
    if (slot === 'A') {
      setPickA((prev) => (prev === id ? null : id));
      if (pickB === id) setPickB(null);
    } else {
      setPickB((prev) => (prev === id ? null : id));
      if (pickA === id) setPickA(null);
    }
  };
  const swapPicks = () => { setPickA(pickB); setPickB(pickA); };
  const canCompare = !!(pickA && pickB && pickA !== pickB);

  // ── Busca dentro do replay ────────────────────────────────────────────
  // Procura `query` em event/level/input/output/metadata de cada trace e
  // produz a lista de índices que casam. O usuário navega entre matches
  // com prev/next (botões + atalhos `n`/`N` ou Enter/Shift+Enter no input).
  // Debounce evita refazer o JSON.stringify a cada tecla.
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 150);
  const searchInputRef = useRef<HTMLInputElement>(null);
  // Reset busca ao trocar de execução — comportamento esperado de "novo contexto".
  useEffect(() => { setQuery(''); }, [sessionId]);

  /** Pré-stringifica o conteúdo buscável de cada trace UMA vez por execução. */
  const haystacks = useMemo(() => {
    return traces.map((t) => {
      const parts: string[] = [t.event, t.level];
      try { parts.push(typeof t.input === 'string' ? t.input : JSON.stringify(t.input ?? '')); } catch { /* ignore */ }
      try { parts.push(typeof t.output === 'string' ? t.output : JSON.stringify(t.output ?? '')); } catch { /* ignore */ }
      if (t.metadata) {
        try { parts.push(JSON.stringify(t.metadata)); } catch { /* ignore */ }
      }
      return parts.join(' \u0001 ').toLowerCase();
    });
  }, [traces]);

  const matchIndexes = useMemo(() => {
    const q = debouncedQuery.trim().toLowerCase();
    if (!q) return [] as number[];
    const out: number[] = [];
    for (let i = 0; i < haystacks.length; i++) {
      if (haystacks[i].includes(q)) out.push(i);
    }
    return out;
  }, [haystacks, debouncedQuery]);

  // Posição do passo atual dentro dos matches (1-based para exibir "X de N").
  // Se o passo atual não casa, mostra o "próximo" como referência.
  const currentMatchPos = useMemo(() => {
    if (matchIndexes.length === 0) return 0;
    const idx = matchIndexes.indexOf(step);
    if (idx >= 0) return idx + 1;
    const next = matchIndexes.findIndex((i) => i >= step);
    return (next === -1 ? matchIndexes.length : next + 1);
  }, [matchIndexes, step]);
  const stepMatches = matchIndexes.includes(step);

  /**
   * Salta para o match anterior/próximo. Usa wrap-around ("circular") para
   * evitar dead-ends — chegar no fim e dar "next" volta ao primeiro.
   */
  const jumpMatch = (dir: 1 | -1) => {
    if (matchIndexes.length === 0) return;
    let target: number;
    if (dir === 1) {
      target = matchIndexes.find((i) => i > step) ?? matchIndexes[0];
    } else {
      target = [...matchIndexes].reverse().find((i) => i < step) ?? matchIndexes[matchIndexes.length - 1];
    }
    setStep(target);
    setPlaying(false);
  };

  // Auto-pula para o primeiro match assim que o usuário começa a digitar e
  // o passo atual ainda não casa — feedback imediato sem precisar clicar prev/next.
  useEffect(() => {
    if (matchIndexes.length === 0) return;
    if (matchIndexes.includes(step)) return;
    setStep(matchIndexes[0]);
    setPlaying(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQuery]);

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
  // Restaura step + velocidade + playing salvos para esta execução. Se o
  // chamador passou um `initialStep` explícito (≠ 0), ele tem prioridade
  // sobre o estado salvo — esse é o caminho de "abrir no passo X" via timeline.
  useEffect(() => {
    if (!open) return;
    const saved = sessionId ? loadReplayState(sessionId) : null;
    const explicitInitial = initialStep > 0;
    const baseStep = explicitInitial ? initialStep : (saved?.step ?? 0);
    const clamped = Math.max(0, Math.min(baseStep, Math.max(0, total - 1)));
    setStep(clamped);
    setSpeed(saved?.speed ?? 1);
    // Não auto-tocamos ao reabrir mesmo se estava tocando — evita som/CPU
    // surpresa. Mas se o usuário quiser podemos respeitar saved.playing:
    setPlaying(saved?.playing ?? false);
  }, [open, sessionId, initialStep, total]);

  // Persistência: salva sempre que step/playing/speed mudam com o dialog aberto.
  // Skip durante execução vazia (sem session) ou enquanto fechado.
  useEffect(() => {
    if (!open || !sessionId || total === 0) return;
    saveReplayState(sessionId, { step, playing, speed });
  }, [open, sessionId, step, playing, speed, total]);

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
      } else if (e.key === 'b' && bookmarks.length > 0) {
        e.preventDefault();
        jumpBookmark(1);
      } else if (e.key === 'B' && bookmarks.length > 0) {
        e.preventDefault();
        jumpBookmark(-1);
      } else if (e.key === '/') {
        // Foca o input de busca — convenção comum (gh, gmail, etc).
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      } else if (e.key === 'n' && matchIndexes.length > 0) {
        e.preventDefault();
        jumpMatch(1);
      } else if (e.key === 'N' && matchIndexes.length > 0) {
        e.preventDefault();
        jumpMatch(-1);
      } else if (e.key === '+' || e.key === '=' || (e.key === 'ArrowUp' && e.shiftKey)) {
        // Acelera (vai para a próxima velocidade do array). `=` cobre teclados
        // onde `+` exige Shift sem que precisemos checar o modificador.
        e.preventDefault();
        setSpeed((s) => {
          const i = SPEEDS.indexOf(s as typeof SPEEDS[number]);
          if (i === -1) return DEFAULT_SPEED;
          return SPEEDS[Math.min(SPEEDS.length - 1, i + 1)];
        });
      } else if (e.key === '-' || e.key === '_' || (e.key === 'ArrowDown' && e.shiftKey)) {
        e.preventDefault();
        setSpeed((s) => {
          const i = SPEEDS.indexOf(s as typeof SPEEDS[number]);
          if (i === -1) return DEFAULT_SPEED;
          return SPEEDS[Math.max(0, i - 1)];
        });
      } else if (e.key === '0') {
        // Reset rápido para 1x — útil depois de "perder" a velocidade default.
        e.preventDefault();
        setSpeed(DEFAULT_SPEED);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
    // jumpBookmark/jumpMatch read from setState callbacks; bookmarks/matchIndexes change retriggers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, total, bookmarks, step, matchIndexes]);

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

          {bookmarks.length > 0 && (
            <>
              <span className="h-5 w-px bg-border/60 mx-1" aria-hidden />
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-nexus-amber border-nexus-amber/40 hover:bg-nexus-amber/10"
                onClick={() => jumpBookmark(-1)}
                aria-label="Marcador anterior"
                title="Marcador anterior (Shift+B)"
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                <span className="sr-only">Anterior</span>
              </Button>
              <Badge variant="outline" className="text-[10px] gap-1 text-nexus-amber border-nexus-amber/40">
                <BookmarkCheck className="h-3 w-3" /> {bookmarks.length}
              </Badge>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8 text-nexus-amber border-nexus-amber/40 hover:bg-nexus-amber/10"
                onClick={() => jumpBookmark(1)}
                aria-label="Próximo marcador"
                title="Próximo marcador (b)"
              >
                <BookmarkCheck className="h-3.5 w-3.5" />
                <span className="sr-only">Próximo</span>
              </Button>
            </>
          )}

          <span className="h-5 w-px bg-border/60 mx-1" aria-hidden />
          {/* A/B compare quick-launch — disabled until two distinct steps are picked. */}
          <Button
            size="sm"
            variant={canCompare ? 'default' : 'outline'}
            className="h-8 px-2 gap-1.5 text-[11px]"
            disabled={!canCompare}
            onClick={() => setCompareOpen(true)}
            title={canCompare
              ? `Comparar passo #${indexA + 1} (A) com #${indexB + 1} (B)`
              : 'Selecione dois passos como A e B para comparar'}
          >
            <GitCompare className="h-3.5 w-3.5" />
            Comparar
            {(pickA || pickB) && (
              <span className="font-mono text-[10px] opacity-80">
                {pickA ? `#${indexA + 1}` : '—'}/{pickB ? `#${indexB + 1}` : '—'}
              </span>
            )}
          </Button>
          {(pickA || pickB) && (
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => { setPickA(null); setPickB(null); }}
              title="Limpar seleção A/B"
              aria-label="Limpar seleção A/B"
            >
              <ArrowLeftRight className="h-3 w-3" />
            </Button>
          )}

          <div className="ml-2 flex items-center gap-2">
            <span className="text-[10px] uppercase text-muted-foreground">Velocidade</span>
            <Select value={String(speed)} onValueChange={(v) => setSpeed(Number(v))}>
              <SelectTrigger className="h-8 w-[80px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SPEEDS.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}x</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Indicador de progresso + atalhos ativos — facilita onboarding e
              evita que o usuário precise lembrar das teclas. */}
          <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
            <span
              className="text-[11px] font-mono tabular-nums px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
              aria-live="polite"
              title={`Passo ${step + 1} de ${total}`}
            >
              Passo <span className="font-semibold">{step + 1}</span>
              <span className="text-primary/60"> / {total}</span>
            </span>
            <div className="hidden md:flex items-center gap-1 text-[10px] text-muted-foreground" aria-label="Atalhos de teclado disponíveis">
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">←</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">→</kbd>
              <span className="opacity-60">passo</span>
              <span className="opacity-30 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">Espaço</kbd>
              <span className="opacity-60">play</span>
              <span className="opacity-30 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">Home</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">End</kbd>
              <span className="opacity-30 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">R</kbd>
              <span className="opacity-60">reset</span>
              <span className="opacity-30 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">/</kbd>
              <span className="opacity-60">buscar</span>
              <span className="opacity-30 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">−</kbd>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">+</kbd>
              <span className="opacity-60">
                velocidade <span className="font-mono text-primary/80">({speed}x)</span>
              </span>
              <span className="opacity-30 mx-0.5">·</span>
              <kbd className="px-1.5 py-0.5 rounded border border-border/60 bg-muted/60 font-mono text-[10px]">0</kbd>
              <span className="opacity-60">reset</span>
            </div>
          </div>
        </div>

        {/* Progress slider with bookmark markers overlay */}
        <div className="px-1 relative">
          <Slider
            value={[step]}
            min={0}
            max={Math.max(0, total - 1)}
            step={1}
            onValueChange={(v) => { setStep(v[0]); setPlaying(false); }}
            aria-label="Progresso do replay"
          />
          {bookmarks.length > 0 && total > 1 && (
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 pointer-events-none h-2">
              {bookmarks.map((b) => {
                const left = `${(b.stepIndex / Math.max(1, total - 1)) * 100}%`;
                return (
                  <button
                    key={b.traceId}
                    type="button"
                    onClick={() => { setStep(b.stepIndex); setPlaying(false); }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 top-1/2 w-2 h-3.5 rounded-sm bg-nexus-amber border border-nexus-amber/80 shadow-sm pointer-events-auto hover:scale-125 transition-transform"
                    style={{ left }}
                    aria-label={`Ir para marcador no passo ${b.stepIndex + 1}`}
                    title={b.note ? `#${b.stepIndex + 1}: ${b.note}` : `Marcador no passo ${b.stepIndex + 1}`}
                  />
                );
              })}
            </div>
          )}
          {/* Marcadores de matches da busca sobre a barra — usam cor primária
              para distinguir dos marcadores de bookmark (amber). Clicar pula. */}
          {matchIndexes.length > 0 && total > 1 && (
            <div className="absolute inset-x-0 bottom-0 pointer-events-none h-1.5">
              {matchIndexes.map((idx) => {
                const left = `${(idx / Math.max(1, total - 1)) * 100}%`;
                return (
                  <button
                    key={`m-${idx}`}
                    type="button"
                    onClick={() => { setStep(idx); setPlaying(false); }}
                    className="absolute -translate-x-1/2 top-0 w-1 h-1.5 rounded-sm bg-primary pointer-events-auto hover:scale-150 transition-transform"
                    style={{ left }}
                    aria-label={`Ir para resultado no passo ${idx + 1}`}
                    title={`Resultado no passo ${idx + 1}`}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Toolbar de busca — input + contador + prev/next + clear.
            Convenção: Enter=próximo, Shift+Enter=anterior, Esc=limpa+desfoca,
            atalho global "/" foca o input, "n"/"N" navega quando focado fora. */}
        <div className="flex items-center gap-2 px-1">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 text-muted-foreground absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden />
            <Input
              ref={searchInputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (matchIndexes.length > 0) jumpMatch(e.shiftKey ? -1 : 1);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  if (query) setQuery('');
                  else (e.target as HTMLInputElement).blur();
                }
              }}
              placeholder='Buscar nos passos (event, input, output, metadata) — atalho "/"'
              className="h-8 pl-7 pr-2 text-xs"
              aria-label="Buscar texto nos passos da execução"
            />
          </div>
          {query && (
            <>
              <span
                className={cn(
                  'text-[11px] tabular-nums px-1.5 py-0.5 rounded font-mono',
                  matchIndexes.length === 0
                    ? 'bg-destructive/10 text-destructive border border-destructive/30'
                    : stepMatches
                    ? 'bg-primary/10 text-primary border border-primary/30'
                    : 'bg-secondary/60 text-muted-foreground border border-border/40',
                )}
                aria-live="polite"
              >
                {matchIndexes.length === 0
                  ? '0 resultados'
                  : `${currentMatchPos} de ${matchIndexes.length}`}
              </span>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={matchIndexes.length === 0}
                onClick={() => jumpMatch(-1)}
                aria-label="Resultado anterior"
                title="Resultado anterior (Shift+Enter ou N)"
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="outline"
                className="h-8 w-8"
                disabled={matchIndexes.length === 0}
                onClick={() => jumpMatch(1)}
                aria-label="Próximo resultado"
                title="Próximo resultado (Enter ou n)"
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-muted-foreground"
                onClick={() => { setQuery(''); searchInputRef.current?.focus(); }}
                aria-label="Limpar busca"
                title="Limpar busca (Esc)"
              >
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>

        {/* Current step */}
        <div aria-live="polite" className="space-y-3">
          {current && (
            <>
              <div className={cn(
                'flex items-center gap-2 p-3 rounded-md border bg-muted/30',
                currentBookmark ? 'border-nexus-amber/40 bg-nexus-amber/5' : 'border-border/40',
                // Reforço visual quando o passo casa com a busca ativa — ring
                // sutil em primary para não competir com o amber dos bookmarks.
                stepMatches && 'ring-2 ring-primary/40 ring-offset-1 ring-offset-background',
              )}>
                {LEVEL_ICON[current.level]}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate flex items-center gap-1.5">
                    {currentBookmark && <BookmarkCheck className="h-3.5 w-3.5 text-nexus-amber shrink-0" />}
                    {current.event}
                  </p>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {new Date(current.created_at).toLocaleString('pt-BR')}
                  </p>
                  {currentBookmark?.note && (
                    <p className="text-[11px] italic text-nexus-amber/90 mt-1 line-clamp-2">
                      “{currentBookmark.note}”
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={currentIsA ? 'default' : 'outline'}
                    className={cn(
                      'h-7 px-2 text-[11px] font-mono',
                      currentIsA && 'bg-destructive text-destructive-foreground hover:bg-destructive/90',
                    )}
                    onClick={() => toggleSlot('A')}
                    title={currentIsA ? 'Remover este passo do slot A' : 'Marcar este passo como A'}
                    aria-pressed={currentIsA}
                  >
                    A
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={currentIsB ? 'default' : 'outline'}
                    className={cn(
                      'h-7 px-2 text-[11px] font-mono',
                      currentIsB && 'bg-nexus-emerald text-white hover:bg-nexus-emerald/90',
                    )}
                    onClick={() => toggleSlot('B')}
                    title={currentIsB ? 'Remover este passo do slot B' : 'Marcar este passo como B'}
                    aria-pressed={currentIsB}
                  >
                    B
                  </Button>
                </div>
                <BookmarkButton
                  sessionId={sessionId}
                  traceId={current.id}
                  stepIndex={step}
                  onChange={setBookmarks}
                />
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

      <TraceCompareDialog
        open={compareOpen}
        onOpenChange={setCompareOpen}
        traceA={traceA}
        indexA={indexA}
        traceB={traceB}
        indexB={indexB}
        onSwap={swapPicks}
      />
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
