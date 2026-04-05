/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Workflow Node Types
 * ═══════════════════════════════════════════════════════════════
 * 12 custom node types for the React Flow workflow builder.
 * Each node has: icon, color, input/output handles, config panel.
 * Reference: Sim Studio, Flowise, Dify visual canvas
 */

export const NODE_TYPES = {
  start:          { label: 'Início / Trigger',     icon: '▶️',  color: '#6BCB77', category: 'control' },
  llm_call:       { label: 'Chamada LLM',          icon: '🧠',  color: '#4D96FF', category: 'ai' },
  agent:          { label: 'Agente Nexus',          icon: '🤖',  color: '#9B59B6', category: 'ai' },
  tool:           { label: 'Ferramenta / MCP',      icon: '🔧',  color: '#E67E22', category: 'action' },
  condition:      { label: 'Condição (If/Else)',    icon: '🔀',  color: '#FFD93D', category: 'control' },
  loop:           { label: 'Loop / Iteração',       icon: '🔄',  color: '#2EC4B6', category: 'control' },
  transform:      { label: 'Transformar Dados',     icon: '⚡',  color: '#D4A574', category: 'data' },
  human_approval: { label: 'Aprovação Humana',      icon: '👤',  color: '#FF6B6B', category: 'control' },
  knowledge:      { label: 'Super Cérebro / RAG',   icon: '📚',  color: '#6BCB77', category: 'ai' },
  oracle:         { label: 'Consultar Oráculo',     icon: '🔮',  color: '#9B59B6', category: 'ai' },
  output:         { label: 'Saída / Resultado',     icon: '📤',  color: '#4D96FF', category: 'output' },
  sub_workflow:   { label: 'Sub-Workflow',           icon: '📋',  color: '#888888', category: 'control' },
} as const;

export type NodeType = keyof typeof NODE_TYPES;

export interface WorkflowNodeData {
  label: string;
  type: NodeType;
  config: Record<string, unknown>;
  status?: 'idle' | 'running' | 'success' | 'error';
  result?: unknown;
}

export const NODE_CATEGORIES = [
  { id: 'control', label: 'Controle de Fluxo', nodes: ['start', 'condition', 'loop', 'human_approval', 'sub_workflow'] },
  { id: 'ai',      label: 'Inteligência',      nodes: ['llm_call', 'agent', 'knowledge', 'oracle'] },
  { id: 'action',  label: 'Ações',             nodes: ['tool', 'transform'] },
  { id: 'output',  label: 'Saída',             nodes: ['output'] },
] as const;

// Default configs for each node type
export const NODE_DEFAULTS: Record<NodeType, Record<string, unknown>> = {
  start:          { trigger: 'manual', schedule: '', webhook_path: '' },
  llm_call:       { model: 'claude-sonnet-4-6', temperature: 0.7, max_tokens: 4096, system_prompt: '', user_prompt: '' },
  agent:          { agent_id: '', delegate_full: true },
  tool:           { tool_type: 'mcp', mcp_server: '', tool_name: '', params: {} },
  condition:      { condition_type: 'expression', expression: '', true_label: 'Sim', false_label: 'Não' },
  loop:           { loop_type: 'for_each', items_path: '', max_iterations: 100 },
  transform:      { transform_type: 'jq', expression: '.', input_format: 'json', output_format: 'json' },
  human_approval: { approvers: [], timeout_hours: 24, auto_action: 'reject', message: '' },
  knowledge:      { query_source: 'auto', collection_ids: [], top_k: 5, threshold: 0.7 },
  oracle:         { preset: 'rapido', custom_models: [], enable_peer_review: false },
  output:         { output_type: 'response', format: 'text', channel: 'default' },
  sub_workflow:   { workflow_id: '', pass_context: true },
};
