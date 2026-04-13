export type HandoffReason =
  | 'skill_mismatch'
  | 'escalation'
  | 'delegation'
  | 'triage'
  | 'human_required'
  | 'load_balancing'
  | 'specialization'
  | 'fallback'
  | 'custom';

export type HandoffStatus =
  | 'pending'
  | 'accepted'
  | 'rejected'
  | 'completed'
  | 'failed'
  | 'cancelled';

export interface HandoffContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
  state: Record<string, unknown>;
  artifacts?: Array<{
    type: 'text' | 'file' | 'json' | 'image';
    name: string;
    content: string;
    mimeType?: string;
  }>;
  instructions?: string;
  userContext?: Record<string, unknown>;
  tags?: string[];
}

export interface HandoffRequest {
  sourceAgentId: string;
  targetAgentId: string;
  reason: HandoffReason;
  context: HandoffContext;
  executionId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
  priority?: number;
  reasonText?: string;
}

export interface HandoffRecord {
  id: string;
  source_agent_id: string;
  target_agent_id: string;
  execution_id: string | null;
  source_node_id: string;
  target_node_id: string;
  context: HandoffContext;
  reason: HandoffReason;
  reason_text: string | null;
  status: HandoffStatus;
  priority: number;
  accepted_at: string | null;
  completed_at: string | null;
  response: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
}

export interface HandoffRule {
  id: string;
  name: string;
  description: string;
  sourceAgentId: string;
  targetAgentId: string;
  condition: HandoffCondition;
  reason: HandoffReason;
  autoAccept: boolean;
  priority: number;
  enabled: boolean;
}

export interface HandoffCondition {
  type: 'keyword' | 'intent' | 'threshold' | 'schedule' | 'custom';
  keywords?: string[];
  intents?: string[];
  metric?: string;
  threshold?: number;
  cronExpression?: string;
  customFn?: string;
  field?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  value?: string | number;
  expression?: string;
}
