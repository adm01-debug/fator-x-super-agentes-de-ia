/**
 * Nexus Agents Studio — Queue Manager Service
 */

import { fromTable } from '@/lib/supabaseExtended';
import { logger } from '@/lib/logger';

export type {
  QueueStrategy, QueueItemStatus, QueueDefinition, QueueItem,
  CreateQueueInput, EnqueueInput, QueueMetrics,
  QueueWorkerRunInput, QueueWorkerRunResult,
} from './types/queueManagerTypes';

import type {
import { supabase } from '@/integrations/supabase/client';
  QueueDefinition, QueueItem, CreateQueueInput, EnqueueInput,
  QueueItemStatus, QueueMetrics, QueueWorkerRunInput, QueueWorkerRunResult,
} from './types/queueManagerTypes';

/* ── Queue CRUD ── */

export async function createQueue(input: CreateQueueInput): Promise<QueueDefinition> {
  const { data, error } = await fromTable('task_queues').insert({
    name: input.name, description: input.description ?? '', strategy: input.strategy ?? 'fifo',
    max_concurrency: input.max_concurrency ?? 5, max_size: input.max_size ?? 10000,
    rate_limit_per_second: input.rate_limit_per_second ?? 10, default_timeout_ms: input.default_timeout_ms ?? 30000,
    default_max_retries: input.default_max_retries ?? 3, dead_letter_queue_id: input.dead_letter_queue_id ?? null,
    is_paused: false, current_size: 0, processed_count: 0, failed_count: 0, avg_processing_ms: 0,
  }).select().single();
  if (error) throw error;
  return data as QueueDefinition;
}

export async function listQueues(): Promise<QueueDefinition[]> {
  const { data, error } = await fromTable('task_queues').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as QueueDefinition[];
}

export async function getQueue(id: string): Promise<QueueDefinition | null> {
  const { data, error } = await fromTable('task_queues').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as QueueDefinition | null;
}

export async function pauseQueue(id: string): Promise<void> {
  const { error } = await fromTable('task_queues').update({ is_paused: true, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function resumeQueue(id: string): Promise<void> {
  const { error } = await fromTable('task_queues').update({ is_paused: false, updated_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function deleteQueue(id: string): Promise<void> {
  await fromTable('queue_items').delete().eq('queue_id', id);
  const { error } = await fromTable('task_queues').delete().eq('id', id);
  if (error) throw error;
}

/* ── Enqueue / Dequeue ── */

export async function enqueue(input: EnqueueInput): Promise<QueueItem> {
  const queue = await getQueue(input.queue_id);
  if (!queue) throw new Error(`Queue ${input.queue_id} not found`);
  if (queue.is_paused) throw new Error(`Queue ${queue.name} is paused`);
  if (queue.current_size >= queue.max_size) throw new Error(`Queue ${queue.name} is full`);

  const { data, error } = await fromTable('queue_items').insert({
    queue_id: input.queue_id, priority: input.priority ?? 0, status: 'pending',
    payload: input.payload, attempt: 0, max_retries: input.max_retries ?? queue.default_max_retries,
    timeout_ms: input.timeout_ms ?? queue.default_timeout_ms, scheduled_at: input.scheduled_at ?? null, tags: input.tags ?? [],
  }).select().single();
  if (error) throw error;
  await fromTable('task_queues').update({ current_size: queue.current_size + 1, updated_at: new Date().toISOString() }).eq('id', input.queue_id);
  return data as QueueItem;
}

export async function enqueueBatch(items: EnqueueInput[]): Promise<QueueItem[]> {
  const results: QueueItem[] = [];
  for (const item of items) results.push(await enqueue(item));
  return results;
}

export async function dequeue(queueId: string, workerId: string, count: number = 1): Promise<QueueItem[]> {
  const queue = await getQueue(queueId);
  if (!queue || queue.is_paused) return [];
  const { data: processing } = await fromTable('queue_items').select('id').eq('queue_id', queueId).eq('status', 'processing');
  if ((processing?.length ?? 0) >= queue.max_concurrency) return [];

  let orderColumn = 'created_at'; let ascending = true;
  if (queue.strategy === 'lifo') ascending = false;
  else if (queue.strategy === 'priority') { orderColumn = 'priority'; ascending = false; }

  const now = new Date();
  const { data: pendingItems, error } = await fromTable('queue_items').select('*').eq('queue_id', queueId).eq('status', 'pending').or(`scheduled_at.is.null,scheduled_at.lte.${now.toISOString()}`).order(orderColumn, { ascending }).limit(count);
  if (error) throw error;

  const locked: QueueItem[] = [];
  for (const item of (pendingItems ?? [])) {
    const lockUntil = new Date(now.getTime() + (item.timeout_ms ?? 30000));
    const { data: updated, error: lockError } = await fromTable('queue_items').update({ status: 'processing', started_at: now.toISOString(), attempt: (item.attempt ?? 0) + 1, locked_by: workerId, locked_until: lockUntil.toISOString() }).eq('id', item.id).eq('status', 'pending').select().single();
    if (!lockError && updated) locked.push(updated as QueueItem);
  }
  return locked;
}

/* ── Completion / Failure ── */

export async function completeItem(itemId: string, result: Record<string, unknown>): Promise<void> {
  const { data: item, error: fetchError } = await fromTable('queue_items').select('queue_id, started_at').eq('id', itemId).single();
  if (fetchError) throw fetchError;
  const now = new Date();
  const durationMs = item?.started_at ? now.getTime() - new Date(item.started_at).getTime() : null;
  const { error } = await fromTable('queue_items').update({ status: 'completed', result, completed_at: now.toISOString(), locked_by: null, locked_until: null }).eq('id', itemId);
  if (error) throw error;
  if (item?.queue_id) {
    const queue = await getQueue(item.queue_id);
    if (queue) {
      const newCount = queue.processed_count + 1;
      const newAvg = queue.avg_processing_ms > 0 ? (queue.avg_processing_ms * queue.processed_count + (durationMs ?? 0)) / newCount : (durationMs ?? 0);
      await fromTable('task_queues').update({ current_size: Math.max(0, queue.current_size - 1), processed_count: newCount, avg_processing_ms: Math.round(newAvg), updated_at: now.toISOString() }).eq('id', item.queue_id);
    }
  }
}

export async function failItem(itemId: string, errorMsg: string): Promise<void> {
  const { data: item, error: fetchError } = await fromTable('queue_items').select('queue_id, attempt, max_retries').eq('id', itemId).single();
  if (fetchError) throw fetchError;
  const shouldRetry = (item?.attempt ?? 0) < (item?.max_retries ?? 3);
  const newStatus: QueueItemStatus = shouldRetry ? 'pending' : 'dead_letter';
  const { error } = await fromTable('queue_items').update({ status: newStatus, error: errorMsg, locked_by: null, locked_until: null, completed_at: newStatus === 'dead_letter' ? new Date().toISOString() : null }).eq('id', itemId);
  if (error) throw error;
  if (newStatus === 'dead_letter' && item?.queue_id) {
    const queue = await getQueue(item.queue_id);
    if (queue) await fromTable('task_queues').update({ current_size: Math.max(0, queue.current_size - 1), failed_count: queue.failed_count + 1, updated_at: new Date().toISOString() }).eq('id', item.queue_id);
  }
}

/* ── Metrics ── */

export async function getQueueMetrics(queueId: string): Promise<QueueMetrics> {
  const queue = await getQueue(queueId);
  if (!queue) throw new Error(`Queue ${queueId} not found`);
  const { data: items, error } = await fromTable('queue_items').select('status, created_at, started_at, completed_at').eq('queue_id', queueId);
  if (error) throw error;
  const all = items ?? [];
  const now = Date.now();
  const pending = all.filter((i: any) => i.status === 'pending');
  const processing = all.filter((i: any) => i.status === 'processing');
  const completed = all.filter((i: any) => i.status === 'completed');
  const failed = all.filter((i: any) => i.status === 'failed');
  const deadLetter = all.filter((i: any) => i.status === 'dead_letter');
  const oneMinuteAgo = new Date(now - 60000).toISOString();
  const recentCompleted = completed.filter((i: any) => i.completed_at && i.completed_at >= oneMinuteAgo);
  const waitTimes = processing.filter((i: any) => i.created_at && i.started_at).map((i: any) => new Date(i.started_at!).getTime() - new Date(i.created_at).getTime());
  const processingTimes = completed.filter((i: any) => i.started_at && i.completed_at).map((i: any) => new Date(i.completed_at!).getTime() - new Date(i.started_at!).getTime());
  const oldestPending = pending.length > 0 ? now - new Date(pending[pending.length - 1].created_at).getTime() : 0;
  return {
    queue_id: queueId, name: queue.name, pending: pending.length, processing: processing.length,
    completed: completed.length, failed: failed.length, dead_letter: deadLetter.length,
    throughput_per_minute: recentCompleted.length,
    avg_wait_time_ms: waitTimes.length > 0 ? waitTimes.reduce((a: any, b: any) => a + b, 0) / waitTimes.length : 0,
    avg_processing_time_ms: processingTimes.length > 0 ? processingTimes.reduce((a: any, b: any) => a + b, 0) / processingTimes.length : 0,
    oldest_pending_age_ms: oldestPending,
  };
}

/* ── Presets ── */

export { QUEUE_PRESETS } from './presets/queuePresets';

/* ── Edge Function Invoker ── */

export async function runQueueWorker(input: QueueWorkerRunInput = {}): Promise<QueueWorkerRunResult> {
  const workerId = input.worker_id ?? `manual-${crypto.randomUUID().slice(0, 8)}`;
  const { data, error } = await supabase.functions.invoke('queue-worker', {
    body: { queue_id: input.queue_id, worker_id: workerId, batch_size: Math.min(input.batch_size ?? 5, 20) },
  });
  if (error) { logger.error('queue-worker invoke failed', { error: error.message }); throw new Error(error.message); }
  return (data as QueueWorkerRunResult) ?? { ok: true };
}
