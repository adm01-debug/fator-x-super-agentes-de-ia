/**
 * TemplateCanvasPreview — Nexus Agents Studio (T11.2)
 *
 * Renders a template's nodes/edges as a compact SVG mini-map so users
 * can SEE the workflow shape before applying it.
 *
 * Pure presentation: takes nodes + edges, normalises positions to a
 * fixed viewBox, draws edges as bezier curves and nodes as rounded rects
 * coloured by type.
 */
import { useMemo } from "react";

interface PreviewNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface PreviewEdge {
  id: string;
  source: string;
  target: string;
}

interface Props {
  nodes: PreviewNode[];
  edges: PreviewEdge[];
  height?: number;
}

const NODE_W = 70;
const NODE_H = 26;
const PADDING = 12;

const TYPE_COLOR: Record<string, string> = {
  trigger: "hsl(142 71% 45%)",
  agent: "hsl(217 91% 60%)",
  tool: "hsl(38 92% 50%)",
  rag: "hsl(280 65% 60%)",
  condition: "hsl(0 84% 60%)",
  action: "hsl(190 80% 50%)",
  loop: "hsl(48 96% 53%)",
  parallel: "hsl(262 83% 58%)",
};

function colorForType(type: string): string {
  return TYPE_COLOR[type] ?? "hsl(220 9% 46%)";
}

export function TemplateCanvasPreview({ nodes, edges, height = 140 }: Props) {
  const layout = useMemo(() => {
    if (nodes.length === 0) return null;

    const minX = Math.min(...nodes.map((n) => n.position.x));
    const maxX = Math.max(...nodes.map((n) => n.position.x + NODE_W));
    const minY = Math.min(...nodes.map((n) => n.position.y));
    const maxY = Math.max(...nodes.map((n) => n.position.y + NODE_H));

    const width = maxX - minX + PADDING * 2;
    const totalHeight = maxY - minY + PADDING * 2;

    const positioned = nodes.map((n) => ({
      ...n,
      x: n.position.x - minX + PADDING,
      y: n.position.y - minY + PADDING,
    }));

    const nodeMap = new Map(positioned.map((n) => [n.id, n]));

    const edgePaths = edges
      .map((e) => {
        const s = nodeMap.get(e.source);
        const t = nodeMap.get(e.target);
        if (!s || !t) return null;
        const x1 = s.x + NODE_W;
        const y1 = s.y + NODE_H / 2;
        const x2 = t.x;
        const y2 = t.y + NODE_H / 2;
        const dx = Math.max(20, (x2 - x1) / 2);
        return {
          id: e.id,
          d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
        };
      })
      .filter((p): p is { id: string; d: string } => p !== null);

    return { width, totalHeight, positioned, edgePaths };
  }, [nodes, edges]);

  if (!layout) {
    return (
      <div
        className="rounded-md border border-border/30 bg-secondary/20 flex items-center justify-center text-[10px] text-muted-foreground"
        style={{ height }}
      >
        Sem nós para visualizar
      </div>
    );
  }

  return (
    <div
      className="rounded-md border border-border/30 bg-secondary/10 overflow-hidden"
      style={{ height }}
    >
      <svg
        viewBox={`0 0 ${layout.width} ${layout.totalHeight}`}
        preserveAspectRatio="xMidYMid meet"
        width="100%"
        height="100%"
        role="img"
        aria-label="Pré-visualização do workflow"
      >
        {/* Edges */}
        <g fill="none" stroke="hsl(var(--muted-foreground))" strokeOpacity="0.5" strokeWidth="1.2">
          {layout.edgePaths.map((e) => (
            <path key={e.id} d={e.d} />
          ))}
        </g>
        {/* Nodes */}
        <g>
          {layout.positioned.map((n) => {
            const color = colorForType(n.type);
            const label = String(n.data.label ?? n.type);
            const truncated = label.length > 14 ? label.slice(0, 13) + "…" : label;
            return (
              <g key={n.id}>
                <rect
                  x={n.x}
                  y={n.y}
                  width={NODE_W}
                  height={NODE_H}
                  rx={5}
                  ry={5}
                  fill={color}
                  fillOpacity="0.18"
                  stroke={color}
                  strokeWidth="1.2"
                />
                <circle
                  cx={n.x + 6}
                  cy={n.y + NODE_H / 2}
                  r={2.2}
                  fill={color}
                />
                <text
                  x={n.x + 12}
                  y={n.y + NODE_H / 2 + 3}
                  fontSize="8"
                  fontFamily="ui-sans-serif, system-ui, sans-serif"
                  fill="hsl(var(--foreground))"
                  fontWeight="500"
                >
                  {truncated}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}

export default TemplateCanvasPreview;
