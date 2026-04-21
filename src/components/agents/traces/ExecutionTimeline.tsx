import { useState } from 'react';
import { ChevronDown, ChevronRight, Info, AlertTriangle, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

export function ExecutionTimeline({ execution }: { execution: ExecutionGroup }) {
  return (
    <ol className="space-y-1.5" aria-label="Linha do tempo de eventos">
      {execution.traces.map((t, i) => (
        <TraceItem key={t.id} trace={t} index={i} />
      ))}
    </ol>
  );
}

function TraceItem({ trace, index }: { trace: AgentTraceRow; index: number }) {
  const [open, setOpen] = useState(false);
  const ts = new Date(trace.created_at).toLocaleTimeString('pt-BR', { hour12: false });

  return (
    <li className={`border-l-2 ${LEVEL_BORDER[trace.level]} pl-3 py-1.5 bg-card/40 rounded-r-md`}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-center gap-2 text-xs hover:text-foreground"
        aria-expanded={open}
      >
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums w-8">#{index + 1}</span>
        <span className="font-mono text-[10px] text-muted-foreground tabular-nums">{ts}</span>
        {LEVEL_ICON[trace.level]}
        <span className="font-medium text-foreground truncate">{trace.event}</span>
        <span className="ml-auto flex items-center gap-2 text-[10px] text-muted-foreground shrink-0">
          {trace.latency_ms != null && <span className="tabular-nums">{trace.latency_ms}ms</span>}
          {trace.tokens_used != null && trace.tokens_used > 0 && <span className="tabular-nums">{trace.tokens_used} tk</span>}
          {trace.cost_usd != null && Number(trace.cost_usd) > 0 && <span className="tabular-nums">${Number(trace.cost_usd).toFixed(5)}</span>}
        </span>
      </button>

      {open && (
        <div className="mt-2 ml-6 space-y-2">
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
}

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
