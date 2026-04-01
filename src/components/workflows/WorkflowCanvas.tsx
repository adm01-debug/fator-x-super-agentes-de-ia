import { useState, useRef, useCallback } from 'react';
import { Brain, Search, FileText, Shield, Wrench, GripVertical, X, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export interface CanvasNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

export interface CanvasEdge {
  from: string;
  to: string;
}

const NODE_ROLES: { type: string; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'planner', label: 'Planner', icon: Brain, color: 'hsl(var(--primary))' },
  { type: 'researcher', label: 'Researcher', icon: Search, color: 'hsl(250 80% 60%)' },
  { type: 'retriever', label: 'Retriever', icon: FileText, color: 'hsl(170 70% 45%)' },
  { type: 'critic', label: 'Critic', icon: Shield, color: 'hsl(35 90% 55%)' },
  { type: 'executor', label: 'Executor', icon: Wrench, color: 'hsl(0 70% 55%)' },
];

const NODE_W = 160;
const NODE_H = 72;
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 2;

interface Props {
  nodes: CanvasNode[];
  edges: CanvasEdge[];
  onNodesChange: (nodes: CanvasNode[]) => void;
  onEdgesChange: (edges: CanvasEdge[]) => void;
}

export function WorkflowCanvas({ nodes, edges, onNodesChange, onEdgesChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<{ id: string; offsetX: number; offsetY: number } | null>(null);
  const [connecting, setConnecting] = useState<{ fromId: string; mx: number; my: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState<{ startX: number; startY: number; panX: number; panY: number } | null>(null);

  const getNodeCenter = (node: CanvasNode) => ({ x: node.x + NODE_W / 2, y: node.y + NODE_H / 2 });

  const toCanvasCoords = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: clientX, y: clientY };
    return {
      x: (clientX - rect.left - pan.x) / zoom,
      y: (clientY - rect.top - pan.y) / zoom,
    };
  }, [zoom, pan]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * delta));

    // Zoom toward mouse position
    const scale = newZoom / zoom;
    setPan(prev => ({
      x: mouseX - scale * (mouseX - prev.x),
      y: mouseY - scale * (mouseY - prev.y),
    }));
    setZoom(newZoom);
  }, [zoom]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (panning) {
      setPan({
        x: panning.panX + (e.clientX - panning.startX),
        y: panning.panY + (e.clientY - panning.startY),
      });
      return;
    }
    if (dragging) {
      const local = toCanvasCoords(e.clientX, e.clientY);
      onNodesChange(nodes.map(n => n.id === dragging.id ? { ...n, x: Math.max(0, local.x - dragging.offsetX), y: Math.max(0, local.y - dragging.offsetY) } : n));
    }
    if (connecting) {
      const local = toCanvasCoords(e.clientX, e.clientY);
      setConnecting({ ...connecting, mx: local.x, my: local.y });
    }
  }, [dragging, connecting, panning, nodes, onNodesChange, toCanvasCoords]);

  const handleMouseUp = useCallback((e: React.MouseEvent) => {
    if (panning) { setPanning(null); return; }
    if (connecting) {
      const local = toCanvasCoords(e.clientX, e.clientY);
      const target = nodes.find(n => local.x >= n.x && local.x <= n.x + NODE_W && local.y >= n.y && local.y <= n.y + NODE_H);
      if (target && target.id !== connecting.fromId) {
        const exists = edges.some(ed => ed.from === connecting.fromId && ed.to === target.id);
        if (!exists) {
          onEdgesChange([...edges, { from: connecting.fromId, to: target.id }]);
        }
      }
      setConnecting(null);
    }
    setDragging(null);
  }, [connecting, panning, nodes, edges, onEdgesChange, toCanvasCoords]);

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    // Middle-click or space-click for panning; also left-click on empty space
    if (e.button === 1 || e.altKey) {
      e.preventDefault();
      setPanning({ startX: e.clientX, startY: e.clientY, panX: pan.x, panY: pan.y });
    }
  }, [pan]);

  const removeEdge = (from: string, to: string) => {
    onEdgesChange(edges.filter(e => !(e.from === from && e.to === to)));
  };

  const removeNode = (id: string) => {
    onNodesChange(nodes.filter(n => n.id !== id));
    onEdgesChange(edges.filter(e => e.from !== id && e.to !== id));
  };

  const addNode = (type: string) => {
    const role = NODE_ROLES.find(r => r.type === type);
    if (!role) return;
    const id = `node-${Date.now()}`;
    // Place in the visible area accounting for pan/zoom
    const x = (-pan.x / zoom) + 40 + Math.random() * 300;
    const y = (-pan.y / zoom) + 40 + Math.random() * 200;
    onNodesChange([...nodes, { id, type, label: role.label, x, y }]);
    toast.success(`Node ${role.label} adicionado`);
  };

  const resetView = () => { setZoom(1); setPan({ x: 0, y: 0 }); };

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {NODE_ROLES.map(role => (
          <Button key={role.type} variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => addNode(role.type)}>
            <role.icon className="h-3.5 w-3.5" style={{ color: role.color }} />
            {role.label}
          </Button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * 1.2))}><ZoomIn className="h-3.5 w-3.5" /></Button>
          <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setZoom(z => Math.max(MIN_ZOOM, z / 1.2))}><ZoomOut className="h-3.5 w-3.5" /></Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={resetView}><Maximize className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        className="relative rounded-xl border border-border bg-muted/20 overflow-hidden select-none"
        style={{ height: 480, cursor: panning ? 'grabbing' : 'default' }}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseDown={handleCanvasMouseDown}
        onMouseLeave={() => { setDragging(null); setConnecting(null); setPanning(null); }}
        onWheel={handleWheel}
      >
        {/* Grid pattern */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width={24 * zoom} height={24 * zoom} patternUnits="userSpaceOnUse" x={pan.x % (24 * zoom)} y={pan.y % (24 * zoom)}>
              <path d={`M ${24 * zoom} 0 L 0 0 0 ${24 * zoom}`} fill="none" stroke="hsl(var(--border))" strokeWidth="0.5" opacity="0.4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Transformed layer */}
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', inset: 0 }}>
          {/* SVG edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ overflow: 'visible' }} xmlns="http://www.w3.org/2000/svg">
            <defs>
              <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" opacity="0.7" />
              </marker>
            </defs>
            {edges.map((edge, i) => {
              const fromNode = nodes.find(n => n.id === edge.from);
              const toNode = nodes.find(n => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const from = getNodeCenter(fromNode);
              const to = getNodeCenter(toNode);
              const dx = to.x - from.x;
              const cx1 = from.x + dx * 0.4;
              const cx2 = to.x - dx * 0.4;
              return (
                <path
                  key={i}
                  d={`M ${from.x} ${from.y} C ${cx1} ${from.y}, ${cx2} ${to.y}, ${to.x} ${to.y}`}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  opacity="0.5"
                  markerEnd="url(#arrowhead)"
                  className="pointer-events-auto cursor-pointer hover:opacity-100"
                  strokeDasharray="6 3"
                  onClick={() => removeEdge(edge.from, edge.to)}
                />
              );
            })}
            {connecting && (() => {
              const fromNode = nodes.find(n => n.id === connecting.fromId);
              if (!fromNode) return null;
              const from = getNodeCenter(fromNode);
              return <line x1={from.x} y1={from.y} x2={connecting.mx} y2={connecting.my} stroke="hsl(var(--primary))" strokeWidth="2" strokeDasharray="4 4" opacity="0.6" />;
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map(node => {
            const role = NODE_ROLES.find(r => r.type === node.type);
            const Icon = role?.icon || Brain;
            const color = role?.color || 'hsl(var(--primary))';
            return (
              <div
                key={node.id}
                className="absolute rounded-xl border border-border bg-card shadow-lg cursor-grab active:cursor-grabbing transition-shadow hover:shadow-xl hover:border-primary/40 group"
                style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  const local = toCanvasCoords(e.clientX, e.clientY);
                  setDragging({ id: node.id, offsetX: local.x - node.x, offsetY: local.y - node.y });
                }}
              >
                <div className="flex items-center gap-2 px-3 py-2 h-full">
                  <GripVertical className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}20` }}>
                    <Icon className="h-4 w-4" style={{ color }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-foreground truncate">{node.label}</p>
                    <p className="text-[9px] text-muted-foreground">{node.type}</p>
                  </div>
                  {/* Connect handle */}
                  <div
                    className="absolute -right-2 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full bg-primary border-2 border-background cursor-crosshair hover:scale-125 transition-transform z-10"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      const local = toCanvasCoords(e.clientX, e.clientY);
                      setConnecting({ fromId: node.id, mx: local.x, my: local.y });
                    }}
                  />
                  {/* Delete */}
                  <button
                    className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    onMouseDown={(e) => { e.stopPropagation(); removeNode(node.id); }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {nodes.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-sm">
            Clique nos botões acima para adicionar nodes ao canvas
          </div>
        )}
      </div>
      <p className="text-[10px] text-muted-foreground">
        Arraste nodes para posicionar • Ponto azul para conectar • Clique na linha para remover • Scroll para zoom • Alt+arraste para pan
      </p>
    </div>
  );
}
