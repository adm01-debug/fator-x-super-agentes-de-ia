import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Loader2, Zap, ChevronDown, ChevronRight } from 'lucide-react';
import { SpanTreeView, type SpanLike } from '@/components/monitoring/SpanTreeView';

function TraceCard({ trace }: { trace: { id: string; event_type: string; created_at: string; data: Record<string, unknown> } }) {
  const [open, setOpen] = useState(false);
  const d = (trace.data || {}) as Record<string, unknown>;
  const spans = Array.isArray(d.spans) ? (d.spans as SpanLike[]) : [];
  const status = String(d.status || 'unknown');
  const traceId = String(d.trace_id || trace.id);

  return (
    <div className="nexus-card p-3">
      <button type="button" className="w-full text-left" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {spans.length > 0 ? (
              open ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            ) : <span className="w-3.5 shrink-0" />}
            <Zap className={`h-4 w-4 shrink-0 ${status === 'error' ? 'text-destructive' : 'text-nexus-emerald'}`} />
            <span className="text-xs font-medium text-foreground truncate">{trace.event_type}</span>
            <Badge variant="outline" className="text-[10px]">{status}</Badge>
            <code className="text-[10px] text-muted-foreground font-mono truncate hidden sm:inline">{traceId.slice(0, 8)}</code>
          </div>
          <span className="text-[11px] text-muted-foreground shrink-0 ml-2">{new Date(trace.created_at).toLocaleString('pt-BR')}</span>
        </div>
        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="p-2 rounded bg-secondary/30"><p className="text-sm font-bold text-foreground">{d.duration_ms ? `${Number(d.duration_ms)}ms` : '-'}</p><p className="text-[10px] text-muted-foreground">Duração</p></div>
          <div className="p-2 rounded bg-secondary/30"><p className="text-sm font-bold text-foreground">{typeof d.token_count === 'number' ? (d.token_count as number).toLocaleString() : '-'}</p><p className="text-[10px] text-muted-foreground">Tokens</p></div>
          <div className="p-2 rounded bg-secondary/30"><p className="text-sm font-bold text-foreground">{d.cost_usd ? `$${Number(d.cost_usd).toFixed(4)}` : '-'}</p><p className="text-[10px] text-muted-foreground">Custo</p></div>
          <div className="p-2 rounded bg-secondary/30"><p className="text-sm font-bold text-foreground">{spans.length || '-'}</p><p className="text-[10px] text-muted-foreground">Spans</p></div>
        </div>
      </button>
      {open && spans.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30">
          <SpanTreeView spans={spans} traceDurationMs={typeof d.duration_ms === 'number' ? d.duration_ms : undefined} />
        </div>
      )}
    </div>
  );
}

export function TracingPanel() {
  const { data: traceData = [], isLoading } = useQuery({
    queryKey: ['trace_events_tracing'],
    queryFn: async () => {
      const { getRecentTraceEvents } = await import('@/services/monitoringService');
      return await getRecentTraceEvents(50);
    },
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  if (traceData.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <Zap className="h-12 w-12 text-muted-foreground mb-4" />
      <h2 className="text-lg font-semibold text-foreground mb-1">Nenhum trace registrado</h2>
      <p className="text-sm text-muted-foreground">Traces OpenTelemetry aparecerão quando agentes executarem com tracing instrumentado.</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-heading font-semibold text-foreground">Trace Events ({traceData.length})</h3>
        <Badge variant="outline" className="text-[10px]">OTel GenAI</Badge>
      </div>
      <p className="text-[11px] text-muted-foreground">Clique em um trace para expandir a árvore de spans.</p>
      {traceData.map(trace => (
        <TraceCard key={trace.id} trace={trace as { id: string; event_type: string; created_at: string; data: Record<string, unknown> }} />
      ))}
    </div>
  );
}
