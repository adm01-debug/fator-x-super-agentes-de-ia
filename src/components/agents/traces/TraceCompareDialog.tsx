/**
 * TraceCompareDialog — side-by-side comparison of two trace events from the
 * same execution. Mirrors the workflow StepComparePanel layout but operates on
 * AgentTraceRow (Input / Output / Metadata sections) with line-level diffing.
 */

import { useMemo } from 'react';
import { diffLines } from 'diff';
import { ArrowLeftRight, X, Info, AlertTriangle, XCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { AgentTraceRow, TraceLevel } from '@/services/agentTracesService';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  traceA: AgentTraceRow | null;
  indexA: number;
  traceB: AgentTraceRow | null;
  indexB: number;
  /** Swap A/B sides without re-selecting. */
  onSwap?: () => void;
}

const LEVEL_ICON: Record<TraceLevel, JSX.Element> = {
  info: <Info className="h-3 w-3 text-nexus-emerald" aria-hidden />,
  warning: <AlertTriangle className="h-3 w-3 text-nexus-amber" aria-hidden />,
  error: <XCircle className="h-3 w-3 text-destructive" aria-hidden />,
};

function stringify(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  try { return JSON.stringify(value, null, 2); } catch { return String(value); }
}

function buildMetadata(t: AgentTraceRow) {
  return {
    event: t.event,
    level: t.level,
    created_at: t.created_at,
    latency_ms: t.latency_ms,
    tokens_used: t.tokens_used,
    cost_usd: t.cost_usd,
    metadata: t.metadata ?? null,
  };
}

/** Project a line-level diff onto two parallel arrays for column alignment. */
function buildSideDiff(textA: string, textB: string) {
  const parts = diffLines(textA || '', textB || '');
  const left: Array<{ value: string; kind: 'same' | 'removed' | 'pad' }> = [];
  const right: Array<{ value: string; kind: 'same' | 'added' | 'pad' }> = [];
  for (const part of parts) {
    const lines = part.value.replace(/\n$/, '').split('\n');
    if (part.added) {
      for (const l of lines) { right.push({ value: l, kind: 'added' }); left.push({ value: '', kind: 'pad' }); }
    } else if (part.removed) {
      for (const l of lines) { left.push({ value: l, kind: 'removed' }); right.push({ value: '', kind: 'pad' }); }
    } else {
      for (const l of lines) { left.push({ value: l, kind: 'same' }); right.push({ value: l, kind: 'same' }); }
    }
  }
  return { left, right };
}

function DiffColumn({ rows, side }: { rows: Array<{ value: string; kind: string }>; side: 'left' | 'right' }) {
  return (
    <pre className="text-[11px] leading-5 font-mono whitespace-pre-wrap break-all">
      {rows.map((r, i) => {
        let cls = 'text-foreground/80';
        if (r.kind === 'removed') cls = 'bg-destructive/15 text-destructive line-through';
        else if (r.kind === 'added') cls = 'bg-nexus-emerald/15 text-nexus-emerald';
        else if (r.kind === 'pad') cls = 'bg-muted/30 text-transparent select-none';
        return (
          <div key={`${side}-${i}`} className={`px-2 ${cls}`}>{r.value || '\u00A0'}</div>
        );
      })}
    </pre>
  );
}

export function TraceCompareDialog({ open, onOpenChange, traceA, indexA, traceB, indexB, onSwap }: Props) {
  const sections = useMemo(() => {
    if (!traceA || !traceB) return [];
    const defs = [
      { key: 'input', label: 'Input', a: traceA.input, b: traceB.input },
      { key: 'output', label: 'Output', a: traceA.output, b: traceB.output },
      { key: 'metadata', label: 'Metadata', a: buildMetadata(traceA), b: buildMetadata(traceB) },
    ];
    return defs.map((s) => {
      const { left, right } = buildSideDiff(stringify(s.a), stringify(s.b));
      const changed = left.some((r) => r.kind !== 'same') || right.some((r) => r.kind !== 'same');
      return { ...s, left, right, changed };
    });
  }, [traceA, traceB]);

  if (!traceA || !traceB) return null;
  const totalChanges = sections.filter((s) => s.changed).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div>
              <DialogTitle className="flex items-center gap-2 text-sm">
                <ArrowLeftRight className="w-4 h-4 text-nexus-purple" />
                Comparação de passos
                <Badge variant="outline" className="text-[10px]">
                  {totalChanges === 0 ? 'sem diferenças' : `${totalChanges} seção(ões) alteradas`}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                Diferenças linha-a-linha entre dois eventos da mesma execução.
              </DialogDescription>
            </div>
            <div className="flex items-center gap-1 mr-6">
              {onSwap && (
                <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground" onClick={onSwap}>
                  <ArrowLeftRight className="w-3 h-3 mr-1" /> Inverter A/B
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" onClick={() => onOpenChange(false)}>
                <X className="w-3 h-3 mr-1" /> Fechar
              </Button>
            </div>
          </div>
        </DialogHeader>

        {/* A/B header strip */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-destructive font-semibold flex items-center gap-1.5">
              A {LEVEL_ICON[traceA.level]}
            </p>
            <p className="text-xs text-foreground font-medium truncate">
              #{indexA + 1} · {traceA.event}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {new Date(traceA.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="rounded-md border border-nexus-emerald/30 bg-nexus-emerald/5 px-3 py-1.5">
            <p className="text-[10px] uppercase tracking-wide text-nexus-emerald font-semibold flex items-center gap-1.5">
              B {LEVEL_ICON[traceB.level]}
            </p>
            <p className="text-xs text-foreground font-medium truncate">
              #{indexB + 1} · {traceB.event}
            </p>
            <p className="text-[10px] text-muted-foreground font-mono truncate">
              {new Date(traceB.created_at).toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        <div className="space-y-4 mt-2">
          {sections.map((s) => (
            <div key={s.key} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{s.label}</p>
                {s.changed
                  ? <Badge className="bg-nexus-amber/15 text-nexus-amber text-[10px] px-1.5 py-0">alterado</Badge>
                  : <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">idêntico</Badge>}
              </div>
              <div className="rounded-md border border-border overflow-hidden">
                <ScrollArea className="h-[220px]">
                  <div className="grid grid-cols-2 divide-x divide-border">
                    <DiffColumn rows={s.left} side="left" />
                    <DiffColumn rows={s.right} side="right" />
                  </div>
                </ScrollArea>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
