/**
 * Extended Supabase types for tables added by migration 20260401200000.
 * 
 * After running `supabase gen types typescript --local > src/integrations/supabase/types.ts`
 * this file becomes redundant and can be deleted.
 * 
 * Usage: import { type AgentMemory, type AlertRule, ... } from '@/integrations/supabase/types.extended';
 */

export interface AgentMemory {
  id: string;
  agent_id: string | null;
  workspace_id: string | null;
  memory_type: 'short_term' | 'episodic' | 'semantic' | 'procedural' | 'user_profile' | 'team' | 'external';
  content: string;
  source: string | null;
  metadata: Record<string, unknown>;
  relevance_score: number | null;
  access_count: number | null;
  last_accessed_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ModelPricing {
  id: string;
  model_pattern: string;
  input_cost_per_1k: number;
  output_cost_per_1k: number;
  updated_at: string;
}

export interface WorkflowRun {
  id: string;
  workflow_id: string | null;
  status: 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  current_step: number;
  total_steps: number;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  total_tokens: number;
  total_cost_usd: number;
}

export interface WorkflowStepRun {
  id: string;
  workflow_run_id: string | null;
  workflow_step_id: string | null;
  step_order: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  error: string | null;
  tokens_used: number;
  cost_usd: number;
  latency_ms: number;
  started_at: string | null;
  completed_at: string | null;
}

export interface DeployConnection {
  id: string;
  agent_id: string | null;
  workspace_id: string | null;
  channel: 'api' | 'whatsapp' | 'web_chat' | 'slack' | 'email' | 'bitrix24' | 'telegram' | 'discord';
  status: 'active' | 'inactive' | 'error' | 'configuring';
  config: Record<string, unknown>;
  webhook_url: string | null;
  last_message_at: string | null;
  message_count: number;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AlertRule {
  id: string;
  workspace_id: string | null;
  name: string;
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==';
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  cooldown_minutes: number;
  is_enabled: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

export interface PromptAbTest {
  id: string;
  agent_id: string | null;
  name: string;
  variant_a_prompt_id: string | null;
  variant_b_prompt_id: string | null;
  traffic_split: number;
  status: 'draft' | 'running' | 'completed' | 'cancelled';
  winner: string | null;
  metrics: Record<string, unknown>;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Environment {
  id: string;
  workspace_id: string | null;
  name: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface VectorIndex {
  id: string;
  knowledge_base_id: string | null;
  provider: string;
  model: string;
  dimensions: number;
  status: string;
  config: Record<string, unknown>;
  created_at: string;
}

export interface ToolPolicy {
  id: string;
  agent_id: string | null;
  tool_integration_id: string | null;
  environment: string;
  is_allowed: boolean;
  max_calls_per_run: number | null;
  requires_approval: boolean;
  config: Record<string, unknown>;
  created_at: string;
}

/**
 * All new table names for runtime reference.
 */
export const EXTENDED_TABLES = [
  'agent_memories', 'model_pricing', 'workflow_runs', 'workflow_step_runs',
  'deploy_connections', 'alert_rules', 'prompt_ab_tests', 'environments',
  'vector_indexes', 'tool_policies',
] as const;
