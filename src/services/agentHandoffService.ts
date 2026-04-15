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

// supabaseExternal import removed — this service uses fromTable for untyped tables

// eslint-disable-next-line @typescript-eslint/no-explicit-any
import { fromTable } from '@/lib/supabaseExtended';

export type { HandoffReason, HandoffStatus, HandoffContext, HandoffRequest, HandoffRecord, HandoffRule, HandoffCondition } from './types/agentHandoffTypes';
import type { HandoffContext, HandoffRequest, HandoffRecord, HandoffRule, HandoffCondition } from './types/agentHandoffTypes';

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
  const { data, error } = await fromTable('workflow_handoffs')
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
  const { data, error } = await fromTable('workflow_handoffs')
    .update({
      status: 'accepted' as const,
    })
    .eq('id' as never, handoffId)
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
  const { data, error } = await fromTable('workflow_handoffs')
    .update({
      status: 'completed' as const,
      context: response,
    })
    .eq('id' as never, handoffId)
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
  const { data, error } = await fromTable('workflow_handoffs')
    .update({
      status: 'rejected' as const,
      reason: reason,
    })
    .eq('id' as never, handoffId)
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
  const { data, error } = await fromTable('workflow_handoffs')
    .update({
      status: 'failed' as const,
      reason: errorMsg,
    })
    .eq('id' as never, handoffId)
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
  const { data, error } = await fromTable('workflow_handoffs')
    .select('*')
    .eq('target_agent_id' as never, targetAgentId)
    .eq('status' as never, 'pending')
    .order('created_at' as never, { ascending: false });

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
  const { data, error } = await fromTable('workflow_handoffs')
    .select('*')
    .or(`source_agent_id.eq.${agentId},target_agent_id.eq.${agentId}`)
    .order('created_at' as never, { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to get handoff history: ${error.message}`);
  return (data ?? []) as unknown as HandoffRecord[];
}

/**
 * Get handoffs for a workflow execution
 */
export async function getExecutionHandoffs(executionId: string): Promise<HandoffRecord[]> {
  const { data, error } = await fromTable('workflow_handoffs')
    .select('*')
    .eq('execution_id' as never, executionId)
    .order('created_at' as never, { ascending: true });

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
      // Custom expressions are NOT evaluated via eval/new Function for security.
      // Instead, we support a limited set of declarative checks:
      // expression format: "field_name operator value" e.g. "confidence gt 0.8"
      try {
        const expr = (condition.expression ?? '').trim();
        const parts = expr.split(/\s+/);
        if (parts.length === 3) {
          const [fieldName, op, val] = parts;
          const fieldVal = context.state[fieldName];
          if (fieldVal === undefined) return false;
          const numField = Number(fieldVal);
          const numVal = Number(val);
          switch (op) {
            case 'gt': return numField > numVal;
            case 'lt': return numField < numVal;
            case 'eq': return String(fieldVal) === val;
            case 'gte': return numField >= numVal;
            case 'lte': return numField <= numVal;
            case 'contains': return String(fieldVal).toLowerCase().includes(val.toLowerCase());
            case 'exists': return fieldVal !== undefined && fieldVal !== null;
            default: return false;
          }
        }
        // Simple boolean field check: "fieldName"
        if (parts.length === 1) {
          return Boolean(context.state[parts[0]]);
        }
        return false;
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
