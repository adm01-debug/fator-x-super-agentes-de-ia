/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Workflow Canvas (React Flow)
 * ═══════════════════════════════════════════════════════════════
 * Visual drag-and-drop workflow builder.
 * Uses semantic design tokens instead of hardcoded colors.
 */

import { useState, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { NODE_TYPES, NODE_CATEGORIES, NODE_DEFAULTS, type NodeType, type WorkflowNodeData } from './nodes';

// ═══ Custom Node Component ═══
function WorkflowNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  const nodeInfo = NODE_TYPES[data.type];
  const statusStyles = {
    idle: 'border-border',
    running: 'border-primary animate-pulse',
    success: 'border-nexus-emerald',
    error: 'border-destructive',
  };

  return (
    <div
      className={`
        bg-card rounded-xl border-2 px-4 py-3 min-w-[200px] max-w-[280px]
        transition-all duration-200 shadow-lg
        ${selected ? 'border-primary shadow-[0_0_20px_hsl(var(--primary)/0.3)]' : statusStyles[data.status || 'idle']}
      `}
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{nodeInfo.icon}</span>
        <span className="text-sm font-semibold text-foreground truncate">{data.label || nodeInfo.label}</span>
      </div>

      <div className="flex items-center gap-2">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${nodeInfo.color}22`, color: nodeInfo.color }}
        >
          {nodeInfo.label}
        </span>
        {data.status === 'running' && (
          <span className="text-[10px] text-primary animate-pulse">Executando...</span>
        )}
        {data.status === 'success' && (
          <span className="text-[10px] text-nexus-emerald">✓ Concluído</span>
        )}
        {data.status === 'error' && (
          <span className="text-[10px] text-destructive">✗ Erro</span>
        )}
      </div>

      {data.type !== 'start' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-2 border-primary rounded-full cursor-pointer hover:bg-primary transition-colors" />
      )}

      {data.type === 'condition' ? (
        <>
          <div className="absolute -bottom-2 left-1/3 -translate-x-1/2 w-4 h-4 bg-card border-2 border-nexus-emerald rounded-full cursor-pointer hover:bg-nexus-emerald transition-colors" title="Sim" />
          <div className="absolute -bottom-2 left-2/3 -translate-x-1/2 w-4 h-4 bg-card border-2 border-destructive rounded-full cursor-pointer hover:bg-destructive transition-colors" title="Não" />
        </>
      ) : data.type !== 'output' ? (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-card border-2 border-nexus-emerald rounded-full cursor-pointer hover:bg-nexus-emerald transition-colors" />
      ) : null}
    </div>
  );
}

// ═══ Node Palette (Sidebar) ═══
function NodePalette({ onAddNode }: { onAddNode: (type: NodeType) => void }) {
  return (
    <div className="w-64 bg-background border-r border-border p-4 overflow-y-auto">
      <h3 className="text-sm font-bold text-foreground mb-4">Blocos Disponíveis</h3>
      {NODE_CATEGORIES.map(cat => (
        <div key={cat.id} className="mb-4">
          <h4 className="text-xs text-muted-foreground uppercase tracking-wider mb-2">{cat.label}</h4>
          <div className="space-y-1">
            {cat.nodes.map(nodeType => {
              const info = NODE_TYPES[nodeType as NodeType];
              return (
                <button
                  key={nodeType}
                  onClick={() => onAddNode(nodeType as NodeType)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-card hover:bg-secondary border border-transparent hover:border-border transition-all text-left group"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('nodeType', nodeType)}
                >
                  <span className="text-base">{info.icon}</span>
                  <span className="text-xs text-muted-foreground group-hover:text-foreground">{info.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══ Toolbar ═══
function WorkflowToolbar({
  name,
  isDirty,
  isExecuting,
  onSave,
  onExecute,
  onClear,
}: {
  name: string;
  isDirty: boolean;
  isExecuting: boolean;
  onSave: () => void;
  onExecute: () => void;
  onClear: () => void;
}) {
  return (
    <div className="h-14 bg-background border-b border-border flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">🔀</span>
        <h2 className="text-base font-bold text-foreground">{name}</h2>
        {isDirty && <span className="text-xs text-nexus-amber">● Não salvo</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-secondary transition-colors"
        >
          Limpar
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty}
          className="px-3 py-1.5 text-xs text-foreground bg-secondary rounded-lg hover:bg-secondary/80 disabled:opacity-50 transition-colors"
        >
          💾 Salvar
        </button>
        <button
          onClick={onExecute}
          disabled={isExecuting}
          className="px-4 py-1.5 text-xs text-primary-foreground nexus-gradient-bg rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {isExecuting ? '⏳ Executando...' : '▶️ Executar'}
        </button>
      </div>
    </div>
  );
}

// ═══ Main Canvas ═══
export function WorkflowCanvas() {
  const store = useWorkflowStore();
  const canvasRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);

  const addNode = useCallback((type: NodeType) => {
    const nodeInfo = NODE_TYPES[type];
    const newNode = {
      id: `node_${crypto.randomUUID().slice(0, 8)}`,
      type,
      position: {
        x: 300 + Math.random() * 200,
        y: 100 + store.nodes.length * 120,
      },
      data: {
        label: nodeInfo.label,
        type,
        config: { ...NODE_DEFAULTS[type] },
        status: 'idle' as const,
      },
    };
    store.addNode(newNode);
  }, [store]);

  const handleSave = useCallback(async () => {
    store.markClean();
  }, [store]);

  const handleExecute = useCallback(async () => {
    if (store.nodes.length === 0) return;
    store.setExecuting(store.nodes[0]?.id || null);
    setTimeout(() => store.setExecuting(null), 2000);
  }, [store]);

  const handleClear = useCallback(() => {
    store.reset();
  }, [store]);

  return (
    <div className="flex flex-col h-full bg-background">
      <WorkflowToolbar
        name={store.workflowName}
        isDirty={store.isDirty}
        isExecuting={store.isExecuting}
        onSave={handleSave}
        onExecute={handleExecute}
        onClear={handleClear}
      />

      <div className="flex flex-1 overflow-hidden">
        <NodePalette onAddNode={addNode} />

        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-background"
          style={{
            backgroundImage: `radial-gradient(circle, hsl(var(--border)) 1px, transparent 1px)`,
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            const type = e.dataTransfer.getData('nodeType') as NodeType;
            if (type && NODE_TYPES[type]) {
              const rect = canvasRef.current?.getBoundingClientRect();
              const x = (e.clientX - (rect?.left || 0)) / zoom;
              const y = (e.clientY - (rect?.top || 0)) / zoom;
              const nodeInfo = NODE_TYPES[type];
              store.addNode({
                id: `node_${crypto.randomUUID().slice(0, 8)}`,
                type,
                position: { x, y },
                data: { label: nodeInfo.label, type, config: { ...NODE_DEFAULTS[type] }, status: 'idle' },
              });
            }
          }}
        >
          {store.nodes.map(node => (
            <div
              key={node.id}
              className="absolute cursor-move"
              style={{
                left: node.position.x * zoom,
                top: node.position.y * zoom,
                transform: `scale(${zoom})`,
                transformOrigin: 'top left',
              }}
              onClick={() => store.selectNode(node.id)}
            >
              <WorkflowNode
                data={node.data as unknown as WorkflowNodeData}
                selected={store.selectedNodeId === node.id}
              />
            </div>
          ))}

          {store.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">🔀</div>
                <h3 className="text-lg font-bold text-foreground mb-2">Canvas Vazio</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Arraste blocos da barra lateral ou clique para adicionar.
                  Conecte-os para criar seu workflow.
                </p>
              </div>
            </div>
          )}

          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-card border border-border rounded-lg px-3 py-2 shadow-md">
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="text-muted-foreground hover:text-foreground transition-colors">−</button>
            <span className="text-xs text-muted-foreground w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="text-muted-foreground hover:text-foreground transition-colors">+</button>
            <button onClick={() => setZoom(1)} className="text-xs text-primary ml-1 hover:underline">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowCanvas;

// ═══ Backwards-compatible type exports ═══
export type CanvasNode = {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
};

export type CanvasEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
};
