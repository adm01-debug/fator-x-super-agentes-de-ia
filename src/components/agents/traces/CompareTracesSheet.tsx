/**
 * CompareTracesSheet — side-by-side comparison of two execution groups.
 *
 * Shows: summary deltas (latency, tokens, cost, level counts), event-level
 * timeline diff (only-A / only-B / both), tool-call counts with delta,
 * and full error messages from each side.
 */
import { useMemo } from 'react';
import { ArrowRight, CheckCircle2, Clock, DollarSign, Hash, Info, Wrench, XCircle } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import type { ExecutionGroup, AgentTraceRow } from '@/services/agentTracesService';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  a: ExecutionGroup | null;
  b: ExecutionGroup | null;
}

/** Extracts a tool name from a trace row using event prefix or metadata.tool. */
function toolNameOf(t: AgentTraceRow): string | null {
  const meta = t.metadata as Record<string, unknown> | null;
  const fromMeta = meta?.tool;
  if (typeof fromMeta === 'string' && fromMeta.trim()) return fromMeta.trim();
  // Convention: events like `tool_call_*`, `tool.<name>` or `*tool*` carry a tool
  // identifier in either the event suffix or metadata.name/.endpoint as fallback.
  if (/tool/i.test(t.event)) {
    const fromName = meta?.name;
    if (typeof fromName === 'string' && fromName.trim()) return fromName.trim();
    const fromEndpoint = meta?.endpoint;
    if (typeof fromEndpoint === 'string' && fromEndpoint.trim()) return fromEndpoint.trim();
    // Strip common prefixes when nothing else is available.
    return t.event.replace(/^tool[._-]?(call[._-]?)?(success|error|started|finished)?[._-]?/i, '') || t.event;
  }
  return null;
}

/** Extracts a human-readable error message. */
function errorMessageOf(t: AgentTraceRow): string {
  const meta = t.metadata as Record<string, unknown> | null;
  for (const k of ['error', 'message', 'msg', 'reason', 'detail']) {
    const v = meta?.[k];
    if (typeof v === 'string' && v.trim()) return v;
  }
  // Fallback to the output payload if it looks scalar.
  if (typeof t.output === 'string') return t.output;
  if (t.output && typeof t.output === 'object') return JSON.stringify(t.output).slice(0, 240);
  return t.event;
}

interface Summary {
  totalMs: number;
  tokens: number;
  cost: number;
  info: number;
  warning: number;
  error: number;
  steps: number;
}

function summarize(g: ExecutionGroup): Summary {
  return {
    totalMs: g.total_ms,
    tokens: g.total_tokens,
    cost: g.total_cost,
    info: g.counts.info,
    warning: g.counts.warning,
    error: g.counts.error,
    steps: g.traces.length,
  };
}

/** Format a delta with sign + color hint. */
function fmtDelta(delta: number, opts: { unit?: string; precision?: number; invertColor?: boolean } = {}) {
  const { unit = '', precision = 0, invertColor = false } = opts;
  if (delta === 0) return { text: '±0' + (unit ? ` ${unit}` : ''), tone: 'neutral' as const };
  const sign = delta > 0 ? '+' : '';
  const text = `${sign}${delta.toFixed(precision)}${unit ? ` ${unit}` : ''}`;
  // For metrics where "more is worse" (latency, cost, errors), invertColor=true.
  const isBad = invertColor ? delta > 0 : delta < 0;
  return { text, tone: isBad ? ('bad' as const) : ('good' as const) };
}

function toneClass(tone: 'neutral' | 'good' | 'bad'): string {
  if (tone === 'good') return 'text-nexus-emerald';
  if (tone === 'bad') return 'text-destructive';
  return 'text-muted-foreground';
}

/** Builds a map { event -> count } for diffing two timelines. */
function countByEvent(g: ExecutionGroup): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of g.traces) m.set(t.event, (m.get(t.event) ?? 0) + 1);
  return m;
}

/** Builds a map { tool -> count } from traces that look like tool calls. */
function countTools(g: ExecutionGroup): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of g.traces) {
    const tool = toolNameOf(t);
    if (tool) m.set(tool, (m.get(tool) ?? 0) + 1);
  }
  return m;
}

function ShortId({ value }: { value: string }) {
  if (value.startsWith('auto-')) return <>∅ sem session</>;
  return <span className="font-mono">{value.slice(0, 18)}</span>;
}

interface MetricCellProps {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  valueA: string;
  valueB: string;
  delta: { text: string; tone: 'neutral' | 'good' | 'bad' };
}

function MetricRow({ label, icon: Icon, valueA, valueB, delta }: MetricCellProps) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 py-2 border-b border-border/30 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden />
        <span className="text-xs text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-sm font-mono tabular-nums text-foreground text-right min-w-[80px]">{valueA}</span>
      <span className="text-sm font-mono tabular-nums text-foreground text-right min-w-[80px]">{valueB}</span>
      <span className={`text-xs font-mono tabular-nums text-right min-w-[70px] ${toneClass(delta.tone)}`}>
        {delta.text}
      </span>
    </div>
  );
}

export function CompareTracesSheet({ open, onOpenChange, a, b }: Props) {
  const summaryA = useMemo(() => (a ? summarize(a) : null), [a]);
  const summaryB = useMemo(() => (b ? summarize(b) : null), [b]);

  // Event diff: union of event names with side-by-side counts.
  const eventDiff = useMemo(() => {
    if (!a || !b) return [] as Array<{ event: string; countA: number; countB: number; status: 'only-a' | 'only-b' | 'both' }>;
    const mapA = countByEvent(a);
    const mapB = countByEvent(b);
    const all = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const rows: Array<{ event: string; countA: number; countB: number; status: 'only-a' | 'only-b' | 'both' }> = [];
    for (const ev of all) {
      const ca = mapA.get(ev) ?? 0;
      const cb = mapB.get(ev) ?? 0;
      rows.push({ event: ev, countA: ca, countB: cb, status: ca && cb ? 'both' : ca ? 'only-a' : 'only-b' });
    }
    // Order: only-a / only-b first (most interesting), then both, alpha within group.
    return rows.sort((x, y) => {
      const order = { 'only-a': 0, 'only-b': 1, both: 2 } as const;
      if (order[x.status] !== order[y.status]) return order[x.status] - order[y.status];
      return x.event.localeCompare(y.event);
    });
  }, [a, b]);

  const toolDiff = useMemo(() => {
    if (!a || !b) return [] as Array<{ tool: string; countA: number; countB: number; delta: number }>;
    const mapA = countTools(a);
    const mapB = countTools(b);
    const all = new Set<string>([...mapA.keys(), ...mapB.keys()]);
    const rows: Array<{ tool: string; countA: number; countB: number; delta: number }> = [];
    for (const tool of all) {
      const ca = mapA.get(tool) ?? 0;
      const cb = mapB.get(tool) ?? 0;
      rows.push({ tool, countA: ca, countB: cb, delta: cb - ca });
    }
    return rows.sort((x, y) => Math.abs(y.delta) - Math.abs(x.delta) || x.tool.localeCompare(y.tool));
  }, [a, b]);

  const errorsA = useMemo(() => (a ? a.traces.filter((t) => t.level === 'error') : []), [a]);
  const errorsB = useMemo(() => (b ? b.traces.filter((t) => t.level === 'error') : []), [b]);

  if (!a || !b || !summaryA || !summaryB) return null;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-3xl lg:max-w-4xl p-0 flex flex-col gap-0"
      >
        <SheetHeader className="p-5 border-b border-border/40 space-y-2">
          <SheetTitle className="text-base font-semibold">Comparar execuções</SheetTitle>
          <SheetDescription asChild>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 rounded bg-secondary/60">A</span>
              <ShortId value={a.session_id} />
              <ArrowRight className="h-3 w-3" aria-hidden />
              <span className="px-2 py-0.5 rounded bg-secondary/60">B</span>
              <ShortId value={b.session_id} />
            </div>
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-6">
            {/* Summary deltas */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Resumo
              </h3>
              <div className="rounded-lg border border-border/40 bg-card/40 px-3">
                <div className="grid grid-cols-[1fr_auto_1fr_auto] items-center gap-3 py-2 border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
                  <span>Métrica</span>
                  <span className="text-right min-w-[80px]">A</span>
                  <span className="text-right min-w-[80px]">B</span>
                  <span className="text-right min-w-[70px]">Δ</span>
                </div>
                <MetricRow
                  label="Latência total"
                  icon={Clock}
                  valueA={`${summaryA.totalMs}ms`}
                  valueB={`${summaryB.totalMs}ms`}
                  delta={fmtDelta(summaryB.totalMs - summaryA.totalMs, { unit: 'ms', invertColor: true })}
                />
                <MetricRow
                  label="Tokens"
                  icon={Hash}
                  valueA={summaryA.tokens.toLocaleString('pt-BR')}
                  valueB={summaryB.tokens.toLocaleString('pt-BR')}
                  delta={fmtDelta(summaryB.tokens - summaryA.tokens, { invertColor: true })}
                />
                <MetricRow
                  label="Custo"
                  icon={DollarSign}
                  valueA={`$${summaryA.cost.toFixed(4)}`}
                  valueB={`$${summaryB.cost.toFixed(4)}`}
                  delta={fmtDelta(summaryB.cost - summaryA.cost, { unit: 'USD', precision: 4, invertColor: true })}
                />
                <MetricRow
                  label="Steps"
                  icon={Info}
                  valueA={String(summaryA.steps)}
                  valueB={String(summaryB.steps)}
                  delta={fmtDelta(summaryB.steps - summaryA.steps)}
                />
                <MetricRow
                  label="Info"
                  icon={CheckCircle2}
                  valueA={String(summaryA.info)}
                  valueB={String(summaryB.info)}
                  delta={fmtDelta(summaryB.info - summaryA.info)}
                />
                <MetricRow
                  label="Warning"
                  icon={CheckCircle2}
                  valueA={String(summaryA.warning)}
                  valueB={String(summaryB.warning)}
                  delta={fmtDelta(summaryB.warning - summaryA.warning, { invertColor: true })}
                />
                <MetricRow
                  label="Erros"
                  icon={XCircle}
                  valueA={String(summaryA.error)}
                  valueB={String(summaryB.error)}
                  delta={fmtDelta(summaryB.error - summaryA.error, { invertColor: true })}
                />
              </div>
            </section>

            {/* Event timeline diff */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                Timeline de eventos
              </h3>
              <div className="flex items-center gap-3 mb-2 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-nexus-emerald/60" />Apenas em A</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-destructive/60" />Apenas em B</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-muted" />Em ambos</span>
              </div>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                {eventDiff.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-4 text-center">Sem eventos para comparar.</p>
                ) : (
                  <ul className="divide-y divide-border/30">
                    {eventDiff.map((row) => {
                      const stripeClass =
                        row.status === 'only-a' ? 'border-l-2 border-l-nexus-emerald/60 bg-nexus-emerald/5'
                          : row.status === 'only-b' ? 'border-l-2 border-l-destructive/60 bg-destructive/5'
                          : 'border-l-2 border-l-transparent';
                      return (
                        <li
                          key={row.event}
                          className={`grid grid-cols-[1fr_auto_auto] items-center gap-3 px-3 py-1.5 text-xs ${stripeClass}`}
                        >
                          <span className="font-mono truncate text-foreground/90" title={row.event}>{row.event}</span>
                          <span className={`font-mono tabular-nums text-right min-w-[40px] ${row.countA === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                            {row.countA}
                          </span>
                          <span className={`font-mono tabular-nums text-right min-w-[40px] ${row.countB === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                            {row.countB}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </section>

            {/* Tool calls diff */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <Wrench className="h-3 w-3" aria-hidden /> Ferramentas chamadas
              </h3>
              <div className="rounded-lg border border-border/40 overflow-hidden">
                {toolDiff.length === 0 ? (
                  <p className="text-xs text-muted-foreground px-3 py-4 text-center">
                    Nenhuma chamada de ferramenta detectada em qualquer lado.
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/40">
                      <span>Tool</span>
                      <span className="text-right min-w-[40px]">A</span>
                      <span className="text-right min-w-[40px]">B</span>
                      <span className="text-right min-w-[60px]">Δ</span>
                    </div>
                    <ul className="divide-y divide-border/30">
                      {toolDiff.map((row) => {
                        const tone = row.delta === 0 ? 'text-muted-foreground' : row.delta > 0 ? 'text-nexus-amber' : 'text-nexus-emerald';
                        return (
                          <li key={row.tool} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-1.5 text-xs">
                            <span className="font-mono truncate text-foreground/90" title={row.tool}>{row.tool}</span>
                            <span className={`font-mono tabular-nums text-right min-w-[40px] ${row.countA === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                              {row.countA}
                            </span>
                            <span className={`font-mono tabular-nums text-right min-w-[40px] ${row.countB === 0 ? 'text-muted-foreground/50' : 'text-foreground'}`}>
                              {row.countB}
                            </span>
                            <span className={`font-mono tabular-nums text-right min-w-[60px] ${tone}`}>
                              {row.delta === 0 ? '±0' : row.delta > 0 ? `+${row.delta}` : String(row.delta)}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                )}
              </div>
            </section>

            {/* Errors side-by-side */}
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                <XCircle className="h-3 w-3" aria-hidden /> Erros
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <div className="px-3 py-1.5 bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>A — {errorsA.length} erro{errorsA.length === 1 ? '' : 's'}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{summaryA.error}</Badge>
                  </div>
                  {errorsA.length === 0 ? (
                    <p className="text-xs text-nexus-emerald px-3 py-3 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Sem erros
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/30 max-h-64 overflow-auto">
                      {errorsA.map((t) => (
                        <li key={t.id} className="px-3 py-2 text-xs space-y-0.5">
                          <p className="font-mono text-[10px] text-muted-foreground">{t.event}</p>
                          <p className="text-foreground/90 break-words">{errorMessageOf(t)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="rounded-lg border border-border/40 overflow-hidden">
                  <div className="px-3 py-1.5 bg-secondary/30 text-[10px] uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                    <span>B — {errorsB.length} erro{errorsB.length === 1 ? '' : 's'}</span>
                    <Badge variant="outline" className="text-[10px] h-4 px-1">{summaryB.error}</Badge>
                  </div>
                  {errorsB.length === 0 ? (
                    <p className="text-xs text-nexus-emerald px-3 py-3 flex items-center gap-1.5">
                      <CheckCircle2 className="h-3 w-3" aria-hidden /> Sem erros
                    </p>
                  ) : (
                    <ul className="divide-y divide-border/30 max-h-64 overflow-auto">
                      {errorsB.map((t) => (
                        <li key={t.id} className="px-3 py-2 text-xs space-y-0.5">
                          <p className="font-mono text-[10px] text-muted-foreground">{t.event}</p>
                          <p className="text-foreground/90 break-words">{errorMessageOf(t)}</p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </section>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
