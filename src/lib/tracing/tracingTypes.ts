/**
 * Tracing — Type Definitions
 */

export type SpanKind =
  | 'llm'
  | 'tool'
  | 'rag'
  | 'guardrail'
  | 'memory'
  | 'workflow'
  | 'http'
  | 'db'
  | 'custom';

export type SpanStatus = 'unset' | 'ok' | 'error';

export interface SpanAttributes {
  'gen_ai.system'?: string;
  'gen_ai.request.model'?: string;
  'gen_ai.request.temperature'?: number;
  'gen_ai.request.max_tokens'?: number;
  'gen_ai.usage.input_tokens'?: number;
  'gen_ai.usage.output_tokens'?: number;
  'cost.usd'?: number;
  [key: string]: unknown;
}

export interface SpanData {
  span_id: string;
  parent_span_id: string | null;
  trace_id: string;
  name: string;
  kind: SpanKind;
  start_time: number;
  end_time: number | null;
  duration_ms: number | null;
  status: SpanStatus;
  status_message?: string;
  input?: unknown;
  output?: unknown;
  attributes: SpanAttributes;
  events: Array<{ name: string; timestamp: number; attributes?: Record<string, unknown> }>;
}

export interface TraceData {
  trace_id: string;
  agent_id?: string;
  session_id?: string;
  user_id?: string;
  workflow_id?: string;
  start_time: number;
  end_time: number | null;
  status: 'running' | 'ok' | 'error';
  spans: SpanData[];
}

export interface TraceOptions {
  agentId?: string;
  sessionId?: string;
  userId?: string;
  workflowId?: string;
  rootName?: string;
}

export interface LegacySpanInput {
  name: string;
  type: SpanKind;
  model?: string;
  input?: string;
  output?: string;
  inputTokens?: number;
  outputTokens?: number;
  costUsd?: number;
  durationMs?: number;
  status?: 'success' | 'error';
  metadata?: Record<string, unknown>;
}
