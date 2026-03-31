// ═══ ENUMS ═══
export type AgentLifecycleStage =
  | 'draft' | 'configured' | 'testing' | 'staging'
  | 'review' | 'production' | 'monitoring' | 'deprecated' | 'archived';

export type AgentPersona = 'assistant' | 'specialist' | 'coordinator' | 'analyst' | 'creative' | 'autonomous';
export type LLMModel = 'claude-opus-4.6' | 'claude-sonnet-4.6' | 'claude-haiku-4.5' | 'gpt-4o' | 'gemini-2.5-pro' | 'llama-4' | 'custom';
export type ReasoningPattern = 'react' | 'cot' | 'tot' | 'reflection' | 'plan_execute';
export type ConsolidationStrategy = 'hot_path' | 'background' | 'hybrid';
export type RAGArchitecture = 'naive' | 'advanced' | 'modular' | 'agentic' | 'graph_rag';
export type VectorDB = 'chroma' | 'qdrant' | 'pinecone' | 'pgvector' | 'weaviate' | 'lancedb';
export type OrchestrationPattern = 'single' | 'sequential' | 'hierarchical' | 'swarm';
export type DeployEnvironment = 'cloud_api' | 'self_hosted' | 'hybrid';
export type OutputFormat = 'text' | 'json' | 'markdown' | 'structured';

// ═══ MEMÓRIA ═══
export interface MemoryGovernance {
  retention_days: number;
  update_policy: 'append' | 'overwrite' | 'version';
  forgetting_policy: 'time_decay' | 'relevance_decay' | 'manual' | 'compliance';
  read_permission: 'agent_only' | 'team' | 'all_agents' | 'admin';
  write_permission: 'agent_only' | 'supervisor' | 'human_only';
  audit_trail: boolean;
  gdpr_compliance: boolean;
}

export interface ShortTermMemoryConfig {
  max_messages: number;
  max_tokens: number;
  strategy: 'sliding_window' | 'summarization' | 'hybrid';
}

export interface EpisodicMemoryConfig extends MemoryGovernance {
  storage: 'vector_db' | 'structured_db';
  decay_rate: number;
  max_episodes: number;
}

export interface SemanticMemoryConfig extends MemoryGovernance {
  storage: 'vector_db' | 'knowledge_graph' | 'hybrid';
  embedding_model: string;
  graph_db: 'neo4j' | 'memgraph' | 'none';
}

export interface ProceduralMemoryConfig extends MemoryGovernance {
  storage: 'structured_db' | 'code_repo';
  learning_rate: number;
  version_control: boolean;
}

export interface ProfileMemoryConfig extends MemoryGovernance {
  auto_extract: boolean;
  update_on_interaction: boolean;
  scope: 'per_user' | 'per_organization' | 'per_channel';
  fields: string[];
}

export interface SharedMemoryConfig extends MemoryGovernance {
  read_scope: 'all_agents' | 'same_team' | 'same_workspace';
  write_scope: 'any_agent' | 'supervisors_only' | 'human_only';
  conflict_resolution: 'last_write_wins' | 'version_merge' | 'human_review';
}

export interface ExternalMemorySource {
  id: string;
  name: string;
  type: 'crm' | 'erp' | 'email' | 'calendar' | 'tickets' | 'database' | 'api';
  connection_string: string;
  sync_mode: 'realtime' | 'on_demand' | 'scheduled';
  auto_inject: boolean;
  fields_to_extract: string[];
  enabled: boolean;
}

// ═══ RAG ═══
export interface RAGSource {
  id: string;
  name: string;
  type: 'pdf' | 'url' | 'database' | 'api' | 'google_drive' | 'confluence' | 'notion' | 'csv' | 'docx';
  location: string;
  sync_frequency: 'manual' | 'hourly' | 'daily' | 'weekly';
  last_synced?: string;
  doc_count?: number;
  chunk_count?: number;
  enabled: boolean;
}

// ═══ FERRAMENTAS ═══
export interface AgentTool {
  id: string;
  name: string;
  description: string;
  category: 'data' | 'action' | 'compute' | 'integration';
  enabled: boolean;
  permission_level: 'read_only' | 'read_write' | 'admin';
  requires_approval: boolean;
  max_calls_per_session: number;
  max_calls_per_day: number;
  allowed_conditions: string;
  output_validation: 'none' | 'schema' | 'llm_review';
  cost_per_call: number;
  audit_log: boolean;
}

export interface MCPServer {
  id: string;
  name: string;
  url: string;
  enabled: boolean;
  tools_count?: number;
  last_connected?: string;
}

export interface CustomAPI {
  id: string;
  name: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  auth_type: 'none' | 'api_key' | 'bearer' | 'basic' | 'oauth2';
  description: string;
  headers?: Record<string, string>;
  body_template?: string;
}

// ═══ PROMPT ═══
export interface PromptTechnique {
  id: string;
  name: string;
  enabled: boolean;
  config?: string;
}

export interface FewShotExample {
  id: string;
  input: string;
  expected_output: string;
  tags: string[];
}

export interface PromptVersion {
  id: string;
  version: number;
  content: string;
  change_summary: string;
  author: string;
  test_results?: TestResults;
  is_active: boolean;
  created_at: string;
}

// ═══ GUARDRAILS ═══
export interface GuardrailConfig {
  id: string;
  category: 'input_validation' | 'output_safety' | 'access_control' | 'operational';
  name: string;
  description: string;
  enabled: boolean;
  severity: 'block' | 'warn' | 'log';
  config?: Record<string, unknown>;
}

// ═══ AVALIAÇÃO ═══
export interface TestCase {
  id: string;
  name: string;
  input: string;
  expected_behavior: string;
  category: 'functional' | 'safety' | 'edge_case' | 'regression' | 'performance';
  tags: string[];
  status: 'pending' | 'passed' | 'failed' | 'skipped';
  last_run?: string;
}

export interface EvalMetric {
  id: string;
  name: string;
  target: number;
  current?: number;
  unit: string;
  weight: number;
  is_blocker: boolean;
}

export interface TestResults {
  accuracy: number;
  latency_p95: number;
  safety_score: number;
  relevance: number;
  consistency: number;
  hallucination_rate: number;
  tool_success_rate: number;
  groundedness: number;
  policy_compliance: number;
  citation_quality: number;
  user_satisfaction?: number;
  cost_per_interaction: number;
  timestamp: string;
  prompt_version: number;
  model_used: string;
}

// ═══ OBSERVABILIDADE ═══
export interface ExecutionTrace {
  id: string;
  session_id: string;
  user_input: string;
  context_retrieved: { source: string; chunk: string; score: number }[];
  memories_used: { type: string; content: string }[];
  prompt_assembled: string;
  llm_response: string;
  tool_calls: { tool: string; input: unknown; output: unknown; latency_ms: number; success: boolean }[];
  guardrails_triggered: { id: string; action: string; reason: string }[];
  final_output: string;
  total_tokens: number;
  total_cost: number;
  latency_ms: number;
  status: 'success' | 'error' | 'timeout' | 'blocked';
  error_details?: string;
  created_at: string;
}

// ═══ DEPLOY ═══
export interface DeployChannelConfig {
  id: string;
  channel: DeployChannel;
  enabled: boolean;
  config: Record<string, string>;
  status: 'active' | 'inactive' | 'error';
}

export type DeployChannel = 'api' | 'whatsapp' | 'web_chat' | 'slack' | 'email' | 'bitrix24' | 'telegram' | 'discord' | 'openclaw';

export interface MonitoringKPI {
  id: string;
  name: string;
  target: string;
  icon: string;
  enabled: boolean;
}

// ═══ BILLING ═══
export interface UsageRecord {
  date: string;
  llm_tokens: number;
  llm_cost: number;
  embedding_tokens: number;
  embedding_cost: number;
  tool_calls: number;
  tool_cost: number;
  storage_gb: number;
  storage_cost: number;
  total_cost: number;
  interactions: number;
}

// ═══ PRONTIDÃO ═══
export interface ReadinessScore {
  total: number;
  categories: Record<string, { score: number; max: number; items: ReadinessItem[] }>;
  blockers: string[];
  recommendations: string[];
  maturity_level: 'prototype' | 'tested' | 'staging' | 'production_ready';
}

export interface ReadinessItem {
  label: string;
  passed: boolean;
  weight: number;
  is_blocker: boolean;
  fix_hint?: string;
}

// ═══ TEAM ═══
export interface WorkspaceMember {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer' | 'operator';
  invited_at: string;
  accepted_at?: string;
}

export interface AgentPermission {
  agent_id: string;
  user_id: string;
  can_edit: boolean;
  can_deploy: boolean;
  can_view_traces: boolean;
  can_delete: boolean;
}

// ═══ SUB-AGENTES ═══
export interface SubAgentRef {
  id: string;
  name: string;
  role: string;
  agent_config_id?: string;
}

// ═══ AGENT CONFIG (PRINCIPAL) ═══
export interface AgentConfig {
  id?: string;
  created_at?: string;
  updated_at?: string;
  version: number;
  status: AgentLifecycleStage;
  tags: string[];

  name: string;
  mission: string;
  persona: AgentPersona;
  formality: number;
  proactivity: number;
  creativity: number;
  verbosity: number;
  scope: string;
  avatar_emoji: string;

  model: LLMModel;
  model_fallback?: LLMModel;
  reasoning: ReasoningPattern;
  temperature: number;
  top_p: number;
  max_tokens: number;
  retry_count: number;

  memory_short_term: boolean;
  memory_short_term_config: ShortTermMemoryConfig;
  memory_episodic: boolean;
  memory_episodic_config: EpisodicMemoryConfig;
  memory_semantic: boolean;
  memory_semantic_config: SemanticMemoryConfig;
  memory_procedural: boolean;
  memory_procedural_config: ProceduralMemoryConfig;
  memory_profile: boolean;
  memory_profile_config: ProfileMemoryConfig;
  memory_shared: boolean;
  memory_shared_config: SharedMemoryConfig;
  memory_external_sources: ExternalMemorySource[];
  memory_consolidation: ConsolidationStrategy;

  rag_architecture: RAGArchitecture;
  rag_vector_db: VectorDB;
  rag_embedding_model: string;
  rag_chunk_size: number;
  rag_chunk_overlap: number;
  rag_top_k: number;
  rag_similarity_threshold: number;
  rag_reranker: boolean;
  rag_hybrid_search: boolean;
  rag_metadata_filtering: boolean;
  rag_sources: RAGSource[];

  tools: AgentTool[];
  mcp_servers: MCPServer[];
  custom_apis: CustomAPI[];

  system_prompt: string;
  system_prompt_version: number;
  prompt_techniques: PromptTechnique[];
  few_shot_examples: FewShotExample[];
  output_format: OutputFormat;

  orchestration_pattern: OrchestrationPattern;
  sub_agents: SubAgentRef[];
  human_in_loop: boolean;
  human_in_loop_triggers: string[];
  max_iterations: number;
  timeout_seconds: number;

  guardrails: GuardrailConfig[];
  input_max_length: number;
  output_max_length: number;
  token_budget_per_session: number;
  allowed_domains: string[];
  blocked_topics: string[];

  test_cases: TestCase[];
  eval_metrics: EvalMetric[];
  last_test_results?: TestResults;

  deploy_environment: DeployEnvironment;
  deploy_channels: DeployChannelConfig[];
  monitoring_kpis: MonitoringKPI[];
  logging_enabled: boolean;
  alerting_enabled: boolean;
  ab_testing_enabled: boolean;
  auto_scaling: boolean;

  monthly_budget?: number;
  budget_alert_threshold: number;
  budget_kill_switch: boolean;
}
