/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Workflow Canvas (React Flow)
 * ═══════════════════════════════════════════════════════════════
 * Visual drag-and-drop workflow builder.
 * Reference: React Flow Pro "AI Workflow Editor" template
 */

import { useState, useCallback, useRef } from 'react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { NODE_TYPES, NODE_CATEGORIES, NODE_DEFAULTS, type NodeType, type WorkflowNodeData } from './nodes';

// ═══ Custom Node Component ═══
function WorkflowNode({ data, selected }: { data: WorkflowNodeData; selected: boolean }) {
  const nodeInfo = NODE_TYPES[data.type];
  const statusColors = {
    idle: 'border-[#222244]',
    running: 'border-[#4D96FF] animate-pulse',
    success: 'border-[#6BCB77]',
    error: 'border-[#FF6B6B]',
  };

  return (
    <div
      className={`
        bg-[#111122] rounded-xl border-2 px-4 py-3 min-w-[200px] max-w-[280px]
        transition-all duration-200 shadow-lg
        ${selected ? 'border-[#4D96FF] shadow-[0_0_20px_rgba(77,150,255,0.3)]' : statusColors[data.status || 'idle']}
      `}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <span className="text-lg">{nodeInfo.icon}</span>
        <span className="text-sm font-semibold text-white truncate">{data.label || nodeInfo.label}</span>
      </div>

      {/* Type badge */}
      <div className="flex items-center gap-2">
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{ backgroundColor: `${nodeInfo.color}22`, color: nodeInfo.color }}
        >
          {nodeInfo.label}
        </span>
        {data.status === 'running' && (
          <span className="text-[10px] text-[#4D96FF] animate-pulse">Executando...</span>
        )}
        {data.status === 'success' && (
          <span className="text-[10px] text-[#6BCB77]">✓ Concluído</span>
        )}
        {data.status === 'error' && (
          <span className="text-[10px] text-[#FF6B6B]">✗ Erro</span>
        )}
      </div>

      {/* Input handle (top) */}
      {data.type !== 'start' && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#222244] border-2 border-[#4D96FF] rounded-full cursor-pointer hover:bg-[#4D96FF] transition-colors" />
      )}

      {/* Output handle(s) (bottom) */}
      {data.type === 'condition' ? (
        <>
          <div className="absolute -bottom-2 left-1/3 -translate-x-1/2 w-4 h-4 bg-[#222244] border-2 border-[#6BCB77] rounded-full cursor-pointer hover:bg-[#6BCB77] transition-colors" title="Sim" />
          <div className="absolute -bottom-2 left-2/3 -translate-x-1/2 w-4 h-4 bg-[#222244] border-2 border-[#FF6B6B] rounded-full cursor-pointer hover:bg-[#FF6B6B] transition-colors" title="Não" />
        </>
      ) : data.type !== 'output' ? (
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-[#222244] border-2 border-[#6BCB77] rounded-full cursor-pointer hover:bg-[#6BCB77] transition-colors" />
      ) : null}
    </div>
  );
}

// ═══ Node Palette (Sidebar) ═══
function NodePalette({ onAddNode }: { onAddNode: (type: NodeType) => void }) {
  return (
    <div className="w-64 bg-[#0a0a1a] border-r border-[#222244] p-4 overflow-y-auto">
      <h3 className="text-sm font-bold text-white mb-4">Blocos Disponíveis</h3>
      {NODE_CATEGORIES.map(cat => (
        <div key={cat.id} className="mb-4">
          <h4 className="text-xs text-[#888888] uppercase tracking-wider mb-2">{cat.label}</h4>
          <div className="space-y-1">
            {cat.nodes.map(nodeType => {
              const info = NODE_TYPES[nodeType as NodeType];
              return (
                <button
                  key={nodeType}
                  onClick={() => onAddNode(nodeType as NodeType)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#111122] hover:bg-[#16162a] border border-transparent hover:border-[#222244] transition-all text-left group"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('nodeType', nodeType)}
                >
                  <span className="text-base">{info.icon}</span>
                  <span className="text-xs text-[#E0E0E0] group-hover:text-white">{info.label}</span>
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
    <div className="h-14 bg-[#0a0a1a] border-b border-[#222244] flex items-center justify-between px-4">
      <div className="flex items-center gap-3">
        <span className="text-lg">🔀</span>
        <h2 className="text-base font-bold text-white">{name}</h2>
        {isDirty && <span className="text-xs text-[#FFD93D]">● Não salvo</span>}
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onClear}
          className="px-3 py-1.5 text-xs text-[#888888] hover:text-white border border-[#222244] rounded-lg hover:border-[#444466] transition-colors"
        >
          Limpar
        </button>
        <button
          onClick={onSave}
          disabled={!isDirty}
          className="px-3 py-1.5 text-xs text-white bg-[#222244] rounded-lg hover:bg-[#333355] disabled:opacity-50 transition-colors"
        >
          💾 Salvar
        </button>
        <button
          onClick={onExecute}
          disabled={isExecuting}
          className="px-4 py-1.5 text-xs text-white bg-gradient-to-r from-[#4D96FF] to-[#6BCB77] rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
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
    // Will be connected to workflowsService.saveWorkflow()
    store.markClean();
  }, [store]);

  const handleExecute = useCallback(async () => {
    if (store.nodes.length === 0) return;
    store.setExecuting(store.nodes[0]?.id || null);
    // Will be connected to workflow-engine-v2 Edge Function
    setTimeout(() => store.setExecuting(null), 2000);
  }, [store]);

  const handleClear = useCallback(() => {
    store.reset();
  }, [store]);

  return (
    <div className="flex flex-col h-full bg-[#080816]">
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

        {/* Canvas Area */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto bg-[#080816]"
          style={{
            backgroundImage: `radial-gradient(circle, #222244 1px, transparent 1px)`,
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
          {/* Render nodes */}
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
                data={node.data as WorkflowNodeData}
                selected={store.selectedNodeId === node.id}
              />
            </div>
          ))}

          {/* Empty state */}
          {store.nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-5xl mb-4">🔀</div>
                <h3 className="text-lg font-bold text-white mb-2">Canvas Vazio</h3>
                <p className="text-sm text-[#888888] max-w-md">
                  Arraste blocos da barra lateral ou clique para adicionar.
                  Conecte-os para criar seu workflow.
                </p>
              </div>
            </div>
          )}

          {/* Minimap */}
          <div className="absolute bottom-4 right-4 flex items-center gap-2 bg-[#111122] border border-[#222244] rounded-lg px-3 py-2">
            <button onClick={() => setZoom(z => Math.max(0.25, z - 0.1))} className="text-[#888888] hover:text-white">−</button>
            <span className="text-xs text-[#888888] w-12 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="text-[#888888] hover:text-white">+</button>
            <button onClick={() => setZoom(1)} className="text-xs text-[#4D96FF] ml-1">Reset</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WorkflowCanvas;

// ═══ Backwards-compatible type exports ═══
// WorkflowsPage.tsx uses these types
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
