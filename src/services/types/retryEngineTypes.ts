/**
 * Retry & Circuit Breaker Engine — Type Definitions
 */

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential' | 'exponential_jitter';
export type CircuitState = 'closed' | 'open' | 'half_open';
export type DeadLetterAction = 'log' | 'notify' | 'store' | 'retry_manual';

export interface RetryPolicy {
  max_attempts: number;
  backoff_strategy: BackoffStrategy;
  initial_delay_ms: number;
  max_delay_ms: number;
  backoff_multiplier: number;
  retryable_errors: string[];
  non_retryable_errors: string[];
  timeout_ms: number;
  on_exhaust: DeadLetterAction;
}

export interface CircuitBreakerConfig {
  failure_threshold: number;
  success_threshold: number;
  timeout_ms: number;
  half_open_max_calls: number;
  monitor_window_ms: number;
}

export interface CircuitBreakerState {
  id: string;
  service_name: string;
  state: CircuitState;
  failure_count: number;
  success_count: number;
  last_failure_at: string | null;
  last_success_at: string | null;
  last_state_change_at: string;
  config: CircuitBreakerConfig;
  total_requests: number;
  total_failures: number;
  total_timeouts: number;
  created_at: string;
  updated_at: string;
}

export interface RetryAttempt {
  attempt: number;
  started_at: string;
  completed_at: string;
  success: boolean;
  error: string | null;
  delay_ms: number;
  duration_ms: number;
}

export interface RetryResult<T> {
  success: boolean;
  data: T | null;
  attempts: RetryAttempt[];
  total_duration_ms: number;
  final_error: string | null;
  exhausted: boolean;
  circuit_opened: boolean;
}

export interface DeadLetterEntry {
  id: string;
  source: string;
  operation: string;
  payload: Record<string, unknown>;
  error: string;
  attempts: number;
  retry_policy: RetryPolicy;
  status: 'pending' | 'retried' | 'resolved' | 'discarded';
  created_at: string;
  resolved_at: string | null;
}
