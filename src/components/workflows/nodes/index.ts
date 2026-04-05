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
  // Automation nodes
  cron_trigger:   { label: 'Trigger Agendado',       icon: '⏰',  color: '#4D96FF', category: 'automation' },
  webhook_trigger:{ label: 'Trigger Webhook',        icon: '🔗',  color: '#9B59B6', category: 'automation' },
  send_notification:{ label: 'Enviar Notificação',   icon: '🔔',  color: '#6BCB77', category: 'automation' },
  enqueue:        { label: 'Adicionar à Fila',       icon: '📥',  color: '#E67E22', category: 'automation' },
  batch_process:  { label: 'Processar em Lote',      icon: '📦',  color: '#FFD93D', category: 'automation' },
  api_connector:  { label: 'Chamar API Externa',     icon: '🔌',  color: '#2EC4B6', category: 'automation' },
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
  { id: 'automation', label: 'Automação',      nodes: ['cron_trigger', 'webhook_trigger', 'send_notification', 'enqueue', 'batch_process', 'api_connector'] },
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
  cron_trigger:   { cron_expression: '0 9 * * 1-5', timezone: 'America/Sao_Paulo', preset: 'business_hours' },
  webhook_trigger:{ webhook_id: '', auth_type: 'hmac_sha256', transform_script: '' },
  send_notification:{ channel: 'whatsapp', recipient: '', subject: '', body: '', template_id: '', priority: 'normal' },
  enqueue:        { queue_id: '', priority: 0, payload_source: 'previous_step', timeout_ms: 30000 },
  batch_process:  { batch_size: 50, concurrency: 3, error_policy: 'continue_all', items_source: 'previous_step' },
  api_connector:  { connector_slug: '', operation_id: '', params: {}, retry_policy: 'api_call' },
};

/** Detailed descriptions for workflow node tooltips */
export const NODE_DESCRIPTIONS: Record<NodeType, string> = {
  start: 'Ponto de entrada do workflow. Pode ser disparado manualmente, por agenda (cron) ou webhook.',
  llm_call: 'Faz uma chamada a um LLM (Claude, GPT, etc.) com prompt customizado. Ideal para classificação, geração de texto, análise.',
  agent: 'Delega a tarefa para um agente Nexus completo, com suas próprias skills e personalidade.',
  tool: 'Executa uma ferramenta externa via MCP ou API. Ex: buscar dados no Bitrix24, enviar WhatsApp.',
  condition: 'Bifurcação condicional (If/Else). Avalia uma expressão e direciona o fluxo.',
  loop: 'Itera sobre uma lista de itens, executando os próximos nós para cada item.',
  transform: 'Transforma dados entre etapas. Suporta JQ, JSONPath, e mapeamento de campos.',
  human_approval: 'Pausa o workflow e aguarda aprovação humana. Configura timeout e ação padrão.',
  knowledge: 'Consulta a base de conhecimento (Super Cérebro / RAG) com busca semântica + BM25.',
  oracle: 'Consulta o Oráculo multi-LLM para deliberação em conselho com síntese do Chairman.',
  output: 'Nó de saída que define o resultado final do workflow. Suporta texto, JSON, ou resposta de chat.',
  sub_workflow: 'Executa outro workflow como sub-rotina, passando contexto e recebendo resultado.',
  cron_trigger: 'Dispara o workflow em horário agendado. Suporta expressão cron ou presets (diário, semanal, etc.).',
  webhook_trigger: 'Dispara o workflow quando um webhook externo é recebido. Valida autenticação HMAC/Bearer/API Key.',
  send_notification: 'Envia notificação via WhatsApp, email, Slack, push ou in-app. Suporta templates com variáveis.',
  enqueue: 'Adiciona um item a uma fila de processamento com prioridade configurável.',
  batch_process: 'Processa uma lista de itens em lotes com controle de concorrência e tolerância a erros.',
  api_connector: 'Chama uma API externa usando um conector do registry. Suporta Bitrix24, WhatsApp, Supabase, etc.',
};
