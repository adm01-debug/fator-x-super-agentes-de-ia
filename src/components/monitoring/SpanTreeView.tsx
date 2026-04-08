/**
 * SpanTreeView — Nexus Agents Studio (improvement #2)
 *
 * Renders a hierarchical tree of spans from a flat array using
 * parent_span_id, with collapsible nodes, type badges, status colours,
 * and a horizontal timing bar showing each span's relative duration.
 *
 * Pure presentation: takes a `spans` array (the same shape exported by
 * src/lib/tracing.ts SpanData) plus the trace start_time and total
 * duration to compute relative bar positions.
 */
import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface SpanLike {
  span_id: string;
  parent_span_id: string | null;
  trace_id?: string;
  name: string;
  kind: string;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  status: 'unset' | 'ok' | 'error';
  status_message?: string;
  attributes?: Record<string, unknown>;
}

interface SpanNode extends SpanLike {
  children: SpanNode[];
  depth: number;
}

const KIND_COLOR: Record<string, string> = {
  llm: "hsl(217 91% 60%)",
  tool: "hsl(38 92% 50%)",
  rag: "hsl(280 65% 60%)",
  guardrail: "hsl(0 84% 60%)",
  memory: "hsl(190 80% 50%)",
  workflow: "hsl(262 83% 58%)",
  http: "hsl(142 71% 45%)",
  db: "hsl(48 96% 53%)",
  custom: "hsl(220 9% 46%)",
};

function colorForKind(kind: string): string {
  return KIND_COLOR[kind] ?? KIND_COLOR.custom;
}

/**
 * Build a tree from a flat span array using parent_span_id.
 * Spans with no parent (or whose parent isn't in the array) become roots.
 */
function buildTree(spans: SpanLike[]): SpanNode[] {
  const byId = new Map<string, SpanNode>();
  spans.forEach((s) => byId.set(s.span_id, { ...s, children: [], depth: 0 }));

  const roots: SpanNode[] = [];
  for (const node of byId.values()) {
    if (node.parent_span_id && byId.has(node.parent_span_id)) {
      const parent = byId.get(node.parent_span_id)!;
      node.depth = parent.depth + 1;
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort each level by start_time so the visual order matches execution order
  const sortRecursive = (nodes: SpanNode[]) => {
    nodes.sort((a, b) => a.start_time - b.start_time);
    nodes.forEach((n) => {
      // Propagate depth top-down (in case parent depth was set later)
      n.children.forEach((c) => {
        c.depth = n.depth + 1;
      });
      sortRecursive(n.children);
    });
  };
  sortRecursive(roots);

  return roots;
}

interface SpanRowProps {
  node: SpanNode;
  traceStart: number;
  traceDuration: number;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}

function SpanRow({ node, traceStart, traceDuration, expanded, onToggle }: SpanRowProps) {
  const isExpanded = expanded.has(node.span_id);
  const hasChildren = node.children.length > 0;
  const color = colorForKind(node.kind);

  // Compute timing bar geometry: left % from start, width % of duration
  const startOffset = node.start_time - traceStart;
  const duration = node.duration_ms ?? 0;
  const leftPct = traceDuration > 0 ? (startOffset / traceDuration) * 100 : 0;
  const widthPct = traceDuration > 0 ? Math.max(0.5, (duration / traceDuration) * 100) : 0;

  const StatusIcon =
    node.status === 'error' ? AlertCircle :
    node.status === 'ok' ? CheckCircle2 :
    Circle;
  const statusColor =
    node.status === 'error' ? 'text-destructive' :
    node.status === 'ok' ? 'text-nexus-emerald' :
    'text-muted-foreground';

  return (
    <>
      <div
        className="grid grid-cols-[minmax(180px,1fr)_120px_1fr] gap-2 items-center py-1.5 px-2 border-b border-border/20 hover:bg-secondary/20 transition-colors text-xs"
        style={{ paddingLeft: `${node.depth * 16 + 8}px` }}
      >
        {/* Name + chevron + status */}
        <div className="flex items-center gap-1.5 min-w-0">
          {hasChildren ? (
            <button
              type="button"
              onClick={() => onToggle(node.span_id)}
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label={isExpanded ? 'Recolher' : 'Expandir'}
            >
              {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            </button>
          ) : (
            <span className="w-3 shrink-0" />
          )}
          <StatusIcon className={`h-3 w-3 shrink-0 ${statusColor}`} />
          <Badge
            variant="outline"
            className="text-[9px] font-mono shrink-0"
            style={{ borderColor: color + '80', color }}
          >
            {node.kind}
          </Badge>
          <span className="text-foreground font-medium truncate" title={node.name}>
            {node.name}
          </span>
        </div>

        {/* Duration */}
        <div className="text-right text-muted-foreground tabular-nums">
          {duration > 0 ? `${duration.toFixed(0)}ms` : '—'}
        </div>

        {/* Timing bar */}
        <div className="relative h-4 bg-secondary/30 rounded overflow-hidden">
          <div
            className="absolute top-0 h-full rounded"
            style={{
              left: `${leftPct}%`,
              width: `${Math.min(widthPct, 100 - leftPct)}%`,
              backgroundColor: color,
              opacity: 0.7,
            }}
            title={`${duration.toFixed(0)}ms @ +${startOffset}ms`}
          />
        </div>
      </div>

      {/* Children */}
      {isExpanded && hasChildren && node.children.map((child) => (
        <SpanRow
          key={child.span_id}
          node={child}
          traceStart={traceStart}
          traceDuration={traceDuration}
          expanded={expanded}
          onToggle={onToggle}
        />
      ))}

      {/* Error message inline — always visible (not gated by expansion) */}
      {node.status === 'error' && node.status_message && (
        <div
          className="text-[11px] text-destructive italic py-1 px-2 border-b border-border/20 bg-destructive/5"
          style={{ paddingLeft: `${node.depth * 16 + 32}px` }}
        >
          ⚠ {node.status_message}
        </div>
      )}
    </>
  );
}

interface SpanTreeViewProps {
  spans: SpanLike[];
  traceStartTime?: number;
  traceDurationMs?: number;
  defaultExpanded?: boolean;
}

export function SpanTreeView({
  spans,
  traceStartTime,
  traceDurationMs,
  defaultExpanded = true,
}: SpanTreeViewProps) {
  const tree = useMemo(() => buildTree(spans), [spans]);

  // Default: every span with children is expanded
  const allExpandedIds = useMemo(() => {
    const ids = new Set<string>();
    const walk = (nodes: SpanNode[]) => {
      nodes.forEach((n) => {
        if (n.children.length > 0) ids.add(n.span_id);
        walk(n.children);
      });
    };
    walk(tree);
    return ids;
  }, [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(
    defaultExpanded ? allExpandedIds : new Set()
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Compute trace bounds if not provided
  const computedStart = useMemo(() => {
    if (traceStartTime != null) return traceStartTime;
    if (spans.length === 0) return 0;
    return Math.min(...spans.map((s) => s.start_time));
  }, [spans, traceStartTime]);

  const computedDuration = useMemo(() => {
    if (traceDurationMs != null && traceDurationMs > 0) return traceDurationMs;
    if (spans.length === 0) return 0;
    const start = computedStart;
    const end = Math.max(
      ...spans.map((s) => s.end_time ?? s.start_time + (s.duration_ms ?? 0))
    );
    return Math.max(1, end - start);
  }, [spans, computedStart, traceDurationMs]);

  if (spans.length === 0) {
    return (
      <div className="text-center py-6 text-[11px] text-muted-foreground italic">
        Sem spans para exibir
      </div>
    );
  }

  return (
    <div className="rounded-md border border-border/30 overflow-hidden">
      {/* Header */}
      <div className="grid grid-cols-[minmax(180px,1fr)_120px_1fr] gap-2 px-2 py-1.5 bg-secondary/30 border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
        <div>Span</div>
        <div className="text-right">Duração</div>
        <div>Linha do tempo ({computedDuration.toFixed(0)}ms)</div>
      </div>

      {/* Rows */}
      {tree.map((root) => (
        <SpanRow
          key={root.span_id}
          node={root}
          traceStart={computedStart}
          traceDuration={computedDuration}
          expanded={expanded}
          onToggle={toggle}
        />
      ))}
    </div>
  );
}

export default SpanTreeView;
