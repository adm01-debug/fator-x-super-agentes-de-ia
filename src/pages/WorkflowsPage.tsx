import { useState, useRef, useCallback } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import { Button } from "@/components/ui/button";
import { Plus, GitBranch, ArrowRight, Save, Trash2, GripVertical, List, LayoutDashboard, Info, X, Undo2, Redo2, ZoomIn, ZoomOut, Maximize } from "lucide-react";
import { toast } from "sonner";
import * as workflowEngine from "@/services/workflowEngine";

// ═══ TYPES ═══

interface CanvasNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
}

interface CanvasConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface Pipeline {
  id: string;
  name: string;
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  createdAt: string;
}

// ═══ NODE DEFINITIONS ═══

export const NODE_TYPES = [
  { type: 'planner', label: 'Planner', icon: '🧭', color: 'from-indigo-500/20 to-indigo-500/5 border-indigo-500/30', desc: 'Planeja a estratégia e decompõe tarefas' },
  { type: 'researcher', label: 'Researcher', icon: '🔍', color: 'from-purple-500/20 to-purple-500/5 border-purple-500/30', desc: 'Busca informações e dados relevantes' },
  { type: 'retriever', label: 'Retriever', icon: '📄', color: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30', desc: 'Recupera documentos e conhecimento do RAG' },
  { type: 'critic', label: 'Critic', icon: '🟠', color: 'from-amber-500/20 to-amber-500/5 border-amber-500/30', desc: 'Avalia qualidade e identifica problemas' },
  { type: 'executor', label: 'Executor', icon: '🔧', color: 'from-rose-500/20 to-rose-500/5 border-rose-500/30', desc: 'Executa ações e gera output final' },
  { type: 'validator', label: 'Validator', icon: '✅', color: 'from-teal-500/20 to-teal-500/5 border-teal-500/30', desc: 'Valida resultados contra regras de negócio' },
  { type: 'human', label: 'Human Gate', icon: '👤', color: 'from-sky-500/20 to-sky-500/5 border-sky-500/30', desc: 'Checkpoint para aprovação humana' },
  { type: 'router', label: 'Router', icon: '🔀', color: 'from-orange-500/20 to-orange-500/5 border-orange-500/30', desc: 'Roteamento condicional entre caminhos' },
];

// ═══ TEMPLATES ═══

export const TEMPLATES: Pipeline[] = [
  {
    id: 'tpl-1', name: 'Atendimento ao Cliente', createdAt: '',
    nodes: [
      { id: 'n1', type: 'planner', label: 'Classificar', x: 80, y: 200 },
      { id: 'n2', type: 'retriever', label: 'Buscar KB', x: 300, y: 120 },
      { id: 'n3', type: 'researcher', label: 'Pesquisar', x: 300, y: 300 },
      { id: 'n4', type: 'executor', label: 'Responder', x: 540, y: 200 },
      { id: 'n5', type: 'critic', label: 'Revisar', x: 760, y: 200 },
    ],
    connections: [
      { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2' },
      { id: 'c2', fromNodeId: 'n1', toNodeId: 'n3' },
      { id: 'c3', fromNodeId: 'n2', toNodeId: 'n4' },
      { id: 'c4', fromNodeId: 'n3', toNodeId: 'n4' },
      { id: 'c5', fromNodeId: 'n4', toNodeId: 'n5' },
    ],
  },
  {
    id: 'tpl-2', name: 'Research Pipeline', createdAt: '',
    nodes: [
      { id: 'n1', type: 'planner', label: 'Planner', x: 80, y: 220 },
      { id: 'n2', type: 'researcher', label: 'Researcher', x: 300, y: 120 },
      { id: 'n3', type: 'retriever', label: 'Retriever', x: 300, y: 320 },
      { id: 'n4', type: 'critic', label: 'Critic', x: 540, y: 220 },
      { id: 'n5', type: 'executor', label: 'Executor', x: 760, y: 220 },
    ],
    connections: [
      { id: 'c1', fromNodeId: 'n1', toNodeId: 'n2' },
      { id: 'c2', fromNodeId: 'n1', toNodeId: 'n3' },
      { id: 'c3', fromNodeId: 'n2', toNodeId: 'n4' },
      { id: 'c4', fromNodeId: 'n3', toNodeId: 'n4' },
      { id: 'c5', fromNodeId: 'n4', toNodeId: 'n5' },
    ],
  },
];

// ═══ CANVAS COMPONENT ═══

function WorkflowCanvas({
  nodes, connections, onNodesChange, onConnectionsChange,
}: {
  nodes: CanvasNode[];
  connections: CanvasConnection[];
  onNodesChange: (nodes: CanvasNode[]) => void;
  onConnectionsChange: (connections: CanvasConnection[]) => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [hasDragged, setHasDragged] = useState(false);
  const [connecting, setConnecting] = useState<{ fromNodeId: string } | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  const NODE_W = 160;
  const NODE_H = 70;
  const CANVAS_MAX_W = 1400;
  const CANVAS_H = 520;

  // Drag node
  const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
    if ((e.target as HTMLElement).closest('.connector-point')) return;
    e.preventDefault();
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    setDragOffset({ x: e.clientX - rect.left - node.x, y: e.clientY - rect.top - node.y });
    setDraggingNode(nodeId);
    setHasDragged(false);
  }, [nodes]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (draggingNode) {
      setHasDragged(true);
      const clampedX = Math.max(0, Math.min(mx - dragOffset.x, rect.width - NODE_W));
      const clampedY = Math.max(0, Math.min(my - dragOffset.y, CANVAS_H - NODE_H));
      const updated = nodes.map(n =>
        n.id === draggingNode ? { ...n, x: clampedX, y: clampedY } : n
      );
      onNodesChange(updated);
    } else if (connecting) {
      setMousePos({ x: mx, y: my });
    }
  }, [draggingNode, connecting, dragOffset, nodes, onNodesChange]);

  const handleMouseUp = useCallback(() => {
    setDraggingNode(null);
    // Don't clear connecting on mouseUp — user needs to click target node
  }, []);

  // Start connection from connector point (click, not drag)
  const handleConnectorClick = useCallback((e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (connecting) {
      // Cancel current connecting
      setConnecting(null);
      return;
    }
    setConnecting({ fromNodeId: nodeId });
    toast.info('Clique em outro node para conectar (ou clique no canvas para cancelar)');
  }, [connecting]);

  // Complete connection on node click while connecting
  const handleNodeClick = useCallback((nodeId: string) => {
    // Ignore click after drag
    if (hasDragged) return;

    if (connecting && connecting.fromNodeId !== nodeId) {
      const exists = connections.some(
        c => c.fromNodeId === connecting.fromNodeId && c.toNodeId === nodeId
      );
      if (!exists) {
        onConnectionsChange([...connections, {
          id: `conn-${Date.now()}`,
          fromNodeId: connecting.fromNodeId,
          toNodeId: nodeId,
        }]);
        toast.success('Conexão criada');
      }
      setConnecting(null);
    }
  }, [connecting, connections, onConnectionsChange, hasDragged]);

  // Cancel connecting on canvas click
  const handleCanvasClick = useCallback(() => {
    if (connecting) { setConnecting(null); toast.info('Conexão cancelada'); }
  }, [connecting]);

  // Remove connection on click
  const handleConnectionClick = useCallback((connId: string) => {
    onConnectionsChange(connections.filter(c => c.id !== connId));
    toast.info('Conexão removida');
  }, [connections, onConnectionsChange]);

  // Remove node
  const handleDeleteNode = useCallback((nodeId: string) => {
    onNodesChange(nodes.filter(n => n.id !== nodeId));
    onConnectionsChange(connections.filter(c => c.fromNodeId !== nodeId && c.toNodeId !== nodeId));
    toast.info('Node removido');
  }, [nodes, connections, onNodesChange, onConnectionsChange]);

  // Get node center for connection lines
  const getNodeConnectorOut = (nodeId: string) => {
    const n = nodes.find(nd => nd.id === nodeId);
    if (!n) return { x: 0, y: 0 };
    return { x: n.x + NODE_W, y: n.y + NODE_H / 2 };
  };
  const getNodeConnectorIn = (nodeId: string) => {
    const n = nodes.find(nd => nd.id === nodeId);
    if (!n) return { x: 0, y: 0 };
    return { x: n.x, y: n.y + NODE_H / 2 };
  };

  return (
    <div
      ref={canvasRef}
      className={`relative w-full h-[520px] rounded-2xl border bg-card/30 overflow-hidden select-none ${connecting ? 'border-primary/40 cursor-crosshair' : 'border-border/50'}`}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleCanvasClick}
    >
      {/* SVG layer for connections */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {connections.map(conn => {
          const from = getNodeConnectorOut(conn.fromNodeId);
          const to = getNodeConnectorIn(conn.toNodeId);
          const midX = (from.x + to.x) / 2;
          return (
            <g key={conn.id} className="pointer-events-auto cursor-pointer" onClick={() => handleConnectionClick(conn.id)}>
              <path
                d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
                fill="none"
                stroke="hsl(var(--primary) / 0.4)"
                strokeWidth="2"
                strokeDasharray="8 4"
                className="transition-colors hover:stroke-primary"
              />
              {/* Invisible wider hit area */}
              <path
                d={`M ${from.x} ${from.y} C ${midX} ${from.y}, ${midX} ${to.y}, ${to.x} ${to.y}`}
                fill="none"
                stroke="transparent"
                strokeWidth="14"
              />
            </g>
          );
        })}
        {/* Active connecting line */}
        {connecting && (() => {
          const fromPos = getNodeConnectorOut(connecting.fromNodeId);
          return (
            <path
              d={`M ${fromPos.x} ${fromPos.y} C ${(fromPos.x + mousePos.x) / 2} ${fromPos.y}, ${(fromPos.x + mousePos.x) / 2} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
              fill="none"
              stroke="hsl(var(--primary) / 0.6)"
              strokeWidth="2"
              strokeDasharray="4 4"
              className="animate-pulse"
            />
          );
        })()}
      </svg>

      {/* Node layer */}
      {nodes.map(node => {
        const typeDef = NODE_TYPES.find(t => t.type === node.type);
        return (
          <div
            key={node.id}
            className={`group absolute flex items-center gap-2.5 px-3 py-2.5 rounded-xl border bg-gradient-to-br backdrop-blur-sm cursor-grab active:cursor-grabbing transition-shadow hover:shadow-lg hover:shadow-primary/5 ${typeDef?.color ?? 'border-border'} ${draggingNode === node.id ? 'ring-2 ring-primary shadow-xl z-20' : 'z-10'} ${connecting ? 'cursor-crosshair' : ''}`}
            style={{ left: node.x, top: node.y, width: NODE_W, height: NODE_H }}
            onMouseDown={e => handleNodeMouseDown(e, node.id)}
            onClick={() => handleNodeClick(node.id)}
          >
            {/* Grip handle */}
            <GripVertical className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            {/* Icon */}
            <span className="text-lg shrink-0">{typeDef?.icon ?? '🔹'}</span>
            {/* Label */}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{node.label}</p>
              <p className="text-[9px] text-muted-foreground truncate">{node.type}</p>
            </div>
            {/* Delete button */}
            <button
              className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30"
              onClick={e => { e.stopPropagation(); handleDeleteNode(node.id); }}
            >
              <X className="h-3 w-3" />
            </button>
            {/* Output connector (right side) */}
            <div
              className={`connector-point absolute -right-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full border-2 border-background cursor-crosshair z-30 hover:scale-150 transition-transform ${connecting?.fromNodeId === node.id ? 'bg-emerald-400 scale-150' : 'bg-primary'}`}
              onClick={e => handleConnectorClick(e, node.id)}
            />
            {/* Input connector (left side) */}
            <div className="absolute -left-[7px] top-1/2 -translate-y-1/2 h-3.5 w-3.5 rounded-full bg-primary/50 border-2 border-background z-30" />
          </div>
        );
      })}

      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-muted-foreground/40">
          <div className="text-center">
            <LayoutDashboard className="h-12 w-12 mx-auto mb-2" />
            <p className="text-sm">Arraste nodes do painel acima para começar</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══ MAIN PAGE ═══

export default function WorkflowsPage() {
  const [activeView, setActiveView] = useState<'canvas' | 'list'>('canvas');
  const [pipelineName, setPipelineName] = useState('Meu Pipeline');
  const [nodes, setNodes] = useState<CanvasNode[]>(TEMPLATES[1].nodes);
  const [connections, setConnections] = useState<CanvasConnection[]>(TEMPLATES[1].connections);
  const [savedPipelines, setSavedPipelines] = useState<Pipeline[]>(() => {
    try {
      const stored = localStorage.getItem('nexus_pipelines');
      return stored ? JSON.parse(stored) : [];
    } catch { return []; }
  });

  // Persist saved pipelines to localStorage
  const updateSavedPipelines = useCallback((updater: (prev: Pipeline[]) => Pipeline[]) => {
    setSavedPipelines(prev => {
      const next = updater(prev);
      try { localStorage.setItem('nexus_pipelines', JSON.stringify(next)); } catch { /* quota exceeded */ }
      return next;
    });
  }, []);

  // Undo/Redo history
  interface HistoryEntry { nodes: CanvasNode[]; connections: CanvasConnection[] }
  const [history, setHistory] = useState<HistoryEntry[]>([{ nodes: [...nodes], connections: [...connections] }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  const pushHistory = useCallback((newNodes: CanvasNode[], newConns: CanvasConnection[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, { nodes: newNodes.map(n => ({ ...n })), connections: newConns.map(c => ({ ...c })) }];
      if (next.length > 50) next.shift(); // Limit to 50 entries
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, 49));
  }, [historyIndex]);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const prev = history[historyIndex - 1];
    setNodes(prev.nodes.map(n => ({ ...n })));
    setConnections(prev.connections.map(c => ({ ...c })));
    setHistoryIndex(i => i - 1);
    toast.info('Undo');
  }, [historyIndex, history]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const next = history[historyIndex + 1];
    setNodes(next.nodes.map(n => ({ ...n })));
    setConnections(next.connections.map(c => ({ ...c })));
    setHistoryIndex(i => i + 1);
    toast.info('Redo');
  }, [historyIndex, history]);

  // Zoom state
  const [zoom, setZoom] = useState(1);
  const zoomIn = useCallback(() => setZoom(z => Math.min(z + 0.15, 2)), []);
  const zoomOut = useCallback(() => setZoom(z => Math.max(z - 0.15, 0.4)), []);
  const zoomReset = useCallback(() => setZoom(1), []);

  // Add node to canvas
  const addNode = useCallback((type: string) => {
    const typeDef = NODE_TYPES.find(t => t.type === type);
    if (!typeDef) return;
    const newNode: CanvasNode = {
      id: `node-${Date.now()}`,
      type,
      label: typeDef.label,
      x: 100 + Math.random() * 400,
      y: 80 + Math.random() * 300,
    };
    setNodes(prev => {
      const next = [...prev, newNode];
      pushHistory(next, connections);
      return next;
    });
    toast.success(`${typeDef.label} adicionado ao canvas`);
  }, [connections, pushHistory]);

  // Save pipeline
  const savePipeline = useCallback(() => {
    if (nodes.length === 0) { toast.error('Canvas vazio — adicione nodes antes de salvar'); return; }
    if (!pipelineName.trim()) { toast.error('Informe um nome para o pipeline'); return; }
    const pipeline: Pipeline = {
      id: `pipe-${Date.now()}`,
      name: pipelineName,
      nodes: [...nodes],
      connections: [...connections],
      createdAt: new Date().toLocaleString('pt-BR'),
    };
    updateSavedPipelines(prev => [...prev, pipeline]);
    toast.success(`Pipeline "${pipelineName}" salvo com ${nodes.length} nodes e ${connections.length} conexões`);
  }, [pipelineName, nodes, connections]);

  // Load pipeline
  const loadPipeline = useCallback((pipeline: Pipeline) => {
    setNodes([...pipeline.nodes]);
    setConnections([...pipeline.connections]);
    setPipelineName(pipeline.name);
    toast.success(`Pipeline "${pipeline.name}" carregado`);
    setActiveView('canvas');
  }, []);

  // Clear canvas
  const clearCanvas = useCallback(() => {
    if (nodes.length === 0) return;
    if (!confirm('Limpar o canvas? Nodes e conexões não salvos serão perdidos.')) return;
    setNodes([]);
    setConnections([]);
    toast.info('Canvas limpo');
  }, [nodes]);

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Workflow Studio"
        description="Crie fluxos de orquestração multi-agente com canvas visual drag-and-drop"
        actions={<Button className="nexus-gradient-bg text-primary-foreground gap-2 hover:opacity-90" onClick={() => {
          if (nodes.length > 0 && !confirm('Descartar canvas atual e criar novo pipeline?')) return;
          setActiveView('canvas'); setNodes([]); setConnections([]); setPipelineName('Novo Pipeline');
        }}><Plus className="h-4 w-4" /> Novo workflow</Button>}
      />

      {/* View toggle */}
      <div className="flex items-center gap-1 bg-secondary/50 border border-border/50 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveView('canvas')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'canvas' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <LayoutDashboard className="h-3.5 w-3.5" /> Canvas Visual
        </button>
        <button
          onClick={() => setActiveView('list')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${activeView === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <List className="h-3.5 w-3.5" /> Lista
        </button>
      </div>

      {activeView === 'canvas' && (
        <>
          {/* Info banner */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-start gap-2">
            <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-foreground">Canvas de Orquestração</p>
              <p className="text-[11px] text-muted-foreground">Arraste nodes para posicionar, conecte-os pelo ponto azul à direita. Clique numa linha para removê-la. Salve seu pipeline no banco de dados para reutilizá-lo.</p>
            </div>
          </div>

          {/* Pipeline name + save */}
          <div className="flex items-center gap-3 flex-wrap gap-y-2">
            <input
              value={pipelineName}
              onChange={e => setPipelineName(e.target.value)}
              className="bg-muted/30 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground w-56"
              placeholder="Nome do pipeline"
            />
            <Button onClick={savePipeline} className="gap-1.5"><Save className="h-4 w-4" /> Salvar</Button>
            <Button className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={nodes.length === 0} onClick={async () => {
              const input = prompt('Input inicial para o workflow:');
              if (!input) return;
              toast.info(`Executando workflow "${pipelineName}" com ${nodes.length} nodes...`);
              const result = await workflowEngine.executeWorkflow(
                pipelineName,
                nodes.map(n => ({ id: n.id, type: n.type, label: n.label })),
                connections.map(c => ({ id: c.id, fromNodeId: c.fromNodeId, toNodeId: c.toNodeId })),
                input,
                (nodeId, r) => toast.info(`${r.nodeLabel}: ${r.status} (${r.durationMs}ms)`)
              );
              toast.success(`Workflow ${result.status}: ${result.nodeResults.length} nodes, ${result.totalDurationMs}ms, $${result.totalCostUsd.toFixed(4)}`);
              if (result.finalOutput) alert(`Output final:\n\n${result.finalOutput.slice(0, 1000)}`);
            }}><GitBranch className="h-4 w-4" /> Executar</Button>
            <Button variant="outline" onClick={clearCanvas} className="gap-1.5"><Trash2 className="h-4 w-4" /> Limpar</Button>
            <div className="flex items-center gap-1 ml-auto">
              <Button variant="outline" size="sm" onClick={undo} disabled={historyIndex <= 0} title="Undo (Ctrl+Z)"><Undo2 className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" onClick={redo} disabled={historyIndex >= history.length - 1} title="Redo (Ctrl+Y)"><Redo2 className="h-3.5 w-3.5" /></Button>
              <span className="mx-2 text-border">|</span>
              <Button variant="outline" size="sm" onClick={zoomOut} title="Zoom out"><ZoomOut className="h-3.5 w-3.5" /></Button>
              <span className="text-[10px] text-muted-foreground w-10 text-center">{Math.round(zoom * 100)}%</span>
              <Button variant="outline" size="sm" onClick={zoomIn} title="Zoom in"><ZoomIn className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" onClick={zoomReset} title="Reset zoom"><Maximize className="h-3.5 w-3.5" /></Button>
              <span className="mx-2 text-border">|</span>
              <span className="text-[10px] text-muted-foreground">{nodes.length} nodes · {connections.length} conexões</span>
            </div>
          </div>

          {/* Node palette */}
          <div className="flex items-center gap-2 flex-wrap">
            {NODE_TYPES.map(nt => (
              <button
                key={nt.type}
                onClick={() => addNode(nt.type)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-card text-xs text-foreground hover:bg-muted/30 transition-colors"
                title={nt.desc}
              >
                <span>{nt.icon}</span> {nt.label}
              </button>
            ))}
          </div>

          {/* Canvas */}
          {/* Zoom wrapper */}
          <div className="overflow-auto rounded-2xl border border-border/30" style={{ maxHeight: 560 }}>
            <div style={{ transform: `scale(${zoom})`, transformOrigin: 'top left', width: `${100 / zoom}%` }}>
              <WorkflowCanvas
                nodes={nodes}
                connections={connections}
                onNodesChange={(newNodes) => { setNodes(newNodes); }}
                onConnectionsChange={(newConns) => {
                  setConnections(newConns);
                  pushHistory(nodes, newConns);
                }}
              />
            </div>
          </div>

          {/* Instructions */}
          <p className="text-[10px] text-muted-foreground text-center">
            Arraste nodes para posicionar &bull; Clique no ponto azul e arraste até outro node para conectar &bull; Clique em uma linha para remover conexão
          </p>

          {/* Templates */}
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground mb-2">Templates prontos:</h3>
            <div className="flex gap-2">
              {TEMPLATES.map(tpl => (
                <button
                  key={tpl.id}
                  onClick={() => loadPipeline(tpl)}
                  className="px-3 py-2 rounded-lg border border-border bg-card text-xs text-foreground hover:bg-muted/30 transition-colors"
                >
                  <GitBranch className="h-3 w-3 inline mr-1" /> {tpl.name} ({tpl.nodes.length} nodes)
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {activeView === 'list' && (
        <div className="space-y-4">
          {/* Saved pipelines */}
          {savedPipelines.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Pipelines Salvos</h3>
              <div className="grid gap-3 md:grid-cols-2">
                {savedPipelines.map(pipe => (
                  <div key={pipe.id} className="nexus-card cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => loadPipeline(pipe)}>
                    <div className="flex items-center gap-2.5 mb-2">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                        <GitBranch className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-foreground">{pipe.name}</h3>
                        <p className="text-[11px] text-muted-foreground">{pipe.nodes.length} nodes · {pipe.connections.length} conexões · {pipe.createdAt}</p>
                      </div>
                      <button className="p-1 rounded hover:bg-destructive/20 shrink-0" title="Excluir pipeline" onClick={e => {
                        e.stopPropagation();
                        if (!confirm(`Excluir pipeline "${pipe.name}"?`)) return;
                        updateSavedPipelines(prev => prev.filter(p => p.id !== pipe.id));
                        toast.info('Pipeline excluído');
                      }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></button>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {pipe.nodes.map(n => {
                        const typeDef = NODE_TYPES.find(t => t.type === n.type);
                        return <span key={n.id} className="text-[10px] px-1.5 py-0.5 rounded bg-muted/30 text-muted-foreground">{typeDef?.icon} {n.label}</span>;
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Templates */}
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-3">Templates</h3>
            <div className="grid gap-4 md:grid-cols-2">
              {TEMPLATES.map(tpl => (
                <div key={tpl.id} className="nexus-card cursor-pointer hover:ring-1 hover:ring-primary/30 transition-all" onClick={() => loadPipeline(tpl)}>
                  <div className="flex items-center gap-2.5 mb-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <GitBranch className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">{tpl.name}</h3>
                      <p className="text-[11px] text-muted-foreground">{tpl.nodes.length} nodes · {tpl.connections.length} conexões</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    {tpl.nodes.map((n, j) => {
                      const typeDef = NODE_TYPES.find(t => t.type === n.type);
                      return (
                        <div key={n.id} className="flex items-center gap-1.5 shrink-0">
                          <div className="flex flex-col items-center">
                            <div className="h-9 w-9 rounded-lg bg-secondary flex items-center justify-center text-sm">
                              {typeDef?.icon}
                            </div>
                            <p className="text-[9px] text-muted-foreground mt-0.5">{n.label}</p>
                          </div>
                          {j < tpl.nodes.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0 mt-[-10px]" />}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {savedPipelines.length === 0 && (
            <div className="nexus-card text-center py-12">
              <LayoutDashboard className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nenhum pipeline salvo</p>
              <p className="text-xs text-muted-foreground mt-1">Crie e salve pipelines no Canvas Visual</p>
              <Button variant="outline" className="mt-4" onClick={() => setActiveView('canvas')}>Ir para Canvas</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
