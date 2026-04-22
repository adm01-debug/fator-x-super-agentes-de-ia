import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Info, AlertTriangle, XCircle,
  CheckCircle2, Clock, DollarSign, Hash, Zap,
  ChevronsLeft, ChevronLeft, ChevronsRight,
  ChevronsDownUp, ChevronsUpDown, Keyboard, Search, X, BookmarkCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { AgentTraceRow, ExecutionGroup, TraceLevel } from '@/services/agentTracesService';
import { listBookmarks, type TraceBookmark } from '@/lib/traceBookmarks';
import { BookmarkButton } from './BookmarkButton';

const LEVEL_ICON: Record<TraceLevel, JSX.Element> = {
  info: <Info className="h-3 w-3 text-nexus-emerald" aria-hidden />,
  warning: <AlertTriangle className="h-3 w-3 text-nexus-amber" aria-hidden />,
  error: <XCircle className="h-3 w-3 text-destructive" aria-hidden />,
};

const LEVEL_BORDER: Record<TraceLevel, string> = {
  info: 'border-l-nexus-emerald/60',
  warning: 'border-l-nexus-amber/60',
  error: 'border-l-destructive/60',
};

interface Props {
  execution: ExecutionGroup;
  selectedStep?: number;
  onSelectStep?: (index: number) => void;
}

/** Stringify safely for in-step search. */
function traceHaystack(t: AgentTraceRow): string {
  const parts: string[] = [t.event ?? '', t.level ?? ''];
  const dump = (v: unknown) => {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    try { return JSON.stringify(v); } catch { return String(v); }
  };
  parts.push(dump(t.input));
  parts.push(dump(t.output));
  parts.push(dump(t.metadata));
  return parts.join('\n').toLowerCase();
}

export function ExecutionTimeline({ execution, selectedStep, onSelectStep }: Props) {
  const [internalStep, setInternalStep] = useState(0);
  const step = selectedStep ?? internalStep;
  const total = execution.traces.length;

  // Per-execution bookmarks (persisted via traceBookmarks). Refreshed when:
  //  · execution changes
  //  · child BookmarkButton emits onChange after save/remove
  const [bookmarks, setBookmarks] = useState<TraceBookmark[]>(() => listBookmarks(execution.session_id));
  useEffect(() => { setBookmarks(listBookmarks(execution.session_id)); }, [execution.session_id]);
  const bookmarkByTraceId = useMemo(() => {
    const m = new Map<string, TraceBookmark>();
    for (const b of bookmarks) m.set(b.traceId, b);
    return m;
  }, [bookmarks]);

  // In-execution text search (event/tool name, error fragment, prompt/response excerpt).
  const [stepSearch, setStepSearch] = useState('');
  const normalized = stepSearch.trim().toLowerCase();

  // Indexes of traces that match the current search. Empty array when no search.
  const matchIndexes = useMemo(() => {
    if (!normalized) return [] as number[];
    const out: number[] = [];
    execution.traces.forEach((t, i) => {
      if (traceHaystack(t).includes(normalized)) out.push(i);
    });
    return out;
  }, [execution.traces, normalized]);

  const matchSet = useMemo(() => new Set(matchIndexes), [matchIndexes]);

  // Reset search when switching execution.
  useEffect(() => { setStepSearch(''); }, [execution.session_id]);

  // Bulk expand/collapse: bump a counter + carry the desired state.
  // TraceItem syncs its local `open` whenever this version changes.
  const [bulk, setBulk] = useState<{ v: number; open: boolean } | null>(null);
  const expandAll = () => setBulk((b) => ({ v: (b?.v ?? 0) + 1, open: true }));
  const collapseAll = () => setBulk((b) => ({ v: (b?.v ?? 0) + 1, open: false }));

  const setStep = (i: number) => {
    if (total === 0) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    if (onSelectStep) onSelectStep(clamped);
    else setInternalStep(clamped);
  };

  /** Jump to next/previous match relative to the current step. */
  const jumpMatch = (dir: 1 | -1) => {
    if (matchIndexes.length === 0) return;
    if (dir === 1) {
      const next = matchIndexes.find((i) => i > step) ?? matchIndexes[0];
      setStep(next);
    } else {
      const prev = [...matchIndexes].reverse().find((i) => i < step) ?? matchIndexes[matchIndexes.length - 1];
      setStep(prev);
    }
  };

  /** Jump to next/previous bookmark relative to the current step. */
  const jumpBookmark = (dir: 1 | -1) => {
    if (bookmarks.length === 0) return;
    const indexes = bookmarks.map((b) => b.stepIndex).sort((a, b) => a - b);
    const target = dir === 1
      ? (indexes.find((i) => i > step) ?? indexes[0])
      : ([...indexes].reverse().find((i) => i < step) ?? indexes[indexes.length - 1]);
    setStep(target);
  };

  useEffect(() => {
    if (selectedStep == null) setInternalStep(0);
  }, [execution.session_id, selectedStep]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    // Don't hijack typing inside the search field.
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setStep(step + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setStep(step - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setStep(0); }
    else if (e.key === 'End') { e.preventDefault(); setStep(total - 1); }
    else if (e.key === 'n' && matchIndexes.length > 0) { e.preventDefault(); jumpMatch(1); }
    else if (e.key === 'N' && matchIndexes.length > 0) { e.preventDefault(); jumpMatch(-1); }
    else if (e.key === 'b' && bookmarks.length > 0) { e.preventDefault(); jumpBookmark(1); }
    else if (e.key === 'B' && bookmarks.length > 0) { e.preventDefault(); jumpBookmark(-1); }
  };

  const itemsRef = useRef<Array<HTMLLIElement | null>>([]);
  useEffect(() => {
    itemsRef.current[step]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [step]);

  return (
    <div
      tabIndex={0}
      onKeyDown={onKeyDown}
      className="outline-none focus-visible:ring-2 focus-visible:ring-primary/30 rounded-md"
      aria-label="Linha do tempo navegável"
    >
      <ExecutionSummary
        execution={execution}
        step={step}
        total={total}
        onStep={setStep}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
        stepSearch={stepSearch}
        onStepSearch={setStepSearch}
        matchCount={matchIndexes.length}
        onJumpMatch={jumpMatch}
        bookmarks={bookmarks}
        onJumpBookmark={jumpBookmark}
        onBookmarksChange={setBookmarks}
      />

      <ol
        className="space-y-1.5 mt-3"
        role="listbox"
        aria-label="Eventos da execução"
        aria-activedescendant={execution.traces[step] ? `trace-${execution.traces[step].id}` : undefined}
      >
        {execution.traces.map((t, i) => {
          const isMatch = matchSet.has(i);
          const dim = normalized.length > 0 && !isMatch;
          const bookmark = bookmarkByTraceId.get(t.id);
          return (
            <TraceItem
              key={t.id}
              ref={(el) => { itemsRef.current[i] = el; }}
              trace={t}
              index={i}
              active={i === step}
              onSelect={() => setStep(i)}
              bulk={bulk}
              highlight={normalized}
              isMatch={isMatch}
              dim={dim}
              sessionId={execution.session_id}
              bookmark={bookmark}
              onBookmarksChange={setBookmarks}
            />
          );
        })}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resumo da execução (sticky)                                         */
/* ------------------------------------------------------------------ */

function ExecutionSummary({
  execution, step, total, onStep, onExpandAll, onCollapseAll,
  stepSearch, onStepSearch, matchCount, onJumpMatch,
  bookmarks, onJumpBookmark, onBookmarksChange,
}: {
  execution: ExecutionGroup;
  step: number;
  total: number;
  onStep: (i: number) => void;
  onExpandAll: () => void;
  onCollapseAll: () => void;
  stepSearch: string;
  onStepSearch: (v: string) => void;
  matchCount: number;
  onJumpMatch: (dir: 1 | -1) => void;
  bookmarks: TraceBookmark[];
  onJumpBookmark: (dir: 1 | -1) => void;
  onBookmarksChange: (bookmarks: TraceBookmark[]) => void;
}) {
  
  const { counts, total_ms, total_tokens, total_cost, session_id, traces } = execution;
  const current = traces[step];
  const isAuto = session_id.startsWith('auto-');
  const atStart = step <= 0;
  const atEnd = step >= total - 1;
  const hasSearch = stepSearch.trim().length > 0;
  const hasBookmarks = bookmarks.length > 0;
  const currentBookmark = current ? bookmarks.find((b) => b.traceId === current.id) : undefined;

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border border-border/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <code className="text-[11px] font-mono text-foreground truncate">
            {isAuto ? '∅ sem session_id' : session_id}
          </code>
          {hasBookmarks && (
            <Badge
              variant="outline"
              className="text-[10px] gap-1 text-nexus-amber border-nexus-amber/40 bg-nexus-amber/10 cursor-pointer hover:bg-nexus-amber/20"
              onClick={() => onJumpBookmark(1)}
              title="Pular para próximo marcador (b)"
            >
              <BookmarkCheck className="h-3 w-3" />
              {bookmarks.length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={atStart || total === 0}
            onClick={() => onStep(0)}
            aria-label="Primeiro passo"
            title="Primeiro passo (Home)"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={atStart || total === 0}
            onClick={() => onStep(step - 1)}
            aria-label="Passo anterior"
            title="Passo anterior (↑ ou k)"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Badge variant="outline" className="text-[10px] tabular-nums">
            {Math.min(step + 1, traces.length)} / {traces.length}
          </Badge>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={atEnd || total === 0}
            onClick={() => onStep(step + 1)}
            aria-label="Próximo passo"
            title="Próximo passo (↓ ou j)"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={atEnd || total === 0}
            onClick={() => onStep(total - 1)}
            aria-label="Último passo"
            title="Último passo (End)"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
          <span className="h-4 w-px bg-border/60 mx-1" aria-hidden />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={total === 0}
            onClick={onExpandAll}
            aria-label="Expandir todos os passos"
            title="Expandir tudo"
          >
            <ChevronsUpDown className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            disabled={total === 0}
            onClick={onCollapseAll}
            aria-label="Recolher todos os passos"
            title="Recolher tudo"
          >
            <ChevronsDownUp className="h-3.5 w-3.5" />
          </Button>
          <span className="h-4 w-px bg-border/60 mx-1" aria-hidden />
          <Popover>
            <PopoverTrigger asChild>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                aria-label="Mostrar atalhos de teclado"
                title="Atalhos de teclado"
              >
                <Keyboard className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-64 p-3 text-xs">
              <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                <Keyboard className="h-3.5 w-3.5 text-primary" /> Atalhos de teclado
              </p>
              <p className="text-[10px] text-muted-foreground mb-2">
                Clique na timeline para focar e use:
              </p>
              <ul className="space-y-1.5">
                <ShortcutRow keys={['↓', 'j']} label="Próximo passo" />
                <ShortcutRow keys={['↑', 'k']} label="Passo anterior" />
                <ShortcutRow keys={['Home']} label="Primeiro passo" />
                <ShortcutRow keys={['End']} label="Último passo" />
                <ShortcutRow keys={['n']} label="Próximo match" />
                <ShortcutRow keys={['N']} label="Match anterior" />
                <ShortcutRow keys={['b']} label="Próximo marcador" />
                <ShortcutRow keys={['B']} label="Marcador anterior" />
              </ul>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* In-execution text search */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="h-3 w-3 absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={stepSearch}
            onChange={(e) => onStepSearch(e.target.value)}
            placeholder="Buscar nos eventos: erro, nome de tool, trecho do prompt/resposta..."
            className="h-7 pl-7 pr-7 text-[11px]"
            aria-label="Buscar dentro desta execução"
          />
          {hasSearch && (
            <button
              type="button"
              onClick={() => onStepSearch('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
              aria-label="Limpar busca"
              title="Limpar busca (Esc)"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {hasSearch && (
          <>
            <Badge
              variant={matchCount > 0 ? 'secondary' : 'outline'}
              className={cn(
                'text-[10px] tabular-nums shrink-0',
                matchCount === 0 && 'text-muted-foreground',
              )}
            >
              {matchCount === 0 ? 'sem matches' : `${matchCount} match${matchCount === 1 ? '' : 'es'}`}
            </Badge>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              disabled={matchCount === 0}
              onClick={() => onJumpMatch(-1)}
              aria-label="Match anterior"
              title="Match anterior (Shift+N)"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-6 w-6 shrink-0"
              disabled={matchCount === 0}
              onClick={() => onJumpMatch(1)}
              aria-label="Próximo match"
              title="Próximo match (n)"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap text-[11px] text-muted-foreground">
        <SummaryStat icon={CheckCircle2} value={counts.info} className="text-nexus-emerald" label="info" />
        {counts.warning > 0 && (
          <SummaryStat icon={AlertTriangle} value={counts.warning} className="text-nexus-amber" label="warning" />
        )}
        {counts.error > 0 && (
          <SummaryStat icon={XCircle} value={counts.error} className="text-destructive" label="error" />
        )}
        <span className="h-3 w-px bg-border/60" aria-hidden />
        <SummaryStat icon={Clock} value={`${total_ms}ms`} label="tempo total" />
        {total_tokens > 0 && (
          <SummaryStat icon={Zap} value={total_tokens.toLocaleString('pt-BR')} label="tokens" />
        )}
        {total_cost > 0 && (
          <SummaryStat icon={DollarSign} value={`$${total_cost.toFixed(5)}`} label="custo" />
        )}
      </div>

      {current && (
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="truncate flex-1 min-w-0">
            <span className="font-medium text-foreground">↳</span> {current.event}
            <span className="font-mono ml-2">{new Date(current.created_at).toLocaleTimeString('pt-BR')}</span>
            {currentBookmark?.note && (
              <span className="ml-2 text-nexus-amber italic truncate">— {currentBookmark.note}</span>
            )}
          </div>
          <BookmarkButton
            sessionId={session_id}
            traceId={current.id}
            stepIndex={step}
            variant="inline"
            onChange={onBookmarksChange}
          />
        </div>
      )}
    </div>
  );
}

function ShortcutRow({ keys, label }: { keys: string[]; label: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        {keys.map((k, i) => (
          <kbd
            key={i}
            className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded border border-border/60 bg-muted/60 text-[10px] font-mono text-foreground"
          >
            {k}
          </kbd>
        ))}
      </span>
    </li>
  );
}

function SummaryStat({
  icon: Icon, value, label, className,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string | number;
  label: string;
  className?: string;
}) {
  return (
    <span className={cn('flex items-center gap-1 tabular-nums', className)} title={label}>
      <Icon className="h-3 w-3" aria-hidden />
      <span className="font-semibold">{value}</span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Item da timeline                                                    */
/* ------------------------------------------------------------------ */

interface TraceItemProps {
  trace: AgentTraceRow;
  index: number;
  active: boolean;
  onSelect: () => void;
  bulk: { v: number; open: boolean } | null;
  highlight: string;
  isMatch: boolean;
  dim: boolean;
  sessionId: string;
  bookmark: TraceBookmark | undefined;
  onBookmarksChange: (bookmarks: TraceBookmark[]) => void;
}

const TraceItem = forwardRef<HTMLLIElement, TraceItemProps>(
  ({ trace, index, active, onSelect, bulk, highlight, isMatch, dim, sessionId, bookmark, onBookmarksChange }, ref) => {
    const [open, setOpen] = useState(false);
    const ts = new Date(trace.created_at).toLocaleTimeString('pt-BR', { hour12: false });
    const isBookmarked = !!bookmark;

    useEffect(() => {
      if (active) setOpen(true);
    }, [active]);

    // Sync with bulk expand/collapse signal from the parent.
    useEffect(() => {
      if (bulk) setOpen(bulk.open);
    }, [bulk]);

    // Auto-expand items that match the active search so the highlighted excerpt is visible.
    useEffect(() => {
      if (highlight && isMatch) setOpen(true);
    }, [highlight, isMatch]);

    const handleClick = () => {
      if (active) setOpen((o) => !o);
      else { onSelect(); setOpen(true); }
    };

    return (
      <li
        ref={ref}
        id={`trace-${trace.id}`}
        role="option"
        aria-selected={active}
        className={cn(
          'border-l-2 pl-3 py-1.5 rounded-r-md transition-colors cursor-pointer relative',
          LEVEL_BORDER[trace.level],
          active
            ? 'bg-primary/10 ring-1 ring-primary/30 shadow-sm'
            : 'bg-card/40 hover:bg-muted/40',
          isMatch && !active && 'ring-1 ring-primary/40 bg-primary/5',
          isBookmarked && 'border-l-nexus-amber bg-nexus-amber/[0.04]',
          dim && 'opacity-40 hover:opacity-90',
        )}
        onClick={handleClick}
      >
        {/* Marker rail: a thin amber notch to make bookmarks scannable. */}
        {isBookmarked && (
          <span
            className="absolute -left-[3px] top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-full bg-nexus-amber"
            aria-hidden
          />
        )}
        <div className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleClick(); }}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-foreground"
            aria-expanded={open}
          >
            {open
              ? <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />}
            <span className={cn(
              'font-mono text-[10px] tabular-nums w-8 shrink-0',
              active ? 'text-primary font-semibold' : 'text-muted-foreground',
            )}>
              #{index + 1}
            </span>
            <span className="font-mono text-[10px] text-muted-foreground tabular-nums shrink-0">{ts}</span>
            {LEVEL_ICON[trace.level]}
            {isBookmarked && (
              <BookmarkCheck
                className="h-3 w-3 text-nexus-amber shrink-0"
                aria-label="Passo marcado"
              />
            )}
            <span className={cn('font-medium truncate', active ? 'text-foreground' : 'text-foreground/90')}>
              <Highlighted text={trace.event} query={highlight} />
            </span>
            <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
              {trace.latency_ms != null && <span className="tabular-nums">{trace.latency_ms}ms</span>}
              {trace.tokens_used != null && trace.tokens_used > 0 && <span className="tabular-nums">{trace.tokens_used} tk</span>}
              {trace.cost_usd != null && Number(trace.cost_usd) > 0 && <span className="tabular-nums">${Number(trace.cost_usd).toFixed(5)}</span>}
            </span>
          </button>
          {/* Bookmark trigger appears on hover OR when already marked. */}
          <div className={cn('shrink-0 transition-opacity', isBookmarked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 hover:opacity-100 focus-within:opacity-100')}>
            <BookmarkButton
              sessionId={sessionId}
              traceId={trace.id}
              stepIndex={index}
              onChange={onBookmarksChange}
            />
          </div>
        </div>

        {isBookmarked && bookmark.note && !open && (
          <p
            className="ml-6 mt-1 text-[10.5px] italic text-nexus-amber/90 truncate"
            title={bookmark.note}
          >
            “{bookmark.note}”
          </p>
        )}

        {open && (
          <div className="mt-2 ml-6 space-y-2" onClick={(e) => e.stopPropagation()}>
            {isBookmarked && bookmark.note && (
              <div className="rounded border border-nexus-amber/30 bg-nexus-amber/10 p-2 text-[11px] text-foreground flex items-start gap-1.5">
                <BookmarkCheck className="h-3 w-3 text-nexus-amber mt-0.5 shrink-0" />
                <span className="italic">{bookmark.note}</span>
              </div>
            )}
            <JsonBlock label="Input" data={trace.input} highlight={highlight} />
            <JsonBlock label="Output" data={trace.output} highlight={highlight} />
            {trace.metadata && Object.keys(trace.metadata).length > 0 && (
              <JsonBlock label="Metadata" data={trace.metadata} highlight={highlight} />
            )}
            <Badge variant="outline" className="text-[9px] font-mono">{trace.id.slice(0, 8)}</Badge>
          </div>
        )}
      </li>
    );
  },
);
TraceItem.displayName = 'TraceItem';

/** Escape a string for safe use inside a RegExp. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Render text with case-insensitive highlights for `query` substrings. */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query) return <>{text}</>;
  const re = new RegExp(`(${escapeRegExp(query)})`, 'ig');
  const parts = text.split(re);
  return (
    <>
      {parts.map((p, i) =>
        p.toLowerCase() === query.toLowerCase() ? (
          <mark
            key={i}
            className="bg-primary/30 text-foreground rounded-sm px-0.5"
          >
            {p}
          </mark>
        ) : (
          <span key={i}>{p}</span>
        ),
      )}
    </>
  );
}

function JsonBlock({ label, data, highlight }: { label: string; data: unknown; highlight?: string }) {
  if (data == null) return null;
  let body: string;
  try {
    body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  } catch {
    body = String(data);
  }
  if (!body || body === '""' || body === '{}') return null;
  const hasMatch = highlight && body.toLowerCase().includes(highlight.toLowerCase());
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1 flex items-center gap-1.5">
        {label}
        {hasMatch && (
          <Badge variant="secondary" className="h-3.5 px-1 text-[8px] font-mono normal-case">match</Badge>
        )}
      </p>
      <pre className="text-[10.5px] font-mono bg-muted/40 border border-border/40 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap">
        {highlight ? <Highlighted text={body} query={highlight} /> : body}
      </pre>
    </div>
  );
}
