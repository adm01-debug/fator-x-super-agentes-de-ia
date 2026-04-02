/**
 * Graph Orchestration Engine — LangGraph-inspired state machine
 * Supports: cycles, conditional branching, parallel execution, checkpointing, HITL
 * Replaces sequential workflow engine as the core orchestration layer.
 */
import * as llm from './llmService';
import * as traceService from './traceService';
import { logger } from '@/lib/logger';

// ═══ CORE TYPES ═══

export interface GraphState {
  [key: string]: unknown;
  messages: { role: string; content: string }[];
  currentNode: string;
  iteration: number;
  status: 'running' | 'paused' | 'completed' | 'failed';
  checkpoint?: string;
}

export interface GraphNode {
  id: string;
  type: 'llm' | 'tool' | 'conditional' | 'parallel' | 'human' | 'subgraph' | 'custom';
  label: string;
  execute: (state: GraphState) => Promise<Partial<GraphState>>;
}

export interface ConditionalEdge {
  from: string;
  condition: (state: GraphState) => string; // Returns target node ID
}

export interface GraphEdge {
  from: string;
  to: string;
  condition?: (state: GraphState) => boolean;
}

export interface GraphConfig {
  nodes: Map<string, GraphNode>;
  edges: GraphEdge[];
  conditionalEdges: ConditionalEdge[];
  entryPoint: string;
  maxIterations: number;
  checkpointInterval: number;
  timeoutMs: number;
}

export interface GraphCheckpoint {
  id: string;
  graphId: string;
  state: GraphState;
  timestamp: string;
  nodeId: string;
  iteration: number;
}

export interface GraphResult {
  finalState: GraphState;
  nodesVisited: string[];
  iterations: number;
  durationMs: number;
  costUsd: number;
  checkpoints: GraphCheckpoint[];
  status: 'completed' | 'failed' | 'paused' | 'max_iterations';
}

// ═══ CHECKPOINT STORE ═══

const checkpointStore = new Map<string, GraphCheckpoint[]>();

export function saveCheckpoint(graphId: string, state: GraphState, nodeId: string): GraphCheckpoint {
  const cp: GraphCheckpoint = {
    id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    graphId, state: JSON.parse(JSON.stringify(state)),
    timestamp: new Date().toISOString(), nodeId, iteration: state.iteration,
  };
  if (!checkpointStore.has(graphId)) checkpointStore.set(graphId, []);
  checkpointStore.get(graphId)!.push(cp);
  return cp;
}

export function getCheckpoints(graphId: string): GraphCheckpoint[] {
  return checkpointStore.get(graphId) ?? [];
}

export function restoreCheckpoint(checkpointId: string): GraphState | null {
  for (const cps of checkpointStore.values()) {
    const cp = cps.find(c => c.id === checkpointId);
    if (cp) return JSON.parse(JSON.stringify(cp.state));
  }
  return null;
}

// ═══ HITL (Human-in-the-Loop) ═══

type HITLCallback = (state: GraphState, nodeId: string) => Promise<{ approved: boolean; modifiedState?: Partial<GraphState> }>;
let hitlCallback: HITLCallback | null = null;

export function setHITLCallback(callback: HITLCallback): void {
  hitlCallback = callback;
}

// ═══ GRAPH BUILDER ═══

export class StateGraph {
  private nodes = new Map<string, GraphNode>();
  private edges: GraphEdge[] = [];
  private conditionalEdges: ConditionalEdge[] = [];
  private entryPoint = '';
  private endNodes = new Set<string>();

  addNode(id: string, node: Omit<GraphNode, 'id'>): StateGraph {
    this.nodes.set(id, { ...node, id });
    return this;
  }

  addEdge(from: string, to: string, condition?: (state: GraphState) => boolean): StateGraph {
    this.edges.push({ from, to, condition });
    return this;
  }

  addConditionalEdge(from: string, condition: (state: GraphState) => string): StateGraph {
    this.conditionalEdges.push({ from, condition });
    return this;
  }

  setEntryPoint(nodeId: string): StateGraph {
    this.entryPoint = nodeId;
    return this;
  }

  setEndNode(nodeId: string): StateGraph {
    this.endNodes.add(nodeId);
    return this;
  }

  compile(options?: { maxIterations?: number; timeoutMs?: number; checkpointInterval?: number }): GraphConfig {
    return {
      nodes: this.nodes,
      edges: this.edges,
      conditionalEdges: this.conditionalEdges,
      entryPoint: this.entryPoint,
      maxIterations: options?.maxIterations ?? 25,
      checkpointInterval: options?.checkpointInterval ?? 5,
      timeoutMs: options?.timeoutMs ?? 120000,
    };
  }
}

// ═══ EXECUTION ENGINE ═══

export async function executeGraph(
  graphId: string,
  config: GraphConfig,
  initialState: Partial<GraphState>,
  onNodeExecuted?: (nodeId: string, state: GraphState) => void,
  resumeFromCheckpoint?: string
): Promise<GraphResult> {
  const startTime = Date.now();
  const nodesVisited: string[] = [];
  const checkpoints: GraphCheckpoint[] = [];
  let totalCost = 0;

  // Initialize or restore state
  let state: GraphState = resumeFromCheckpoint
    ? (restoreCheckpoint(resumeFromCheckpoint) ?? createInitialState(initialState, config.entryPoint))
    : createInitialState(initialState, config.entryPoint);

  logger.info(`Graph "${graphId}": starting from ${state.currentNode}, max ${config.maxIterations} iterations`, 'graphEngine');

  while (state.iteration < config.maxIterations && state.status === 'running') {
    // Timeout check
    if (Date.now() - startTime > config.timeoutMs) {
      state.status = 'failed';
      logger.error(`Graph "${graphId}": timeout after ${config.timeoutMs}ms`, undefined, 'graphEngine');
      break;
    }

    const currentNode = config.nodes.get(state.currentNode);
    if (!currentNode) {
      logger.error(`Graph "${graphId}": node "${state.currentNode}" not found`, undefined, 'graphEngine');
      state.status = 'failed';
      break;
    }

    // HITL check for human nodes
    if (currentNode.type === 'human' && hitlCallback) {
      state.status = 'paused';
      const cp = saveCheckpoint(graphId, state, state.currentNode);
      checkpoints.push(cp);
      logger.info(`Graph "${graphId}": paused for HITL at "${currentNode.label}"`, 'graphEngine');

      const hitlResult = await hitlCallback(state, state.currentNode);
      if (!hitlResult.approved) {
        state.status = 'failed';
        break;
      }
      if (hitlResult.modifiedState) {
        Object.assign(state, hitlResult.modifiedState);
      }
      state.status = 'running';
    }

    // Execute node
    const nodeStart = Date.now();
    try {
      let updates: Partial<GraphState>;

      if (currentNode.type === 'parallel') {
        // Parallel execution: run all outgoing edges simultaneously
        updates = await executeParallelNode(currentNode, state, config);
      } else {
        updates = await Promise.race([
          currentNode.execute(state),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Node timeout (30s)')), 30000)),
        ]);
      }

      // Apply state updates
      Object.assign(state, updates);
      state.iteration++;
      nodesVisited.push(currentNode.id);

      const nodeDuration = Date.now() - nodeStart;
      logger.debug(`Node "${currentNode.label}": ${nodeDuration}ms`, 'graphEngine');
      onNodeExecuted?.(currentNode.id, { ...state });

    } catch (err) {
      logger.error(`Node "${currentNode.label}" failed: ${err instanceof Error ? err.message : 'Unknown'}`, err, 'graphEngine');
      state.status = 'failed';
      break;
    }

    // Checkpointing
    if (state.iteration % config.checkpointInterval === 0) {
      const cp = saveCheckpoint(graphId, state, state.currentNode);
      checkpoints.push(cp);
    }

    // Determine next node
    const nextNode = resolveNextNode(state.currentNode, state, config);
    if (!nextNode) {
      state.status = 'completed';
      break;
    }
    state.currentNode = nextNode;
  }

  if (state.iteration >= config.maxIterations && state.status === 'running') {
    state.status = 'completed'; // Treat max iterations as completion
    logger.warn(`Graph "${graphId}": hit max iterations (${config.maxIterations})`, 'graphEngine');
  }

  const durationMs = Date.now() - startTime;

  // Record trace
  traceService.recordTrace({
    agent_id: '00000000-0000-0000-0000-000000000000',
    agent_name: `Graph: ${graphId}`,
    session_id: traceService.getSessionId(),
    model: 'graph-engine',
    input: JSON.stringify(initialState).slice(0, 500),
    output: JSON.stringify(state.messages?.slice(-1)).slice(0, 1000),
    tokens_in: 0, tokens_out: 0, cost_usd: totalCost,
    latency_ms: durationMs,
    status: state.status === 'completed' ? 'success' : state.status === 'paused' ? 'blocked' : 'error',
    events: nodesVisited.map(nid => ({
      type: 'model' as const, label: config.nodes.get(nid)?.label ?? nid,
      duration_ms: 0, status: 'success' as const,
    })),
    guardrails_triggered: [], tools_used: nodesVisited,
  });

  logger.info(`Graph "${graphId}": ${state.status}, ${nodesVisited.length} nodes, ${state.iteration} iterations, ${durationMs}ms`, 'graphEngine');

  return {
    finalState: state, nodesVisited, iterations: state.iteration,
    durationMs, costUsd: totalCost, checkpoints,
    status: state.status === 'completed' ? 'completed' : state.status === 'paused' ? 'paused' : state.iteration >= config.maxIterations ? 'max_iterations' : 'failed',
  };
}

// ═══ HELPERS ═══

function createInitialState(partial: Partial<GraphState>, entryPoint: string): GraphState {
  return {
    messages: [],
    currentNode: entryPoint,
    iteration: 0,
    status: 'running',
    ...partial,
  };
}

function resolveNextNode(currentNodeId: string, state: GraphState, config: GraphConfig): string | null {
  // Check conditional edges first
  const condEdge = config.conditionalEdges.find(e => e.from === currentNodeId);
  if (condEdge) {
    const target = condEdge.condition(state);
    if (target === '__end__' || target === 'END') return null;
    return target;
  }

  // Check normal edges
  const outEdges = config.edges.filter(e => e.from === currentNodeId);
  for (const edge of outEdges) {
    if (!edge.condition || edge.condition(state)) {
      return edge.to;
    }
  }

  return null; // No outgoing edge = end
}

async function executeParallelNode(node: GraphNode, state: GraphState, config: GraphConfig): Promise<Partial<GraphState>> {
  const outEdges = config.edges.filter(e => e.from === node.id);
  const results = await Promise.all(
    outEdges.map(async edge => {
      const targetNode = config.nodes.get(edge.to);
      if (!targetNode) return {};
      return targetNode.execute(state);
    })
  );

  // Merge all results
  const merged: Partial<GraphState> = {};
  for (const result of results) {
    Object.assign(merged, result);
    if (result.messages) {
      merged.messages = [...(state.messages ?? []), ...(result.messages ?? [])];
    }
  }
  return merged;
}

// ═══ PRESET NODE FACTORIES ═══

/** Create an LLM node that calls a model with the current messages. */
export function createLLMNode(label: string, systemPrompt: string, model?: string): GraphNode {
  return {
    id: label.toLowerCase().replace(/\s+/g, '_'),
    type: 'llm',
    label,
    execute: async (state) => {
      const messages: llm.LLMMessage[] = [
        { role: 'system', content: systemPrompt },
        ...state.messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      ];
      const response = await llm.callModel(model ?? 'anthropic/claude-sonnet-4', messages, { maxTokens: 2048 });
      return {
        messages: [...state.messages, { role: 'assistant', content: response.content }],
        lastResponse: response.content,
        lastCost: response.cost,
        lastLatency: response.latencyMs,
      };
    },
  };
}

/** Create a conditional router node. */
export function createRouterNode(label: string, routeFn: (state: GraphState) => string): GraphNode {
  return {
    id: label.toLowerCase().replace(/\s+/g, '_'),
    type: 'conditional',
    label,
    execute: async (state) => ({ nextRoute: routeFn(state) }),
  };
}

/** Create a human approval node. */
export function createHITLNode(label: string): GraphNode {
  return {
    id: label.toLowerCase().replace(/\s+/g, '_'),
    type: 'human',
    label,
    execute: async (state) => ({ awaitingApproval: true }),
  };
}

/** Create a tool call node. */
export function createToolNode(label: string, toolFn: (state: GraphState) => Promise<string>): GraphNode {
  return {
    id: label.toLowerCase().replace(/\s+/g, '_'),
    type: 'tool',
    label,
    execute: async (state) => {
      const result = await toolFn(state);
      return { messages: [...state.messages, { role: 'assistant', content: `[Tool: ${label}] ${result}` }], toolResult: result };
    },
  };
}

// ═══ PRESET GRAPHS ═══

/** ReAct Agent: Reasoning + Acting loop with tool use. */
export function createReActGraph(systemPrompt: string, tools: { name: string; fn: (input: string) => Promise<string> }[]): GraphConfig {
  const graph = new StateGraph();

  graph.addNode('reason', createLLMNode('Reasoner', systemPrompt + '\n\nDecida: use uma tool (responda com "TOOL: <name> <input>") ou responda diretamente ao usuário.'));

  graph.addNode('act', {
    id: 'act', type: 'tool', label: 'Actor',
    execute: async (state) => {
      const lastMsg = state.messages[state.messages.length - 1]?.content ?? '';
      const toolMatch = lastMsg.match(/TOOL:\s*(\w+)\s*(.*)/);
      if (toolMatch) {
        const tool = tools.find(t => t.name === toolMatch[1]);
        if (tool) {
          const result = await tool.fn(toolMatch[2]);
          return { messages: [...state.messages, { role: 'assistant', content: `[${tool.name}]: ${result}` }], needsMoreReasoning: true };
        }
      }
      return { needsMoreReasoning: false };
    },
  });

  graph.setEntryPoint('reason');
  graph.addConditionalEdge('reason', (state) => {
    const last = state.messages[state.messages.length - 1]?.content ?? '';
    return last.includes('TOOL:') ? 'act' : '__end__';
  });
  graph.addConditionalEdge('act', (state) => {
    return (state as GraphState & { needsMoreReasoning?: boolean }).needsMoreReasoning ? 'reason' : '__end__';
  });

  return graph.compile({ maxIterations: 10 });
}

/** Reflection Agent: Generate → Critique → Revise loop. */
export function createReflectionGraph(systemPrompt: string): GraphConfig {
  const graph = new StateGraph();

  graph.addNode('generate', createLLMNode('Generator', systemPrompt));
  graph.addNode('reflect', createLLMNode('Reflector', 'Critique a resposta anterior. Identifique erros, omissões e melhorias. Se está boa, responda "APPROVED". Se precisa melhorar, explique o quê.'));
  graph.addNode('revise', createLLMNode('Reviser', 'Revise sua resposta anterior baseada na crítica. Produza uma versão melhorada.'));

  graph.setEntryPoint('generate');
  graph.addEdge('generate', 'reflect');
  graph.addConditionalEdge('reflect', (state) => {
    const last = state.messages[state.messages.length - 1]?.content ?? '';
    return last.includes('APPROVED') ? '__end__' : 'revise';
  });
  graph.addEdge('revise', 'reflect'); // Cycle back

  return graph.compile({ maxIterations: 6 });
}
