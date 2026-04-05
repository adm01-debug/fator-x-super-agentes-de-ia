/**
 * Nexus Agents Studio — Workflow Checkpointing Service
 * 
 * Inspired by LangGraph's durable execution model:
 * - Persists state after every node execution
 * - Enables crash recovery (resume from last checkpoint)
 * - Time-travel debugging (inspect/fork/replay from any point)
 * - Cost tracking per node and per execution
 */

import { supabase } from '@/integrations/supabase/client';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ──────── Types ────────

export interface WorkflowExecution {
  id: string;
  workflow_id: string;
  user_id: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  total_cost_usd: number;
  total_tokens: number;
  total_duration_ms: number;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export interface WorkflowCheckpoint {
  id: string;
  execution_id: string;
  node_id: string;
  node_type: string;
  step_index: number;
  state: Record<string, unknown>;
  node_input: Record<string, unknown> | null;
  node_output: Record<string, unknown> | null;
  cost_usd: number;
  tokens_used: number;
  duration_ms: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  error: string | null;
  created_at: string;
}

export interface CheckpointCreateInput {
  execution_id: string;
  node_id: string;
  node_type: string;
  step_index: number;
  state: Record<string, unknown>;
  node_input?: Record<string, unknown>;
  node_output?: Record<string, unknown>;
  cost_usd?: number;
  tokens_used?: number;
  duration_ms?: number;
  status?: WorkflowCheckpoint['status'];
  error?: string;
}

export interface TimeTravelForkInput {
  checkpoint_id: string;
  modified_state?: Record<string, unknown>;
  modified_input?: Record<string, unknown>;
}

// ──────── Execution Management ────────

/** Start a new workflow execution run */
export async function startExecution(
  workflowId: string,
  input: Record<string, unknown> = {}
): Promise<WorkflowExecution> {
  const { data, error } = await db.from('workflow_executions')
    .insert({
      workflow_id: workflowId,
      input,
      status: 'running',
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to start execution: ${error.message}`);
  return data as unknown as WorkflowExecution;
}

/** Update execution status */
export async function updateExecution(
  executionId: string,
  updates: Partial<Pick<WorkflowExecution, 'status' | 'output' | 'error' | 'total_cost_usd' | 'total_tokens' | 'total_duration_ms' | 'completed_at'>>
): Promise<WorkflowExecution> {
  const { data, error } = await db.from('workflow_executions')
    .update(updates)
    .eq('id' as never, executionId)
    .select()
    .single();

  if (error) throw new Error(`Failed to update execution: ${error.message}`);
  return data as unknown as WorkflowExecution;
}

/** Complete an execution with final output */
export async function completeExecution(
  executionId: string,
  output: Record<string, unknown>
): Promise<WorkflowExecution> {
  // Aggregate totals from all checkpoints
  const { data: checkpoints } = await db.from('workflow_checkpoints')
    .select('cost_usd, tokens_used, duration_ms')
    .eq('execution_id' as never, executionId);

  const totals = (checkpoints ?? []).reduce(
    (acc, cp) => ({
      cost: acc.cost + Number(cp.cost_usd ?? 0),
      tokens: acc.tokens + Number(cp.tokens_used ?? 0),
      duration: acc.duration + Number(cp.duration_ms ?? 0),
    }),
    { cost: 0, tokens: 0, duration: 0 }
  );

  return updateExecution(executionId, {
    status: 'completed',
    output,
    total_cost_usd: totals.cost,
    total_tokens: totals.tokens,
    total_duration_ms: totals.duration,
    completed_at: new Date().toISOString(),
  });
}

/** Fail an execution with error */
export async function failExecution(
  executionId: string,
  errorMsg: string
): Promise<WorkflowExecution> {
  return updateExecution(executionId, {
    status: 'failed',
    error: errorMsg,
    completed_at: new Date().toISOString(),
  });
}

/** Pause an execution for human-in-the-loop */
export async function pauseExecution(
  executionId: string
): Promise<WorkflowExecution> {
  return updateExecution(executionId, { status: 'paused' });
}

/** Resume a paused execution */
export async function resumeExecution(
  executionId: string
): Promise<WorkflowExecution> {
  return updateExecution(executionId, { status: 'running' });
}

/** List executions for a workflow */
export async function listExecutions(
  workflowId: string,
  limit = 20
): Promise<WorkflowExecution[]> {
  const { data, error } = await db.from('workflow_executions')
    .select('*')
    .eq('workflow_id' as never, workflowId)
    .order('created_at' as never, { ascending: false })
    .limit(limit);

  if (error) throw new Error(`Failed to list executions: ${error.message}`);
  return (data ?? []) as unknown as WorkflowExecution[];
}

/** Get a single execution with its checkpoints */
export async function getExecution(executionId: string): Promise<WorkflowExecution> {
  const { data, error } = await db.from('workflow_executions')
    .select('*')
    .eq('id' as never, executionId)
    .single();

  if (error) throw new Error(`Failed to get execution: ${error.message}`);
  return data as unknown as WorkflowExecution;
}

// ──────── Checkpoint Management ────────

/** Save a checkpoint after node execution */
export async function saveCheckpoint(input: CheckpointCreateInput): Promise<WorkflowCheckpoint> {
  const { data, error } = await db.from('workflow_checkpoints')
    .insert({
      execution_id: input.execution_id,
      node_id: input.node_id,
      node_type: input.node_type,
      step_index: input.step_index,
      state: input.state,
      node_input: input.node_input ?? null,
      node_output: input.node_output ?? null,
      cost_usd: input.cost_usd ?? 0,
      tokens_used: input.tokens_used ?? 0,
      duration_ms: input.duration_ms ?? 0,
      status: input.status ?? 'completed',
      error: input.error ?? null,
    })
    .select()
    .single();

  if (error) throw new Error(`Failed to save checkpoint: ${error.message}`);
  return data as unknown as WorkflowCheckpoint;
}

/** Get all checkpoints for an execution (ordered by step) */
export async function getCheckpoints(executionId: string): Promise<WorkflowCheckpoint[]> {
  const { data, error } = await db.from('workflow_checkpoints')
    .select('*')
    .eq('execution_id' as never, executionId)
    .order('step_index' as never, { ascending: true });

  if (error) throw new Error(`Failed to get checkpoints: ${error.message}`);
  return (data ?? []) as unknown as WorkflowCheckpoint[];
}

/** Get the last checkpoint for an execution (for crash recovery) */
export async function getLastCheckpoint(executionId: string): Promise<WorkflowCheckpoint | null> {
  const { data, error } = await db.from('workflow_checkpoints')
    .select('*')
    .eq('execution_id' as never, executionId)
    .eq('status' as never, 'completed')
    .order('step_index' as never, { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to get last checkpoint: ${error.message}`);
  return data as unknown as WorkflowCheckpoint | null;
}

/** Get a specific checkpoint by ID */
export async function getCheckpoint(checkpointId: string): Promise<WorkflowCheckpoint> {
  const { data, error } = await db.from('workflow_checkpoints')
    .select('*')
    .eq('id' as never, checkpointId)
    .single();

  if (error) throw new Error(`Failed to get checkpoint: ${error.message}`);
  return data as unknown as WorkflowCheckpoint;
}

// ──────── Time-Travel ────────

/**
 * Fork an execution from a specific checkpoint.
 * Creates a new execution starting from the checkpoint's state,
 * optionally with modified state/input for "what-if" scenarios.
 */
export async function forkFromCheckpoint(
  input: TimeTravelForkInput
): Promise<{ execution: WorkflowExecution; checkpoint: WorkflowCheckpoint }> {
  // Get the source checkpoint and its execution
  const sourceCheckpoint = await getCheckpoint(input.checkpoint_id);
  const sourceExecution = await getExecution(sourceCheckpoint.execution_id);

  // Create a new execution as a fork
  const forkedState = input.modified_state
    ? { ...sourceCheckpoint.state, ...input.modified_state }
    : sourceCheckpoint.state;

  const forkedInput = input.modified_input
    ? { ...sourceExecution.input, ...input.modified_input }
    : sourceExecution.input;

  const newExecution = await startExecution(sourceExecution.workflow_id, {
    ...forkedInput,
    _forked_from: {
      execution_id: sourceExecution.id,
      checkpoint_id: sourceCheckpoint.id,
      step_index: sourceCheckpoint.step_index,
    },
  });

  // Copy all checkpoints up to (and including) the fork point
  const checkpoints = await getCheckpoints(sourceExecution.id);
  const checkpointsToClone = checkpoints.filter(
    (cp) => cp.step_index <= sourceCheckpoint.step_index
  );

  let lastCloned: WorkflowCheckpoint | null = null;
  for (const cp of checkpointsToClone) {
    const isLastOne = cp.id === sourceCheckpoint.id;
    lastCloned = await saveCheckpoint({
      execution_id: newExecution.id,
      node_id: cp.node_id,
      node_type: cp.node_type,
      step_index: cp.step_index,
      state: isLastOne ? forkedState : cp.state,
      node_input: cp.node_input ?? undefined,
      node_output: cp.node_output ?? undefined,
      cost_usd: cp.cost_usd,
      tokens_used: cp.tokens_used,
      duration_ms: cp.duration_ms,
      status: cp.status as WorkflowCheckpoint['status'],
    });
  }

  return {
    execution: newExecution,
    checkpoint: lastCloned ?? sourceCheckpoint,
  };
}

/**
 * Get execution timeline for time-travel UI.
 * Returns checkpoints with computed cumulative cost/tokens.
 */
export async function getExecutionTimeline(executionId: string): Promise<Array<
  WorkflowCheckpoint & {
    cumulative_cost_usd: number;
    cumulative_tokens: number;
    cumulative_duration_ms: number;
  }
>> {
  const checkpoints = await getCheckpoints(executionId);

  let cumulativeCost = 0;
  let cumulativeTokens = 0;
  let cumulativeDuration = 0;

  return checkpoints.map((cp) => {
    cumulativeCost += Number(cp.cost_usd);
    cumulativeTokens += Number(cp.tokens_used);
    cumulativeDuration += Number(cp.duration_ms);

    return {
      ...cp,
      cumulative_cost_usd: cumulativeCost,
      cumulative_tokens: cumulativeTokens,
      cumulative_duration_ms: cumulativeDuration,
    };
  });
}

// ──────── Crash Recovery ────────

/**
 * Find executions that crashed (running but old) and can be recovered.
 */
export async function findRecoverableExecutions(
  workflowId: string,
  staleAfterMinutes = 30
): Promise<WorkflowExecution[]> {
  const staleThreshold = new Date(
    Date.now() - staleAfterMinutes * 60 * 1000
  ).toISOString();

  const { data, error } = await db.from('workflow_executions')
    .select('*')
    .eq('workflow_id' as never, workflowId)
    .eq('status' as never, 'running')
    .lt('started_at' as never, staleThreshold)
    .order('started_at' as never, { ascending: false });

  if (error) throw new Error(`Failed to find recoverable executions: ${error.message}`);
  return (data ?? []) as unknown as WorkflowExecution[];
}

/**
 * Recover a crashed execution by resuming from last successful checkpoint.
 * Returns the execution and the checkpoint to resume from.
 */
export async function recoverExecution(
  executionId: string
): Promise<{ execution: WorkflowExecution; resumeFrom: WorkflowCheckpoint | null }> {
  const execution = await getExecution(executionId);
  if (execution.status !== 'running' && execution.status !== 'paused') {
    throw new Error(`Cannot recover execution in status: ${execution.status}`);
  }

  const lastCheckpoint = await getLastCheckpoint(executionId);
  const updatedExecution = await updateExecution(executionId, { status: 'running' });

  return {
    execution: updatedExecution,
    resumeFrom: lastCheckpoint,
  };
}
