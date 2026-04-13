/**
 * Batch Processor — Type Definitions
 */

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
