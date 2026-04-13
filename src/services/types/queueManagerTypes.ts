/**
 * Queue Manager — Type Definitions
 */

export type QueueStrategy = 'fifo' | 'lifo' | 'priority';
export type QueueItemStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'dead_letter';

export interface QueueDefinition {
  id: string;
  name: string;
  description: string;
  strategy: QueueStrategy;
  max_concurrency: number;
  max_size: number;
  rate_limit_per_second: number;
  default_timeout_ms: number;
  default_max_retries: number;
  dead_letter_queue_id: string | null;
  is_paused: boolean;
  current_size: number;
  processed_count: number;
  failed_count: number;
  avg_processing_ms: number;
  created_at: string;
  updated_at: string;
}

export interface QueueItem {
  id: string;
  queue_id: string;
  priority: number;
  status: QueueItemStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  attempt: number;
  max_retries: number;
  timeout_ms: number;
  scheduled_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  locked_by: string | null;
  locked_until: string | null;
  tags: string[];
  created_at: string;
}

export interface CreateQueueInput {
  name: string;
  description?: string;
  strategy?: QueueStrategy;
  max_concurrency?: number;
  max_size?: number;
  rate_limit_per_second?: number;
  default_timeout_ms?: number;
  default_max_retries?: number;
  dead_letter_queue_id?: string;
}

export interface EnqueueInput {
  queue_id: string;
  payload: Record<string, unknown>;
  priority?: number;
  timeout_ms?: number;
  max_retries?: number;
  scheduled_at?: string;
  tags?: string[];
}

export interface QueueMetrics {
  queue_id: string;
  name: string;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  dead_letter: number;
  throughput_per_minute: number;
  avg_wait_time_ms: number;
  avg_processing_time_ms: number;
  oldest_pending_age_ms: number;
}

export interface QueueWorkerRunInput {
  queue_id?: string;
  worker_id?: string;
  batch_size?: number;
}

export interface QueueWorkerRunResult {
  ok: boolean;
  results?: Array<{
    queue: string;
    items_processed: number;
    successes: number;
    failures: number;
  }>;
  error?: string;
}
