/**
 * Nexus Agents Studio — Execution History & Replay Service
 *
 * Comprehensive audit trail for all automations with input/output
 * capture, timing, replay capability, and execution comparison.
 *
 * Inspired by: n8n Execution History, Temporal Event History,
 * Windmill Execution Logs, Activepieces Run History.
 *
 * Gap 7/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type ExecutionType = 'workflow' | 'agent' | 'automation' | 'webhook' | 'schedule' | 'manual';
export type ExecutionStatus = 'running' | 'success' | 'failed' | 'cancelled' | 'timeout' | 'waiting';

export interface ExecutionRecord {
  id: string;
  execution_type: ExecutionType;
  source_id: string;
  source_name: string;
  status: ExecutionStatus;
  trigger: string;
  input_data: Record<string, unknown>;
  output_data: Record<string, unknown> | null;
  error: string | null;
  error_stack: string | null;
  steps: ExecutionStepRecord[];
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
  tokens_used: number;
  cost_brl: number;
  retry_of: string | null;
  parent_execution_id: string | null;
  tags: string[];
  created_by: string | null;
}

export interface ExecutionStepRecord {
  step_id: string;
  step_name: string;
  step_type: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  started_at: string;
  completed_at: string | null;
  duration_ms: number | null;
}

export interface ExecutionFilter {
  execution_type?: ExecutionType;
  source_id?: string;
  status?: ExecutionStatus;
  trigger?: string;
  from_date?: string;
  to_date?: string;
  min_duration_ms?: number;
  max_duration_ms?: number;
  has_error?: boolean;
  tag?: string;
  search?: string;
}

export interface ExecutionComparison {
  execution_a: ExecutionRecord;
  execution_b: ExecutionRecord;
  duration_diff_ms: number;
  duration_diff_pct: number;
  token_diff: number;
  cost_diff_brl: number;
  status_match: boolean;
  step_diffs: Array<{
    step_name: string;
    a_duration_ms: number | null;
    b_duration_ms: number | null;
    diff_ms: number;
    a_status: ExecutionStatus;
    b_status: ExecutionStatus;
  }>;
}

export interface ExecutionTimeline {
  hour: string;
  total: number;
  success: number;
  failed: number;
  avg_duration_ms: number;
}

/* ------------------------------------------------------------------ */
/*  Recording                                                          */
/* ------------------------------------------------------------------ */

export async function startExecution(
  type: ExecutionType,
  sourceId: string,
  sourceName: string,
  trigger: string,
  inputData: Record<string, unknown>,
  parentId?: string,
  tags?: string[],
): Promise<ExecutionRecord> {
  const { data: userData } = await supabase.auth.getUser();

  const { data, error } = await fromTable('execution_history')
    .insert({
      execution_type: type,
      source_id: sourceId,
      source_name: sourceName,
      status: 'running',
      trigger,
      input_data: inputData,
      steps: [],
      tokens_used: 0,
      cost_brl: 0,
      parent_execution_id: parentId ?? null,
      tags: tags ?? [],
      created_by: userData?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as ExecutionRecord;
}

export async function completeExecution(
  id: string,
  outputData: Record<string, unknown>,
  tokensUsed?: number,
  costBrl?: number,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await fromTable('execution_history')
    .select('started_at')
    .eq('id', id)
    .single();

  const durationMs = existing
    ? new Date(now).getTime() - new Date(existing.started_at).getTime()
    : null;

  const { error } = await fromTable('execution_history')
    .update({
      status: 'success',
      output_data: outputData,
      completed_at: now,
      duration_ms: durationMs,
      tokens_used: tokensUsed ?? 0,
      cost_brl: costBrl ?? 0,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function failExecution(
  id: string,
  errorMsg: string,
  errorStack?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await fromTable('execution_history')
    .select('started_at')
    .eq('id', id)
    .single();

  const durationMs = existing
    ? new Date(now).getTime() - new Date(existing.started_at).getTime()
    : null;

  const { error } = await fromTable('execution_history')
    .update({
      status: 'failed',
      error: errorMsg,
      error_stack: errorStack ?? null,
      completed_at: now,
      duration_ms: durationMs,
    })
    .eq('id', id);
  if (error) throw error;
}

export async function recordStep(
  executionId: string,
  step: ExecutionStepRecord,
): Promise<void> {
  const { data: existing, error: fetchError } = await fromTable('execution_history')
    .select('steps')
    .eq('id', executionId)
    .single();
  if (fetchError) throw fetchError;

  const steps = [...((existing?.steps as ExecutionStepRecord[]) ?? []), step];

  const { error } = await fromTable('execution_history')
    .update({ steps })
    .eq('id', executionId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Querying                                                           */
/* ------------------------------------------------------------------ */

export async function listExecutions(
  filters?: ExecutionFilter,
  limit: number = 50,
  offset: number = 0,
): Promise<{ data: ExecutionRecord[]; total: number }> {
  let query = fromTable('execution_history')
    .select('*', { count: 'exact' })
    .order('started_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters?.execution_type) query = query.eq('execution_type', filters.execution_type);
  if (filters?.source_id) query = query.eq('source_id', filters.source_id);
  if (filters?.status) query = query.eq('status', filters.status);
  if (filters?.trigger) query = query.eq('trigger', filters.trigger);
  if (filters?.from_date) query = query.gte('started_at', filters.from_date);
  if (filters?.to_date) query = query.lte('started_at', filters.to_date);
  if (filters?.min_duration_ms) query = query.gte('duration_ms', filters.min_duration_ms);
  if (filters?.max_duration_ms) query = query.lte('duration_ms', filters.max_duration_ms);
  if (filters?.has_error) query = query.not('error', 'is', null);
  if (filters?.tag) query = query.contains('tags', [filters.tag]);
  if (filters?.search) query = query.ilike('source_name', `%${filters.search}%`);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as ExecutionRecord[], total: count ?? 0 };
}

export async function getExecution(id: string): Promise<ExecutionRecord | null> {
  const { data, error } = await fromTable('execution_history')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as ExecutionRecord | null;
}

/* ------------------------------------------------------------------ */
/*  Replay                                                             */
/* ------------------------------------------------------------------ */

export async function replayExecution(
  originalId: string,
  inputOverrides?: Record<string, unknown>,
): Promise<ExecutionRecord> {
  const original = await getExecution(originalId);
  if (!original) throw new Error(`Execution ${originalId} not found`);

  const inputData = inputOverrides
    ? { ...original.input_data, ...inputOverrides }
    : original.input_data;

  return startExecution(
    original.execution_type,
    original.source_id,
    original.source_name,
    `replay:${originalId}`,
    inputData,
    undefined,
    [...original.tags, 'replay'],
  );
}

/* ------------------------------------------------------------------ */
/*  Comparison                                                         */
/* ------------------------------------------------------------------ */

export function compareExecutions(
  a: ExecutionRecord,
  b: ExecutionRecord,
): ExecutionComparison {
  const aDuration = a.duration_ms ?? 0;
  const bDuration = b.duration_ms ?? 0;
  const durationDiff = bDuration - aDuration;
  const durationDiffPct = aDuration > 0 ? (durationDiff / aDuration) * 100 : 0;

  const stepDiffs = a.steps.map((stepA) => {
    const stepB = b.steps.find((s) => s.step_name === stepA.step_name);
    return {
      step_name: stepA.step_name,
      a_duration_ms: stepA.duration_ms,
      b_duration_ms: stepB?.duration_ms ?? null,
      diff_ms: (stepB?.duration_ms ?? 0) - (stepA.duration_ms ?? 0),
      a_status: stepA.status,
      b_status: stepB?.status ?? ('cancelled' as ExecutionStatus),
    };
  });

  return {
    execution_a: a,
    execution_b: b,
    duration_diff_ms: durationDiff,
    duration_diff_pct: durationDiffPct,
    token_diff: b.tokens_used - a.tokens_used,
    cost_diff_brl: b.cost_brl - a.cost_brl,
    status_match: a.status === b.status,
    step_diffs: stepDiffs,
  };
}

/* ------------------------------------------------------------------ */
/*  Timeline & Analytics                                               */
/* ------------------------------------------------------------------ */

export async function getExecutionTimeline(
  hours: number = 24,
): Promise<ExecutionTimeline[]> {
  const since = new Date();
  since.setHours(since.getHours() - hours);

  const { data, error } = await fromTable('execution_history')
    .select('started_at, status, duration_ms')
    .gte('started_at', since.toISOString());
  if (error) throw error;

  const buckets = new Map<string, { total: number; success: number; failed: number; durations: number[] }>();

  for (const item of data ?? []) {
    const hour = new Date(item.started_at).toISOString().substring(0, 13) + ':00';
    const bucket = buckets.get(hour) ?? { total: 0, success: 0, failed: 0, durations: [] };

    bucket.total++;
    if (item.status === 'success') bucket.success++;
    if (item.status === 'failed') bucket.failed++;
    if (item.duration_ms) bucket.durations.push(item.duration_ms);

    buckets.set(hour, bucket);
  }

  return Array.from(buckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([hour, b]) => ({
      hour,
      total: b.total,
      success: b.success,
      failed: b.failed,
      avg_duration_ms:
        b.durations.length > 0
          ? b.durations.reduce((a, v) => a + v, 0) / b.durations.length
          : 0,
    }));
}

export async function getExecutionStats(
  timeframeHours: number = 24,
): Promise<{
  total: number;
  success: number;
  failed: number;
  running: number;
  success_rate: number;
  avg_duration_ms: number;
  total_tokens: number;
  total_cost_brl: number;
  by_type: Record<ExecutionType, number>;
}> {
  const since = new Date();
  since.setHours(since.getHours() - timeframeHours);

  const { data, error } = await fromTable('execution_history')
    .select('status, execution_type, duration_ms, tokens_used, cost_brl')
    .gte('started_at', since.toISOString());
  if (error) throw error;

  const items = data ?? [];
  const success = items.filter((i) => i.status === 'success');
  const failed = items.filter((i) => i.status === 'failed');
  const running = items.filter((i) => i.status === 'running');
  const durations = items.map((i) => i.duration_ms).filter((d): d is number => d !== null);
  const byType = {} as Record<ExecutionType, number>;

  for (const item of items) {
    const t = item.execution_type as ExecutionType;
    byType[t] = (byType[t] ?? 0) + 1;
  }

  return {
    total: items.length,
    success: success.length,
    failed: failed.length,
    running: running.length,
    success_rate: items.length > 0 ? (success.length / items.length) * 100 : 0,
    avg_duration_ms: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    total_tokens: items.reduce((s, i) => s + (i.tokens_used ?? 0), 0),
    total_cost_brl: items.reduce((s, i) => s + (i.cost_brl ?? 0), 0),
    by_type: byType,
  };
}

/* ------------------------------------------------------------------ */
/*  Cleanup                                                            */
/* ------------------------------------------------------------------ */

export async function purgeOldExecutions(
  olderThanDays: number = 30,
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  const { data, error } = await fromTable('execution_history')
    .delete()
    .lt('started_at', cutoff.toISOString())
    .select('id');
  if (error) throw error;
  return data?.length ?? 0;
}
