/**
 * Workflow Engine — Executes workflow node sequences
 * Reads canvas nodes + connections and runs them as a pipeline.
 */
import * as llm from './llmService';
import * as traceService from './traceService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config?: Record<string, unknown>;
}

export interface WorkflowConnection {
  id: string;
  fromNodeId: string;
  toNodeId: string;
}

export interface NodeResult {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  output: string;
  status: 'success' | 'error' | 'skipped';
  durationMs: number;
  costUsd: number;
}

export interface WorkflowResult {
  pipelineId: string;
  pipelineName: string;
  status: 'completed' | 'failed' | 'partial';
  nodeResults: NodeResult[];
  totalDurationMs: number;
  totalCostUsd: number;
  finalOutput: string;
}

// ═══ NODE EXECUTORS ═══

type NodeExecutor = (input: string, node: WorkflowNode) => Promise<{ output: string; costUsd: number }>;

const nodeExecutors: Record<string, NodeExecutor> = {
  planner: async (input, node) => {
    if (!llm.isLLMConfigured()) return { output: `[Planner] Plano para: ${input.slice(0, 100)}...`, costUsd: 0 };
    const resp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Você é um planner. Decomponha a tarefa em etapas claras e numeradas.' },
      { role: 'user', content: input },
    ], { maxTokens: 1024 });
    return { output: resp.content, costUsd: resp.cost };
  },

  researcher: async (input, node) => {
    if (!llm.isLLMConfigured()) return { output: `[Researcher] Pesquisa sobre: ${input.slice(0, 100)}...`, costUsd: 0 };
    const resp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Você é um pesquisador. Busque informações relevantes e cite fontes quando possível.' },
      { role: 'user', content: `Pesquise: ${input}` },
    ], { maxTokens: 2048 });
    return { output: resp.content, costUsd: resp.cost };
  },

  retriever: async (input, node) => {
    // Simulated retrieval (would connect to RAG pipeline)
    return { output: `[Retriever] Documentos relevantes para: ${input.slice(0, 100)}...\n- Doc 1: Política comercial\n- Doc 2: FAQ suporte`, costUsd: 0 };
  },

  critic: async (input, node) => {
    if (!llm.isLLMConfigured()) return { output: `[Critic] Avaliação de: ${input.slice(0, 100)}...`, costUsd: 0 };
    const resp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Você é um crítico. Avalie a qualidade do conteúdo, identifique problemas e sugira melhorias.' },
      { role: 'user', content: `Avalie criticamente:\n${input}` },
    ], { maxTokens: 1024 });
    return { output: resp.content, costUsd: resp.cost };
  },

  executor: async (input, node) => {
    if (!llm.isLLMConfigured()) return { output: `[Executor] Output final baseado em: ${input.slice(0, 200)}...`, costUsd: 0 };
    const resp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Você é um executor. Produza o output final consolidando todas as informações recebidas.' },
      { role: 'user', content: `Produza o resultado final:\n${input}` },
    ], { maxTokens: 2048 });
    return { output: resp.content, costUsd: resp.cost };
  },

  validator: async (input, node) => {
    if (!llm.isLLMConfigured()) return { output: `[Validator] Validação: OK`, costUsd: 0 };
    const resp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Você é um validador. Verifique se o conteúdo está correto, completo e consistente. Retorne APROVADO ou REPROVADO com justificativa.' },
      { role: 'user', content: `Valide:\n${input}` },
    ], { maxTokens: 512 });
    return { output: resp.content, costUsd: resp.cost };
  },

  human: async (input, node) => {
    // Human-in-the-loop: pause and return pending
    return { output: `[Human Gate] Aguardando aprovação humana para: ${input.slice(0, 100)}...`, costUsd: 0 };
  },

  router: async (input, node) => {
    return { output: input, costUsd: 0 }; // Pass-through
  },
};

// ═══ EXECUTION ENGINE ═══

/** Execute a workflow pipeline. Traverses nodes via connections in topological order. */
export async function executeWorkflow(
  pipelineName: string,
  nodes: WorkflowNode[],
  connections: WorkflowConnection[],
  initialInput: string,
  onNodeComplete?: (nodeId: string, result: NodeResult) => void
): Promise<WorkflowResult> {
  const startTime = Date.now();
  const nodeResults: NodeResult[] = [];
  const nodeOutputs = new Map<string, string>();

  logger.info(`Workflow "${pipelineName}": executing ${nodes.length} nodes`, 'workflowEngine');

  // Find execution order (topological sort)
  const order = topologicalSort(nodes, connections);

  for (const nodeId of order) {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) continue;

    // Gather inputs from parent nodes
    const parentConns = connections.filter(c => c.toNodeId === nodeId);
    const inputs = parentConns.map(c => nodeOutputs.get(c.fromNodeId) ?? '').filter(Boolean);
    const combinedInput = inputs.length > 0 ? inputs.join('\n\n---\n\n') : initialInput;

    // Execute node
    const nodeStart = Date.now();
    const executor = nodeExecutors[node.type] ?? nodeExecutors.executor;

    try {
      const { output, costUsd } = await executor(combinedInput, node);
      const duration = Date.now() - nodeStart;

      nodeOutputs.set(nodeId, output);
      const result: NodeResult = {
        nodeId, nodeType: node.type, nodeLabel: node.label,
        output, status: 'success', durationMs: duration, costUsd,
      };
      nodeResults.push(result);
      onNodeComplete?.(nodeId, result);

      logger.debug(`Node "${node.label}" (${node.type}): ${duration}ms, $${costUsd.toFixed(4)}`, 'workflowEngine');
    } catch (err) {
      const result: NodeResult = {
        nodeId, nodeType: node.type, nodeLabel: node.label,
        output: err instanceof Error ? err.message : 'Error',
        status: 'error', durationMs: Date.now() - nodeStart, costUsd: 0,
      };
      nodeResults.push(result);
      onNodeComplete?.(nodeId, result);
      nodeOutputs.set(nodeId, ''); // Continue execution despite error
    }
  }

  // Get final output from last node
  const lastNodeId = order[order.length - 1];
  const finalOutput = lastNodeId ? nodeOutputs.get(lastNodeId) ?? '' : '';
  const totalCost = nodeResults.reduce((s, r) => s + r.costUsd, 0);
  const totalDuration = Date.now() - startTime;
  const hasErrors = nodeResults.some(r => r.status === 'error');

  // Record workflow trace
  traceService.recordTrace({
    agent_id: 'workflow', agent_name: pipelineName, session_id: traceService.getSessionId(),
    model: 'workflow-engine', input: initialInput.slice(0, 500), output: finalOutput.slice(0, 1000),
    tokens_in: 0, tokens_out: 0, cost_usd: totalCost, latency_ms: totalDuration,
    status: hasErrors ? 'error' : 'success',
    events: nodeResults.map(r => ({
      type: r.nodeType as traceService.TraceEvent['type'],
      label: r.nodeLabel, detail: r.output.slice(0, 200),
      duration_ms: r.durationMs, status: r.status as 'success' | 'error',
    })),
    guardrails_triggered: [], tools_used: nodeResults.map(r => r.nodeType),
  });

  logger.info(`Workflow "${pipelineName}": ${nodeResults.length} nodes, ${totalDuration}ms, $${totalCost.toFixed(4)}, ${hasErrors ? 'PARTIAL' : 'COMPLETED'}`, 'workflowEngine');

  return {
    pipelineId: `wf-${Date.now()}`,
    pipelineName,
    status: hasErrors ? 'partial' : 'completed',
    nodeResults, totalDurationMs: totalDuration, totalCostUsd: totalCost, finalOutput,
  };
}

// ═══ TOPOLOGICAL SORT ═══

function topologicalSort(nodes: WorkflowNode[], connections: WorkflowConnection[]): string[] {
  const inDegree = new Map<string, number>();
  const adjacency = new Map<string, string[]>();

  nodes.forEach(n => { inDegree.set(n.id, 0); adjacency.set(n.id, []); });
  connections.forEach(c => {
    adjacency.get(c.fromNodeId)?.push(c.toNodeId);
    inDegree.set(c.toNodeId, (inDegree.get(c.toNodeId) ?? 0) + 1);
  });

  const queue: string[] = [];
  inDegree.forEach((deg, id) => { if (deg === 0) queue.push(id); });

  const sorted: string[] = [];
  while (queue.length > 0) {
    const nodeId = queue.shift()!;
    sorted.push(nodeId);
    adjacency.get(nodeId)?.forEach(next => {
      const newDeg = (inDegree.get(next) ?? 1) - 1;
      inDegree.set(next, newDeg);
      if (newDeg === 0) queue.push(next);
    });
  }

  // Add any remaining nodes (cycles or disconnected)
  nodes.forEach(n => { if (!sorted.includes(n.id)) sorted.push(n.id); });

  return sorted;
}
