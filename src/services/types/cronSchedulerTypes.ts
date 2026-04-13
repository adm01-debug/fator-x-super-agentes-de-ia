/**
 * Cron Scheduler — Type Definitions
 */

export type ScheduleFrequency =
  | 'once'
  | 'interval'
  | 'cron'
  | 'daily'
  | 'weekly'
  | 'monthly';

export type ScheduleStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'failed'
  | 'expired';

export interface CronSchedule {
  id: string;
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  cron_expression: string | null;
  interval_seconds: number | null;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  run_count: number;
  max_runs: number | null;
  status: ScheduleStatus;
  target_type: 'workflow' | 'agent' | 'edge_function' | 'webhook';
  target_id: string;
  target_config: Record<string, unknown>;
  retry_on_failure: boolean;
  max_retries: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateScheduleInput {
  name: string;
  description?: string;
  frequency: ScheduleFrequency;
  cron_expression?: string;
  interval_seconds?: number;
  timezone?: string;
  start_at?: string;
  max_runs?: number;
  target_type: CronSchedule['target_type'];
  target_id: string;
  target_config?: Record<string, unknown>;
  retry_on_failure?: boolean;
  max_retries?: number;
}

export interface ScheduleExecution {
  id: string;
  schedule_id: string;
  started_at: string;
  completed_at: string | null;
  status: 'running' | 'success' | 'failed' | 'skipped';
  result: Record<string, unknown> | null;
  error: string | null;
  duration_ms: number | null;
  attempt: number;
}

export interface ScheduleStats {
  total_schedules: number;
  active_schedules: number;
  paused_schedules: number;
  total_executions: number;
  success_rate: number;
  avg_duration_ms: number;
  next_upcoming: CronSchedule[];
}

export interface CronExecutorRunResult {
  ok: boolean;
  executed?: number;
  results?: Array<{
    schedule_id: string;
    name: string;
    status: string;
    error?: string;
    duration_ms: number;
  }>;
  error?: string;
}
