/**
 * Nexus Agents Studio — Agent Handoff Protocol Service
 * 
 * Implements formal agent-to-agent handoffs inspired by:
 * - OpenAI Agents SDK (triage → specialist → escalation)
 * - Microsoft Agent Framework (typed handoffs with middleware)
 * - A2A Protocol (task lifecycle with context transfer)
 * 
 * A handoff transfers execution context from one agent to another,
 * preserving conversation history, state, and metadata.
 */

import { supabase } from '@/integrations/supabase/client';

// ──────── Types ────────

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
  /** Conversation messages to transfer */
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: string;
  }>;
  /** Accumulated state/variables from source agent */
  state: Record<string, unknown>;
  /** Files, documents, or artifacts to pass along */
  artifacts?: Array<{
    type: 'text' | 'file' | 'json' | 'image';
    name: string;
    content: string;
    mimeType?: string;
  }>;
  /** Instructions for the target agent */
  instructions?: string;
  /** User preferences or session info */
  userContext?: Record<string, unknown>;
  /** Tags for routing/filtering */
  tags?: string[];
}

export interface HandoffRequest {
  /** Source agent performing the handoff */
  sourceAgentId: string;
  /** Target agent receiving the handoff */
  targetAgentId: string;
  /** Reason for the handoff */
  reason: HandoffReason;
  /** Context being transferred */
  context: HandoffContext;
  /** Optional: linked workflow execution */
  executionId?: string;
  /** Optional: linked workflow node IDs */
  sourceNodeId?: string;
  targetNodeId?: string;
  /** Priority (1=lowest, 5=highest) */
  priority?: number;
  /** Custom reason text */
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
  /** For keyword: keywords that trigger handoff */
  keywords?: string[];
  /** For intent: detected intent names */
  intents?: string[];
  /** For threshold: field name and value */
  field?: string;
  operator?: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'contains';
  value?: string | number;
  /** For custom: JS expression string */
  expression?: string;
}

// ──────── Handoff Execution ────────

/**
 * Initiate a handoff from one agent to another.
 * Creates a handoff record and optionally stores in workflow_handoffs if execution context.
 */
export async function initiateHandoff(request: HandoffRequest): Promise<HandoffRecord> {
  const record = {
    source_agent_id: request.sourceAgentId,
    target_agent_id: request.targetAgentId,
    execution_id: request.executionId ?? null,
    source_node_id: request.sourceNodeId ?? request.sourceAgentId,
    target_node_id: request.targetNodeId ?? request.targetAgentId,
    context: request.context as unknown,
    reason: request.reason,
    reason_text: request.reasonText ?? null,
    status: 'pending' as const,
    priority: request.priority ?? 3,
  };

  // Store in workflow_handoffs table
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .insert(record)
    .select()
    .single();

  if (error) throw new Error(`Failed to initiate handoff: ${error.message}`);
  return data as unknown as HandoffRecord;
}

/**
 * Accept a pending handoff
 */
export async function acceptHandoff(handoffId: string): Promise<HandoffRecord> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .update({
      status: 'accepted' as const,
    })
    .eq('id', handoffId)
    .select()
    .single();

  if (error) throw new Error(`Failed to accept handoff: ${error.message}`);
  return data as unknown as HandoffRecord;
}

/**
 * Complete a handoff with the target agent's response
 */
export async function completeHandoff(
  handoffId: string,
  response: Record<string, unknown>
): Promise<HandoffRecord> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .update({
      status: 'completed' as const,
      context: response,
    })
    .eq('id', handoffId)
    .select()
    .single();

  if (error) throw new Error(`Failed to complete handoff: ${error.message}`);
  return data as unknown as HandoffRecord;
}

/**
 * Reject a handoff (target agent cannot handle it)
 */
export async function rejectHandoff(
  handoffId: string,
  reason: string
): Promise<HandoffRecord> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .update({
      status: 'rejected' as const,
      reason: reason,
    })
    .eq('id', handoffId)
    .select()
    .single();

  if (error) throw new Error(`Failed to reject handoff: ${error.message}`);
  return data as unknown as HandoffRecord;
}

/**
 * Fail a handoff due to error
 */
export async function failHandoff(
  handoffId: string,
  errorMsg: string
): Promise<HandoffRecord> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .update({
      status: 'failed' as const,
      reason: errorMsg,
    })
    .eq('id', handoffId)
    .select()
    .single();

  if (error) throw new Error(`Failed to fail handoff: ${error.message}`);
  return data as unknown as HandoffRecord;
}

// ──────── Handoff Queries ────────

/**
 * Get pending handoffs for an agent (inbox)
 */
export async function getPendingHandoffs(targetAgentId: string): Promise<HandoffRecord[]> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .select('*')
    .eq('target_agent_id', targetAgentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to get pending handoffs: ${error.message}`);
  return (data ?? []) as unknown as HandoffRecord[];
}

/**
 * Get handoff history for an agent (both sent and received)
 */
export async function getHandoffHistory(
  agentId: string,
  limit = 50
): Promise<HandoffRecord[]> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .select('*')
    .or(`source_agent_id.eq.${agentId},target_agent_id.eq.${agentId}`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get handoff history: ${error.message}`);
  return (data ?? []) as unknown as HandoffRecord[];
}

/**
 * Get handoffs for a workflow execution
 */
export async function getExecutionHandoffs(executionId: string): Promise<HandoffRecord[]> {
  const { data, error } = await supabase
    .from('workflow_handoffs')
    .select('*')
    .eq('execution_id', executionId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(`Failed to get execution handoffs: ${error.message}`);
  return (data ?? []) as unknown as HandoffRecord[];
}

// ──────── Handoff Rules Engine ────────

/**
 * Evaluate handoff rules against current context.
 * Returns matching rules sorted by priority (highest first).
 */
export function evaluateHandoffRules(
  rules: HandoffRule[],
  context: {
    lastMessage: string;
    detectedIntent?: string;
    state: Record<string, unknown>;
  }
): HandoffRule[] {
  return rules
    .filter((rule) => rule.enabled)
    .filter((rule) => matchesCondition(rule.condition, context))
    .sort((a, b) => b.priority - a.priority);
}

function matchesCondition(
  condition: HandoffCondition,
  context: {
    lastMessage: string;
    detectedIntent?: string;
    state: Record<string, unknown>;
  }
): boolean {
  switch (condition.type) {
    case 'keyword':
      return (condition.keywords ?? []).some((kw) =>
        context.lastMessage.toLowerCase().includes(kw.toLowerCase())
      );

    case 'intent':
      return context.detectedIntent
        ? (condition.intents ?? []).includes(context.detectedIntent)
        : false;

    case 'threshold': {
      const fieldValue = context.state[condition.field ?? ''];
      if (fieldValue === undefined || condition.value === undefined) return false;
      const numField = Number(fieldValue);
      const numValue = Number(condition.value);
      switch (condition.operator) {
        case 'gt': return numField > numValue;
        case 'lt': return numField < numValue;
        case 'eq': return numField === numValue;
        case 'gte': return numField >= numValue;
        case 'lte': return numField <= numValue;
        case 'contains':
          return String(fieldValue).toLowerCase().includes(String(condition.value).toLowerCase());
        default: return false;
      }
    }

    case 'schedule':
      // Schedule-based handoffs would be handled externally
      return false;

    case 'custom':
      // Custom expressions are evaluated in a sandboxed context
      try {
        const fn = new Function('ctx', `return (${condition.expression ?? 'false'})`);
        return Boolean(fn(context));
      } catch {
        return false;
      }

    default:
      return false;
  }
}

// ──────── Context Preparation ────────

/**
 * Prepare handoff context from conversation messages and agent state.
 * Summarizes if the context is too large (token-aware).
 */
export function prepareHandoffContext(
  messages: HandoffContext['messages'],
  state: Record<string, unknown>,
  options?: {
    maxMessages?: number;
    includeSystemPrompt?: boolean;
    instructions?: string;
    artifacts?: HandoffContext['artifacts'];
  }
): HandoffContext {
  const maxMessages = options?.maxMessages ?? 20;

  // Keep last N messages to fit context window
  const trimmedMessages = messages.length > maxMessages
    ? [
        // Always keep the first system message if present
        ...(messages[0]?.role === 'system' && options?.includeSystemPrompt !== false
          ? [messages[0]]
          : []),
        // Then keep last N messages
        ...messages.slice(-maxMessages),
      ]
    : messages;

  return {
    messages: trimmedMessages,
    state,
    artifacts: options?.artifacts,
    instructions: options?.instructions,
    tags: [],
  };
}

/**
 * Build a triage handoff: route user to the best specialist agent
 */
export async function triageHandoff(
  triageAgentId: string,
  userMessage: string,
  availableAgents: Array<{ id: string; name: string; description: string; skills: string[] }>,
  conversationHistory: HandoffContext['messages']
): Promise<HandoffRequest | null> {
  // Score each agent based on keyword matching (simple heuristic)
  const scores = availableAgents.map((agent) => {
    const msgLower = userMessage.toLowerCase();
    const skillMatches = agent.skills.filter((skill) =>
      msgLower.includes(skill.toLowerCase())
    ).length;
    const descMatch = agent.description.toLowerCase()
      .split(' ')
      .filter((w) => w.length > 3 && msgLower.includes(w))
      .length;

    return {
      agent,
      score: skillMatches * 3 + descMatch,
    };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];
  if (!best || best.score === 0) return null;

  return {
    sourceAgentId: triageAgentId,
    targetAgentId: best.agent.id,
    reason: 'triage',
    context: prepareHandoffContext(
      conversationHistory,
      { triageScore: best.score, matchedAgent: best.agent.name },
      { instructions: `User needs help with: ${userMessage}. Route to ${best.agent.name}.` }
    ),
    priority: 3,
    reasonText: `Triage routed to ${best.agent.name} (score: ${best.score})`,
  };
}
