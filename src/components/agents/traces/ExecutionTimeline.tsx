import { forwardRef, useEffect, useRef, useState } from 'react';
import {
  ChevronDown, ChevronRight, Info, AlertTriangle, XCircle,
  CheckCircle2, Clock, DollarSign, Hash, Zap,
  ChevronsLeft, ChevronLeft, ChevronsRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { AgentTraceRow, ExecutionGroup, TraceLevel } from '@/services/agentTracesService';

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

export function ExecutionTimeline({ execution, selectedStep, onSelectStep }: Props) {
  const [internalStep, setInternalStep] = useState(0);
  const step = selectedStep ?? internalStep;
  const total = execution.traces.length;

  const setStep = (i: number) => {
    if (total === 0) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    if (onSelectStep) onSelectStep(clamped);
    else setInternalStep(clamped);
  };

  useEffect(() => {
    if (selectedStep == null) setInternalStep(0);
  }, [execution.session_id, selectedStep]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'j') { e.preventDefault(); setStep(step + 1); }
    else if (e.key === 'ArrowUp' || e.key === 'k') { e.preventDefault(); setStep(step - 1); }
    else if (e.key === 'Home') { e.preventDefault(); setStep(0); }
    else if (e.key === 'End') { e.preventDefault(); setStep(total - 1); }
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
      <ExecutionSummary execution={execution} step={step} />

      <ol
        className="space-y-1.5 mt-3"
        role="listbox"
        aria-label="Eventos da execução"
        aria-activedescendant={execution.traces[step] ? `trace-${execution.traces[step].id}` : undefined}
      >
        {execution.traces.map((t, i) => (
          <TraceItem
            key={t.id}
            ref={(el) => { itemsRef.current[i] = el; }}
            trace={t}
            index={i}
            active={i === step}
            onSelect={() => setStep(i)}
          />
        ))}
      </ol>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Resumo da execução (sticky)                                         */
/* ------------------------------------------------------------------ */

function ExecutionSummary({ execution, step }: { execution: ExecutionGroup; step: number }) {
  const { counts, total_ms, total_tokens, total_cost, session_id, traces } = execution;
  const current = traces[step];
  const isAuto = session_id.startsWith('auto-');

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border border-border/40 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
          <code className="text-[11px] font-mono text-foreground truncate">
            {isAuto ? '∅ sem session_id' : session_id}
          </code>
        </div>
        <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">
          Passo {Math.min(step + 1, traces.length)} / {traces.length}
        </Badge>
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
        <div className="text-[10px] text-muted-foreground truncate">
          <span className="font-medium text-foreground">↳</span> {current.event}
          <span className="font-mono ml-2">{new Date(current.created_at).toLocaleTimeString('pt-BR')}</span>
        </div>
      )}
    </div>
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
}

const TraceItem = forwardRef<HTMLLIElement, TraceItemProps>(
  ({ trace, index, active, onSelect }, ref) => {
    const [open, setOpen] = useState(false);
    const ts = new Date(trace.created_at).toLocaleTimeString('pt-BR', { hour12: false });

    useEffect(() => {
      if (active) setOpen(true);
    }, [active]);

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
          'border-l-2 pl-3 py-1.5 rounded-r-md transition-colors cursor-pointer',
          LEVEL_BORDER[trace.level],
          active
            ? 'bg-primary/10 ring-1 ring-primary/30 shadow-sm'
            : 'bg-card/40 hover:bg-muted/40',
        )}
        onClick={handleClick}
      >
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); handleClick(); }}
          className="w-full text-left flex items-center gap-2 text-xs hover:text-foreground"
          aria-expanded={open}
        >
          {open
            ? <ChevronDown className="h-3 w-3 text-muted-foreground" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <span className={cn(
            'font-mono text-[10px] tabular-nums w-8',
            active ? 'text-primary font-semibold' : 'text-muted-foreground',
          )}>
            #{index + 1}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{ts}</span>
          {LEVEL_ICON[trace.level]}
          <span className={cn('font-medium truncate', active ? 'text-foreground' : 'text-foreground/90')}>
            {trace.event}
          </span>
          <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
            {trace.latency_ms != null && <span className="tabular-nums">{trace.latency_ms}ms</span>}
            {trace.tokens_used != null && trace.tokens_used > 0 && <span className="tabular-nums">{trace.tokens_used} tk</span>}
            {trace.cost_usd != null && Number(trace.cost_usd) > 0 && <span className="tabular-nums">${Number(trace.cost_usd).toFixed(5)}</span>}
          </span>
        </button>

        {open && (
          <div className="mt-2 ml-6 space-y-2" onClick={(e) => e.stopPropagation()}>
            <JsonBlock label="Input" data={trace.input} />
            <JsonBlock label="Output" data={trace.output} />
            {trace.metadata && Object.keys(trace.metadata).length > 0 && (
              <JsonBlock label="Metadata" data={trace.metadata} />
            )}
            <Badge variant="outline" className="text-[9px] font-mono">{trace.id.slice(0, 8)}</Badge>
          </div>
        )}
      </li>
    );
  },
);
TraceItem.displayName = 'TraceItem';

function JsonBlock({ label, data }: { label: string; data: unknown }) {
  if (data == null) return null;
  let body: string;
  try {
    body = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  } catch {
    body = String(data);
  }
  if (!body || body === '""' || body === '{}') return null;
  return (
    <div>
      <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">{label}</p>
      <pre className="text-[10.5px] font-mono bg-muted/40 border border-border/40 rounded p-2 overflow-x-auto max-h-40 whitespace-pre-wrap">
        {body}
      </pre>
    </div>
  );
}
