/**
 * Nexus Agents Studio — Workflow Store (Zustand)
 * Manages React Flow state: nodes, edges, selection, execution.
 */

import { create } from 'zustand';

interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
}

interface WorkflowState {
  // Workflow metadata
  workflowId: string | null;
  workflowName: string;
  isDirty: boolean;

  // React Flow state
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  selectedNodeId: string | null;

  // Execution state
  isExecuting: boolean;
  executingNodeId: string | null;
  executionResults: Record<string, unknown>;

  // Actions
  setWorkflow: (id: string, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, data: Partial<WorkflowNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  selectNode: (id: string | null) => void;
  setExecuting: (nodeId: string | null) => void;
  setExecutionResult: (nodeId: string, result: unknown) => void;
  markClean: () => void;
  reset: () => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  workflowId: null,
  workflowName: 'Novo Workflow',
  isDirty: false,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  isExecuting: false,
  executingNodeId: null,
  executionResults: {},

  setWorkflow: (id, name, nodes, edges) =>
    set({ workflowId: id, workflowName: name, nodes, edges, isDirty: false, executionResults: {} }),

  addNode: (node) =>
    set((s) => ({ nodes: [...s.nodes, node], isDirty: true })),

  updateNode: (id, data) =>
    set((s) => ({
      nodes: s.nodes.map(n => n.id === id ? { ...n, ...data } : n),
      isDirty: true,
    })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter(n => n.id !== id),
      edges: s.edges.filter(e => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
      isDirty: true,
    })),

  addEdge: (edge) =>
    set((s) => ({ edges: [...s.edges, edge], isDirty: true })),

  removeEdge: (id) =>
    set((s) => ({ edges: s.edges.filter(e => e.id !== id), isDirty: true })),

  setNodes: (nodes) => set({ nodes, isDirty: true }),
  setEdges: (edges) => set({ edges, isDirty: true }),

  selectNode: (id) => set({ selectedNodeId: id }),

  setExecuting: (nodeId) =>
    set({ isExecuting: !!nodeId, executingNodeId: nodeId }),

  setExecutionResult: (nodeId, result) =>
    set((s) => ({
      executionResults: { ...s.executionResults, [nodeId]: result },
    })),

  markClean: () => set({ isDirty: false }),

  reset: () => set({
    workflowId: null,
    workflowName: 'Novo Workflow',
    isDirty: false,
    nodes: [],
    edges: [],
    selectedNodeId: null,
    isExecuting: false,
    executingNodeId: null,
    executionResults: {},
  }),
}));
