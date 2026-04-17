import { useCallback, useEffect, useMemo } from 'react';
import ReactFlow, {
  Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState,
  type Connection, type Edge, type Node, MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { GraphNode, GraphEdge } from '@/services/agentGraphService';

interface Props {
  nodes: GraphNode[];
  edges: GraphEdge[];
  entryNodeId: string | null;
  activeNodeId?: string | null;
  onChange: (nodes: GraphNode[], edges: GraphEdge[]) => void;
  onSelect: (nodeId: string | null) => void;
}

export function GraphCanvas({ nodes, edges, entryNodeId, activeNodeId, onChange, onSelect }: Props) {
  const rfNodes = useMemo<Node[]>(
    () => nodes.map(n => ({
      id: n.id,
      position: n.position ?? { x: 0, y: 0 },
      data: { label: n.label || n.role || 'Nó' },
      type: 'default',
      style: {
        background: n.id === activeNodeId ? 'hsl(var(--primary) / 0.3)' : 'hsl(var(--card))',
        color: 'hsl(var(--foreground))',
        border: n.id === entryNodeId ? '2px solid hsl(var(--primary))' : '1px solid hsl(var(--border))',
        borderRadius: 8, padding: 10, fontSize: 12, minWidth: 140,
        boxShadow: n.id === activeNodeId ? '0 0 0 4px hsl(var(--primary) / 0.2)' : undefined,
      },
    })),
    [nodes, entryNodeId, activeNodeId]
  );

  const rfEdges = useMemo<Edge[]>(
    () => edges.map((e, i) => ({
      id: e.id ?? `e-${i}-${e.from}-${e.to}`,
      source: e.from,
      target: e.to,
      label: e.condition,
      animated: true,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: 'hsl(var(--primary))', strokeWidth: 1.5 },
    })),
    [edges]
  );

  const [reactNodes, setReactNodes, onNodesChange] = useNodesState(rfNodes);
  const [reactEdges, setReactEdges, onEdgesChange] = useEdgesState(rfEdges);

  useEffect(() => { setReactNodes(rfNodes); }, [rfNodes, setReactNodes]);
  useEffect(() => { setReactEdges(rfEdges); }, [rfEdges, setReactEdges]);

  const onConnect = useCallback((c: Connection) => {
    if (!c.source || !c.target) return;
    const newEdges = [...edges, { from: c.source, to: c.target }];
    onChange(nodes, newEdges);
    setReactEdges(eds => addEdge(c, eds));
  }, [edges, nodes, onChange, setReactEdges]);

  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
    const positionChanges = changes.filter((c: any) => c.type === 'position' && c.position);
    if (positionChanges.length > 0) {
      const updatedNodes = nodes.map(n => {
        const pc = positionChanges.find((c: any) => c.id === n.id);
        return pc ? { ...n, position: pc.position } : n;
      });
      onChange(updatedNodes, edges);
    }
  }, [edges, nodes, onChange, onNodesChange]);

  return (
    <div className="h-full w-full rounded-lg border bg-muted/20">
      <ReactFlow
        nodes={reactNodes}
        edges={reactEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={(_, n) => onSelect(n.id)}
        onPaneClick={() => onSelect(null)}
        fitView
      >
        <Background color="hsl(var(--muted-foreground) / 0.15)" />
        <Controls />
        <MiniMap nodeColor={() => 'hsl(var(--primary))'} maskColor="hsl(var(--background) / 0.6)" />
      </ReactFlow>
    </div>
  );
}
