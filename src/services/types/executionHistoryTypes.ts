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
