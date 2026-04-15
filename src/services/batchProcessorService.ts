/**
 * Nexus Agents Studio — Batch Processor Service
 */

import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { fromTable } from '@/lib/supabaseExtended';

export type {
  BatchStatus, BatchErrorPolicy, BatchJob, BatchError,
  BatchItemResult, CreateBatchInput, BatchProgress,
} from './types/batchProcessorTypes';

import type {
  BatchStatus, BatchJob, BatchError, BatchItemResult,
  CreateBatchInput, BatchProgress, BatchErrorPolicy,
} from './types/batchProcessorTypes';

export async function createBatchJob(input: CreateBatchInput): Promise<BatchJob> {
  const { data: userData } = await supabase.auth.getUser();
  const batchSize = input.batch_size ?? 100;
  const totalBatches = Math.ceil(input.total_items / batchSize);

  const { data, error } = await fromTable('batch_jobs').insert({
    name: input.name, description: input.description ?? '', status: 'pending',
    total_items: input.total_items, processed_items: 0, successful_items: 0,
    failed_items: 0, skipped_items: 0, batch_size: batchSize,
    concurrency: input.concurrency ?? 1, error_policy: input.error_policy ?? 'continue_all',
    error_threshold_pct: input.error_threshold_pct ?? 10, current_batch: 0,
    total_batches: totalBatches, progress_pct: 0, avg_item_ms: 0, errors: [],
    metadata: input.metadata ?? {}, created_by: userData?.user?.id ?? null,
  }).select().single();
  if (error) throw error;
  return data as BatchJob;
}

export async function startBatchJob(jobId: string): Promise<void> {
  const { error } = await fromTable('batch_jobs').update({ status: 'running', started_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
  if (error) throw error;
}

export async function pauseBatchJob(jobId: string): Promise<void> {
  const { error } = await fromTable('batch_jobs').update({ status: 'paused', paused_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', jobId);
  if (error) throw error;
}

export async function resumeBatchJob(jobId: string): Promise<void> {
  const { error } = await fromTable('batch_jobs').update({ status: 'running', paused_at: null, updated_at: new Date().toISOString() }).eq('id', jobId);
  if (error) throw error;
}

export async function cancelBatchJob(jobId: string): Promise<void> {
  const now = new Date();
  const { data: job } = await fromTable('batch_jobs').select('started_at').eq('id', jobId).single();
  const durationMs = job?.started_at ? now.getTime() - new Date(job.started_at).getTime() : null;
  const { error } = await fromTable('batch_jobs').update({ status: 'cancelled', completed_at: now.toISOString(), duration_ms: durationMs, updated_at: now.toISOString() }).eq('id', jobId);
  if (error) throw error;
}

export async function reportBatchResults(jobId: string, batchNumber: number, results: BatchItemResult[]): Promise<{ should_continue: boolean; job: BatchJob }> {
  const { data: currentJob, error: fetchError } = await fromTable('batch_jobs').select('*').eq('id', jobId).single();
  if (fetchError) throw fetchError;
  const job = currentJob as BatchJob;
  if (job.status === 'cancelled' || job.status === 'paused') return { should_continue: false, job };

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const newProcessed = job.processed_items + results.length;
  const newSuccessful = job.successful_items + successful;
  const newFailed = job.failed_items + failed;
  const progressPct = Math.round((newProcessed / job.total_items) * 100);

  const newErrors: BatchError[] = results.filter((r) => !r.success).map((r) => ({
    item_index: r.index, batch_number: batchNumber, error: r.error ?? 'Unknown error',
    timestamp: new Date().toISOString(), item_data: r.data ?? {},
  }));
  const allErrors = [...(job.errors as BatchError[]), ...newErrors];

  const totalDuration = results.reduce((s, r) => s + r.duration_ms, 0);
  const newAvgMs = job.avg_item_ms > 0 ? (job.avg_item_ms * job.processed_items + totalDuration) / newProcessed : totalDuration / results.length;
  const remainingItems = job.total_items - newProcessed;
  const estimatedCompletion = new Date(Date.now() + remainingItems * newAvgMs).toISOString();

  const isComplete = newProcessed >= job.total_items;
  const now = new Date();
  const durationMs = job.started_at ? now.getTime() - new Date(job.started_at).getTime() : null;

  let shouldContinue = !isComplete;
  let finalStatus: BatchStatus = 'running';
  if (isComplete) { finalStatus = newFailed > 0 ? 'partial' : 'completed'; shouldContinue = false; }
  if (job.error_policy === 'stop_on_first' && newFailed > 0) { finalStatus = 'failed'; shouldContinue = false; }
  if (job.error_policy === 'threshold') {
    if ((newFailed / newProcessed) * 100 > job.error_threshold_pct) { finalStatus = 'failed'; shouldContinue = false; }
  }

  const updatePayload: Record<string, unknown> = {
    processed_items: newProcessed, successful_items: newSuccessful, failed_items: newFailed,
    current_batch: batchNumber, progress_pct: progressPct, avg_item_ms: Math.round(newAvgMs),
    errors: allErrors, estimated_completion: shouldContinue ? estimatedCompletion : null,
    status: finalStatus, updated_at: now.toISOString(),
  };
  if (!shouldContinue) { updatePayload.completed_at = now.toISOString(); updatePayload.duration_ms = durationMs; }

  const { data: updatedJob, error: updateError } = await fromTable('batch_jobs').update(updatePayload).eq('id', jobId).select().single();
  if (updateError) throw updateError;
  return { should_continue: shouldContinue, job: updatedJob as BatchJob };
}

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) chunks.push(array.slice(i, i + size));
  return chunks;
}

export async function processBatch<T, R>(
  items: T[], processor: (item: T, index: number) => Promise<R>,
  options: { name: string; batchSize?: number; concurrency?: number; errorPolicy?: BatchErrorPolicy; errorThresholdPct?: number; onProgress?: (progress: BatchProgress) => void; onBatchComplete?: (batch: number, results: BatchItemResult[]) => void },
): Promise<{ job: BatchJob; results: BatchItemResult[] }> {
  const batchSize = options.batchSize ?? 50;
  const concurrency = options.concurrency ?? 3;
  const totalBatches = Math.ceil(items.length / batchSize);
  const job = await createBatchJob({ name: options.name, total_items: items.length, batch_size: batchSize, concurrency, error_policy: options.errorPolicy ?? 'continue_all', error_threshold_pct: options.errorThresholdPct ?? 10 });
  await startBatchJob(job.id);
  const allResults: BatchItemResult[] = [];

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const batchItems = items.slice(start, Math.min(start + batchSize, items.length));
    const batchResults: BatchItemResult[] = [];
    const chunks = chunkArray(batchItems, concurrency);
    let localIndex = start;

    for (const chunk of chunks) {
      const chunkResults = await Promise.all(chunk.map(async (item, chunkIdx) => {
        const itemIndex = localIndex + chunkIdx;
        const itemStart = Date.now();
        try {
          const data = await processor(item, itemIndex);
          return { index: itemIndex, success: true, data: (typeof data === 'object' ? data : { result: data }) as Record<string, unknown>, error: null, duration_ms: Date.now() - itemStart };
        } catch (err) {
          return { index: itemIndex, success: false, data: null, error: err instanceof Error ? err.message : String(err), duration_ms: Date.now() - itemStart };
        }
      }));
      batchResults.push(...chunkResults);
      localIndex += chunk.length;
    }

    allResults.push(...batchResults);
    const { should_continue, job: updatedJob } = await reportBatchResults(job.id, batch + 1, batchResults);
    options.onBatchComplete?.(batch + 1, batchResults);

    if (options.onProgress) {
      const elapsed = updatedJob.started_at ? Date.now() - new Date(updatedJob.started_at).getTime() : 0;
      const ips = elapsed > 0 ? (updatedJob.processed_items / elapsed) * 1000 : 0;
      const remaining = updatedJob.total_items - updatedJob.processed_items;
      options.onProgress({ job_id: job.id, status: updatedJob.status, progress_pct: updatedJob.progress_pct, processed: updatedJob.processed_items, total: updatedJob.total_items, successful: updatedJob.successful_items, failed: updatedJob.failed_items, current_batch: batch + 1, total_batches: totalBatches, elapsed_ms: elapsed, estimated_remaining_ms: ips > 0 ? (remaining / ips) * 1000 : 0, items_per_second: Math.round(ips * 10) / 10 });
    }
    if (!should_continue) break;
  }

  const { data: finalJob } = await fromTable('batch_jobs').select('*').eq('id', job.id).single();
  return { job: (finalJob ?? job) as BatchJob, results: allResults };
}

export async function listBatchJobs(status?: BatchStatus, limit: number = 50): Promise<BatchJob[]> {
  let query = fromTable('batch_jobs').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BatchJob[];
}

export async function getBatchJob(id: string): Promise<BatchJob | null> {
  const { data, error } = await fromTable('batch_jobs').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return data as BatchJob | null;
}

export async function getBatchProgress(id: string): Promise<BatchProgress | null> {
  const job = await getBatchJob(id);
  if (!job) return null;
  const elapsed = job.started_at ? Date.now() - new Date(job.started_at).getTime() : 0;
  const ips = elapsed > 0 ? (job.processed_items / elapsed) * 1000 : 0;
  const remaining = job.total_items - job.processed_items;
  return { job_id: id, status: job.status, progress_pct: job.progress_pct, processed: job.processed_items, total: job.total_items, successful: job.successful_items, failed: job.failed_items, current_batch: job.current_batch, total_batches: job.total_batches, elapsed_ms: elapsed, estimated_remaining_ms: ips > 0 ? (remaining / ips) * 1000 : 0, items_per_second: Math.round(ips * 10) / 10 };
}

export async function getBatchStats(): Promise<{ total_jobs: number; completed: number; failed: number; running: number; total_items_processed: number; success_rate: number; avg_duration_ms: number; avg_items_per_second: number }> {
  const { data, error } = await fromTable('batch_jobs').select('status, processed_items, successful_items, failed_items, duration_ms, avg_item_ms');
  if (error) throw error;
  const jobs: any[] = data ?? [];
  const completed = jobs.filter((j: any) => j.status === 'completed' || j.status === 'partial');
  const failed = jobs.filter((j: any) => j.status === 'failed');
  const running = jobs.filter((j: any) => j.status === 'running');
  const totalProcessed = jobs.reduce((s: number, j: any) => s + (j.processed_items ?? 0), 0);
  const totalSuccessful = jobs.reduce((s: number, j: any) => s + (j.successful_items ?? 0), 0);
  const durations = jobs.map((j: any) => j.duration_ms).filter((d: any): d is number => d !== null);
  const speeds = jobs.map((j: any) => j.avg_item_ms).filter((s: any): s is number => s !== null && s > 0);
  return {
    total_jobs: jobs.length, completed: completed.length, failed: failed.length, running: running.length,
    total_items_processed: totalProcessed, success_rate: totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 0,
    avg_duration_ms: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    avg_items_per_second: speeds.length > 0 ? 1000 / (speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0,
  };
}
