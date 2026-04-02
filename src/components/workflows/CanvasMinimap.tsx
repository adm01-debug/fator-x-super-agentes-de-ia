import type { CanvasNode, CanvasEdge } from './WorkflowCanvas';

const MINIMAP_W = 160;
const MINIMAP_H = 100;

interface Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  zoom: number;
  pan: { x: number; y: number };
  containerWidth: number;
  containerHeight: number;
}

export function CanvasMinimap({ nodes, edges, zoom, pan, containerWidth, containerHeight }: Props) {
  if (nodes.length === 0) return null;

  // Compute bounding box of all nodes (with padding)
  const PAD = 40;
  const NODE_W = 160;
  const NODE_H = 72;
  const minX = Math.min(...nodes.map(n => n.x)) - PAD;
  const minY = Math.min(...nodes.map(n => n.y)) - PAD;
  const maxX = Math.max(...nodes.map(n => n.x + NODE_W)) + PAD;
  const maxY = Math.max(...nodes.map(n => n.y + NODE_H)) + PAD;
  const worldW = maxX - minX || 1;
  const worldH = maxY - minY || 1;

  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);

  const toMini = (x: number, y: number) => ({
    x: (x - minX) * scale,
    y: (y - minY) * scale,
  });

  // Viewport rectangle in world coords
  const vpX = -pan.x / zoom;
  const vpY = -pan.y / zoom;
  const vpW = containerWidth / zoom;
  const vpH = containerHeight / zoom;
  const vp = toMini(vpX, vpY);
  const vpEnd = toMini(vpX + vpW, vpY + vpH);

  return (
    <div
      className="absolute bottom-3 right-3 rounded-lg border border-border bg-card shadow-lg z-20 overflow-hidden"
      style={{ width: MINIMAP_W, height: MINIMAP_H }}
    >
      <svg width={MINIMAP_W} height={MINIMAP_H} xmlns="http://www.w3.org/2000/svg">
        {/* Edges */}
        {edges.map((edge, i) => {
          const fromNode = nodes.find(n => n.id === edge.from);
          const toNode = nodes.find(n => n.id === edge.to);
          if (!fromNode || !toNode) return null;
          const from = toMini(fromNode.x + NODE_W / 2, fromNode.y + NODE_H / 2);
          const to = toMini(toNode.x + NODE_W / 2, toNode.y + NODE_H / 2);
          return (
            <line key={i} x1={from.x} y1={from.y} x2={to.x} y2={to.y}
              stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.4" />
          );
        })}
        {/* Nodes */}
        {nodes.map(node => {
          const pos = toMini(node.x, node.y);
          const w = NODE_W * scale;
          const h = NODE_H * scale;
          return (
            <rect key={node.id} x={pos.x} y={pos.y} width={Math.max(w, 4)} height={Math.max(h, 3)}
              rx="2" fill="hsl(var(--primary))" opacity="0.6" />
          );
        })}
        {/* Viewport */}
        <rect
          x={Math.max(0, vp.x)} y={Math.max(0, vp.y)}
          width={Math.min(MINIMAP_W, vpEnd.x - vp.x)} height={Math.min(MINIMAP_H, vpEnd.y - vp.y)}
          fill="hsl(var(--primary))" fillOpacity="0.08"
          stroke="hsl(var(--primary))" strokeWidth="1" strokeDasharray="3 2" opacity="0.7"
        />
      </svg>
    </div>
  );
}
