import { useMemo } from "react";

interface GraphNode {
  id: string;
  type: string;
  label: string;
  emoji?: string;
}

interface GraphEdge {
  source: string;
  target: string;
  label: string;
}

interface KnowledgeGraphSvgProps {
  nodes: GraphNode[];
  edges: GraphEdge[];
  width?: number;
  height?: number;
}

const TYPE_COLORS: Record<string, string> = {
  agent: 'hsl(var(--nexus-blue))',
  knowledge_base: 'hsl(var(--nexus-emerald))',
  tool: 'hsl(var(--nexus-yellow))',
  workflow: 'hsl(var(--nexus-cyan))',
};

interface PositionedNode extends GraphNode {
  x: number;
  y: number;
}

/**
 * Lightweight SVG visualization for the Super Cérebro knowledge graph.
 * Uses concentric circles per node type — agents in center, then KBs,
 * then tools, then workflows on the outside. No physics simulation
 * (kept simple to render even on mobile).
 */
export function KnowledgeGraphSvg({
  nodes,
  edges,
  width = 700,
  height = 480,
}: KnowledgeGraphSvgProps) {
  const positioned = useMemo<PositionedNode[]>(() => {
    if (!nodes || nodes.length === 0) return [];

    const cx = width / 2;
    const cy = height / 2;
    const ringConfig = [
      { type: 'agent', radius: 0 },
      { type: 'knowledge_base', radius: 110 },
      { type: 'tool', radius: 180 },
      { type: 'workflow', radius: 230 },
    ];

    const out: PositionedNode[] = [];

    for (const ring of ringConfig) {
      const ringNodes = nodes.filter((n) => n.type === ring.type);
      const count = ringNodes.length;
      if (count === 0) continue;

      if (ring.radius === 0) {
        // Agents in middle row
        const spacing = Math.min(110, (width - 80) / Math.max(count, 1));
        const startX = cx - ((count - 1) * spacing) / 2;
        ringNodes.forEach((n, i) => {
          out.push({ ...n, x: startX + i * spacing, y: cy });
        });
      } else {
        ringNodes.forEach((n, i) => {
          const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
          out.push({
            ...n,
            x: cx + Math.cos(angle) * ring.radius,
            y: cy + Math.sin(angle) * ring.radius,
          });
        });
      }
    }

    return out;
  }, [nodes, width, height]);

  const positionMap = useMemo(() => {
    const map = new Map<string, PositionedNode>();
    positioned.forEach((n) => map.set(n.id, n));
    return map;
  }, [positioned]);

  if (positioned.length === 0) {
    return (
      <div className="flex items-center justify-center h-[300px] text-xs text-muted-foreground italic">
        Nenhum nó no grafo
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <svg
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        xmlns="http://www.w3.org/2000/svg"
        className="rounded-lg bg-background/40"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="8"
            markerHeight="8"
            refX="7"
            refY="4"
            orient="auto"
          >
            <polygon points="0 0, 8 4, 0 8" fill="#4D96FF" opacity="0.5" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((e, i) => {
          const s = positionMap.get(e.source);
          const t = positionMap.get(e.target);
          if (!s || !t) return null;
          return (
            <g key={`edge-${i}`}>
              <line
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke="#4D96FF"
                strokeOpacity="0.25"
                strokeWidth="1.2"
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {/* Nodes */}
        {positioned.map((n) => {
          const color = TYPE_COLORS[n.type] ?? 'hsl(var(--nexus-purple))';
          const truncatedLabel = n.label.length > 14 ? n.label.slice(0, 13) + '…' : n.label;
          return (
            <g key={n.id}>
              <circle
                cx={n.x}
                cy={n.y}
                r="22"
                fill={color}
                fillOpacity="0.15"
                stroke={color}
                strokeWidth="2"
              />
              <text
                x={n.x}
                y={n.y + 5}
                textAnchor="middle"
                fontSize="14"
                fill={color}
              >
                {n.emoji ?? '•'}
              </text>
              <text
                x={n.x}
                y={n.y + 38}
                textAnchor="middle"
                fontSize="9"
                fill="#9ca3af"
                fontFamily="ui-monospace, monospace"
              >
                {truncatedLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
