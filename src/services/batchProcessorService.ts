/**
 * Nexus Agents Studio — Batch Processor Service
 *
 * Processes large datasets in configurable batches with progress
 * tracking, pause/resume, error tolerance, and parallel execution.
 *
 * Inspired by: Temporal Batch Processing, n8n Split-in-Batches node,
 * Apache Airflow DAGs, Windmill batch jobs.
 *
 * Gap 10/10 — automation topic analysis
 */

import { supabase } from '@/integrations/supabase/client';
import { fromTable } from '@/lib/supabaseExtended';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type BatchStatus =
  | 'pending'
  | 'running'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'partial';

export type BatchErrorPolicy = 'stop_on_first' | 'continue_all' | 'threshold';

export interface BatchJob {
  id: string;
  name: string;
  description: string;
  status: BatchStatus;
  total_items: number;
  processed_items: number;
  successful_items: number;
  failed_items: number;
  skipped_items: number;
  batch_size: number;
  concurrency: number;
  error_policy: BatchErrorPolicy;
  error_threshold_pct: number;
  current_batch: number;
  total_batches: number;
  progress_pct: number;
  started_at: string | null;
  completed_at: string | null;
  paused_at: string | null;
  estimated_completion: string | null;
  duration_ms: number | null;
  avg_item_ms: number;
  errors: BatchError[];
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface BatchError {
  item_index: number;
  batch_number: number;
  error: string;
  timestamp: string;
  item_data: Record<string, unknown>;
}

export interface BatchItemResult {
  index: number;
  success: boolean;
  data: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number;
}

export interface CreateBatchInput {
  name: string;
  description?: string;
  total_items: number;
  batch_size?: number;
  concurrency?: number;
  error_policy?: BatchErrorPolicy;
  error_threshold_pct?: number;
  metadata?: Record<string, unknown>;
}

export interface BatchProgress {
  job_id: string;
  status: BatchStatus;
  progress_pct: number;
  processed: number;
  total: number;
  successful: number;
  failed: number;
  current_batch: number;
  total_batches: number;
  elapsed_ms: number;
  estimated_remaining_ms: number;
  items_per_second: number;
}

/* ------------------------------------------------------------------ */
/*  Core Engine                                                        */
/* ------------------------------------------------------------------ */

export async function createBatchJob(
  input: CreateBatchInput,
): Promise<BatchJob> {
  const { data: userData } = await supabase.auth.getUser();
  const batchSize = input.batch_size ?? 100;
  const totalBatches = Math.ceil(input.total_items / batchSize);

  const { data, error } = await fromTable('batch_jobs')
    .insert({
      name: input.name,
      description: input.description ?? '',
      status: 'pending',
      total_items: input.total_items,
      processed_items: 0,
      successful_items: 0,
      failed_items: 0,
      skipped_items: 0,
      batch_size: batchSize,
      concurrency: input.concurrency ?? 1,
      error_policy: input.error_policy ?? 'continue_all',
      error_threshold_pct: input.error_threshold_pct ?? 10,
      current_batch: 0,
      total_batches: totalBatches,
      progress_pct: 0,
      avg_item_ms: 0,
      errors: [],
      metadata: input.metadata ?? {},
      created_by: userData?.user?.id ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as BatchJob;
}

export async function startBatchJob(jobId: string): Promise<void> {
  const { error } = await fromTable('batch_jobs')
    .update({
      status: 'running',
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw error;
}

export async function pauseBatchJob(jobId: string): Promise<void> {
  const { error } = await fromTable('batch_jobs')
    .update({
      status: 'paused',
      paused_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw error;
}

export async function resumeBatchJob(jobId: string): Promise<void> {
  const { error } = await fromTable('batch_jobs')
    .update({
      status: 'running',
      paused_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', jobId);
  if (error) throw error;
}

export async function cancelBatchJob(jobId: string): Promise<void> {
  const now = new Date();
  const { data: job } = await fromTable('batch_jobs')
    .select('started_at')
    .eq('id', jobId)
    .single();

  const durationMs = job?.started_at
    ? now.getTime() - new Date(job.started_at).getTime()
    : null;

  const { error } = await fromTable('batch_jobs')
    .update({
      status: 'cancelled',
      completed_at: now.toISOString(),
      duration_ms: durationMs,
      updated_at: now.toISOString(),
    })
    .eq('id', jobId);
  if (error) throw error;
}

/* ------------------------------------------------------------------ */
/*  Batch Progress Reporting                                           */
/* ------------------------------------------------------------------ */

export async function reportBatchResults(
  jobId: string,
  batchNumber: number,
  results: BatchItemResult[],
): Promise<{ should_continue: boolean; job: BatchJob }> {
  const { data: currentJob, error: fetchError } = await fromTable('batch_jobs')
    .select('*')
    .eq('id', jobId)
    .single();
  if (fetchError) throw fetchError;

  const job = currentJob as BatchJob;
  if (job.status === 'cancelled' || job.status === 'paused') {
    return { should_continue: false, job };
  }

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;
  const newProcessed = job.processed_items + results.length;
  const newSuccessful = job.successful_items + successful;
  const newFailed = job.failed_items + failed;
  const progressPct = Math.round((newProcessed / job.total_items) * 100);

  // Collect errors
  const newErrors: BatchError[] = results
    .filter((r) => !r.success)
    .map((r) => ({
      item_index: r.index,
      batch_number: batchNumber,
      error: r.error ?? 'Unknown error',
      timestamp: new Date().toISOString(),
      item_data: r.data ?? {},
    }));

  const allErrors = [...(job.errors as BatchError[]), ...newErrors];

  // Calculate avg item time
  const totalDuration = results.reduce((s, r) => s + r.duration_ms, 0);
  const newAvgMs = job.avg_item_ms > 0
    ? (job.avg_item_ms * job.processed_items + totalDuration) / newProcessed
    : totalDuration / results.length;

  // Estimate completion
  const remainingItems = job.total_items - newProcessed;
  const estimatedRemainingMs = remainingItems * newAvgMs;
  const estimatedCompletion = new Date(Date.now() + estimatedRemainingMs).toISOString();

  // Check if completed
  const isComplete = newProcessed >= job.total_items;
  const now = new Date();
  const durationMs = job.started_at
    ? now.getTime() - new Date(job.started_at).getTime()
    : null;

  // Check error policy
  let shouldContinue = !isComplete;
  let finalStatus: BatchStatus = 'running';

  if (isComplete) {
    finalStatus = newFailed > 0 ? 'partial' : 'completed';
    shouldContinue = false;
  }

  if (job.error_policy === 'stop_on_first' && newFailed > 0) {
    finalStatus = 'failed';
    shouldContinue = false;
  }

  if (job.error_policy === 'threshold') {
    const errorPct = (newFailed / newProcessed) * 100;
    if (errorPct > job.error_threshold_pct) {
      finalStatus = 'failed';
      shouldContinue = false;
    }
  }

  const updatePayload: Record<string, unknown> = {
    processed_items: newProcessed,
    successful_items: newSuccessful,
    failed_items: newFailed,
    current_batch: batchNumber,
    progress_pct: progressPct,
    avg_item_ms: Math.round(newAvgMs),
    errors: allErrors,
    estimated_completion: shouldContinue ? estimatedCompletion : null,
    status: finalStatus,
    updated_at: now.toISOString(),
  };

  if (!shouldContinue) {
    updatePayload.completed_at = now.toISOString();
    updatePayload.duration_ms = durationMs;
  }

  const { data: updatedJob, error: updateError } = await fromTable('batch_jobs')
    .update(updatePayload)
    .eq('id', jobId)
    .select()
    .single();
  if (updateError) throw updateError;

  return { should_continue: shouldContinue, job: updatedJob as BatchJob };
}

/* ------------------------------------------------------------------ */
/*  Client-side Batch Processor (runs in browser)                      */
/* ------------------------------------------------------------------ */

export async function processBatch<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options: {
    name: string;
    batchSize?: number;
    concurrency?: number;
    errorPolicy?: BatchErrorPolicy;
    errorThresholdPct?: number;
    onProgress?: (progress: BatchProgress) => void;
    onBatchComplete?: (batch: number, results: BatchItemResult[]) => void;
  },
): Promise<{ job: BatchJob; results: BatchItemResult[] }> {
  const batchSize = options.batchSize ?? 50;
  const concurrency = options.concurrency ?? 3;
  const totalBatches = Math.ceil(items.length / batchSize);

  // Create job record
  const job = await createBatchJob({
    name: options.name,
    total_items: items.length,
    batch_size: batchSize,
    concurrency,
    error_policy: options.errorPolicy ?? 'continue_all',
    error_threshold_pct: options.errorThresholdPct ?? 10,
  });

  await startBatchJob(job.id);
  const allResults: BatchItemResult[] = [];

  for (let batch = 0; batch < totalBatches; batch++) {
    const start = batch * batchSize;
    const end = Math.min(start + batchSize, items.length);
    const batchItems = items.slice(start, end);

    // Process batch with concurrency limit
    const batchResults: BatchItemResult[] = [];
    const chunks = chunkArray(batchItems, concurrency);
    let localIndex = start;

    for (const chunk of chunks) {
      const chunkPromises = chunk.map(async (item, chunkIdx) => {
        const itemIndex = localIndex + chunkIdx;
        const itemStart = Date.now();
        try {
          const data = await processor(item, itemIndex);
          return {
            index: itemIndex,
            success: true,
            data: (typeof data === 'object' ? data : { result: data }) as Record<string, unknown>,
            error: null,
            duration_ms: Date.now() - itemStart,
          };
        } catch (err) {
          return {
            index: itemIndex,
            success: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
            duration_ms: Date.now() - itemStart,
          };
        }
      });

      const chunkResults = await Promise.all(chunkPromises);
      batchResults.push(...chunkResults);
      localIndex += chunk.length;
    }

    allResults.push(...batchResults);

    // Report to DB
    const { should_continue, job: updatedJob } = await reportBatchResults(
      job.id,
      batch + 1,
      batchResults,
    );

    options.onBatchComplete?.(batch + 1, batchResults);

    if (options.onProgress) {
      const elapsed = updatedJob.started_at
        ? Date.now() - new Date(updatedJob.started_at).getTime()
        : 0;
      const itemsPerSecond = elapsed > 0 ? (updatedJob.processed_items / elapsed) * 1000 : 0;
      const remaining = updatedJob.total_items - updatedJob.processed_items;

      options.onProgress({
        job_id: job.id,
        status: updatedJob.status,
        progress_pct: updatedJob.progress_pct,
        processed: updatedJob.processed_items,
        total: updatedJob.total_items,
        successful: updatedJob.successful_items,
        failed: updatedJob.failed_items,
        current_batch: batch + 1,
        total_batches: totalBatches,
        elapsed_ms: elapsed,
        estimated_remaining_ms: itemsPerSecond > 0 ? (remaining / itemsPerSecond) * 1000 : 0,
        items_per_second: Math.round(itemsPerSecond * 10) / 10,
      });
    }

    if (!should_continue) break;
  }

  // Fetch final state
  const { data: finalJob } = await fromTable('batch_jobs')
    .select('*')
    .eq('id', job.id)
    .single();

  return { job: (finalJob ?? job) as BatchJob, results: allResults };
}

/* ------------------------------------------------------------------ */
/*  Querying                                                           */
/* ------------------------------------------------------------------ */

export async function listBatchJobs(
  status?: BatchStatus,
  limit: number = 50,
): Promise<BatchJob[]> {
  let query = fromTable('batch_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as BatchJob[];
}

export async function getBatchJob(id: string): Promise<BatchJob | null> {
  const { data, error } = await fromTable('batch_jobs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data as BatchJob | null;
}

export async function getBatchProgress(id: string): Promise<BatchProgress | null> {
  const job = await getBatchJob(id);
  if (!job) return null;

  const elapsed = job.started_at
    ? Date.now() - new Date(job.started_at).getTime()
    : 0;
  const itemsPerSecond = elapsed > 0 ? (job.processed_items / elapsed) * 1000 : 0;
  const remaining = job.total_items - job.processed_items;

  return {
    job_id: id,
    status: job.status,
    progress_pct: job.progress_pct,
    processed: job.processed_items,
    total: job.total_items,
    successful: job.successful_items,
    failed: job.failed_items,
    current_batch: job.current_batch,
    total_batches: job.total_batches,
    elapsed_ms: elapsed,
    estimated_remaining_ms: itemsPerSecond > 0 ? (remaining / itemsPerSecond) * 1000 : 0,
    items_per_second: Math.round(itemsPerSecond * 10) / 10,
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function chunkArray<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

/* ------------------------------------------------------------------ */
/*  Batch Stats                                                        */
/* ------------------------------------------------------------------ */

export async function getBatchStats(): Promise<{
  total_jobs: number;
  completed: number;
  failed: number;
  running: number;
  total_items_processed: number;
  success_rate: number;
  avg_duration_ms: number;
  avg_items_per_second: number;
}> {
  const { data, error } = await fromTable('batch_jobs')
    .select('status, processed_items, successful_items, failed_items, duration_ms, avg_item_ms');
  if (error) throw error;

  const jobs = data ?? [];
  const completed = jobs.filter((j) => j.status === 'completed' || j.status === 'partial');
  const failed = jobs.filter((j) => j.status === 'failed');
  const running = jobs.filter((j) => j.status === 'running');
  const totalProcessed = jobs.reduce((s, j) => s + (j.processed_items ?? 0), 0);
  const totalSuccessful = jobs.reduce((s, j) => s + (j.successful_items ?? 0), 0);
  const durations = jobs.map((j) => j.duration_ms).filter((d): d is number => d !== null);
  const speeds = jobs.map((j) => j.avg_item_ms).filter((s): s is number => s !== null && s > 0);

  return {
    total_jobs: jobs.length,
    completed: completed.length,
    failed: failed.length,
    running: running.length,
    total_items_processed: totalProcessed,
    success_rate: totalProcessed > 0 ? (totalSuccessful / totalProcessed) * 100 : 0,
    avg_duration_ms: durations.length > 0 ? durations.reduce((a, b) => a + b, 0) / durations.length : 0,
    avg_items_per_second: speeds.length > 0 ? 1000 / (speeds.reduce((a, b) => a + b, 0) / speeds.length) : 0,
  };
}
