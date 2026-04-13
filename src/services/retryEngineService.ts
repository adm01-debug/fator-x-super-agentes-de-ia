/**
 * Nexus Agents Studio — Retry & Circuit Breaker Engine
 */

import { fromTable } from '@/lib/supabaseExtended';

export type {
  BackoffStrategy, CircuitState, DeadLetterAction, RetryPolicy,
  CircuitBreakerConfig, CircuitBreakerState, RetryAttempt,
  RetryResult, DeadLetterEntry,
} from './types/retryEngineTypes';

import type {
  RetryPolicy, CircuitBreakerConfig, CircuitBreakerState,
  RetryAttempt, RetryResult, DeadLetterEntry, BatchStatus,
} from './types/retryEngineTypes';

/* ── Default Policies ── */

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  max_attempts: 3, backoff_strategy: 'exponential_jitter', initial_delay_ms: 1000,
  max_delay_ms: 30000, backoff_multiplier: 2,
  retryable_errors: ['TIMEOUT', 'ECONNREFUSED', 'RATE_LIMITED', '503', '429', '500'],
  non_retryable_errors: ['AUTH_FAILED', '401', '403', '404', 'VALIDATION'],
  timeout_ms: 30000, on_exhaust: 'store',
};

export const RETRY_PRESETS: Record<string, RetryPolicy> = {
  aggressive: { ...DEFAULT_RETRY_POLICY, max_attempts: 5, initial_delay_ms: 500, max_delay_ms: 60000, backoff_multiplier: 3 },
  gentle: { ...DEFAULT_RETRY_POLICY, max_attempts: 2, initial_delay_ms: 2000, max_delay_ms: 10000, backoff_strategy: 'fixed' },
  api_call: { ...DEFAULT_RETRY_POLICY, max_attempts: 3, initial_delay_ms: 1000, max_delay_ms: 15000, timeout_ms: 10000 },
  webhook_delivery: { ...DEFAULT_RETRY_POLICY, max_attempts: 5, initial_delay_ms: 5000, max_delay_ms: 300000, backoff_multiplier: 4, on_exhaust: 'notify' },
  database_operation: { ...DEFAULT_RETRY_POLICY, max_attempts: 3, initial_delay_ms: 200, max_delay_ms: 5000, backoff_strategy: 'exponential', timeout_ms: 15000 },
  llm_inference: { ...DEFAULT_RETRY_POLICY, max_attempts: 3, initial_delay_ms: 2000, max_delay_ms: 30000, timeout_ms: 120000, retryable_errors: ['TIMEOUT', 'RATE_LIMITED', '429', '503', '529'] },
};

export const DEFAULT_CIRCUIT_CONFIG: CircuitBreakerConfig = {
  failure_threshold: 5, success_threshold: 3, timeout_ms: 60000, half_open_max_calls: 3, monitor_window_ms: 120000,
};

/* ── Backoff Calculator ── */

export function calculateDelay(attempt: number, policy: RetryPolicy): number {
  let delay: number;
  switch (policy.backoff_strategy) {
    case 'fixed': delay = policy.initial_delay_ms; break;
    case 'linear': delay = policy.initial_delay_ms * attempt; break;
    case 'exponential': delay = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1); break;
    case 'exponential_jitter': default: { const base = policy.initial_delay_ms * Math.pow(policy.backoff_multiplier, attempt - 1); delay = base + Math.random() * base * 0.3; break; }
  }
  return Math.min(delay, policy.max_delay_ms);
}

/* ── Retry Engine ── */

function isRetryable(error: string, policy: RetryPolicy): boolean {
  if (policy.non_retryable_errors.some((e: any) => error.includes(e))) return false;
  if (policy.retryable_errors.length === 0) return true;
  return policy.retryable_errors.some((e: any) => error.includes(e));
}

function sleep(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }

export async function executeWithRetry<T>(operation: () => Promise<T>, policy: RetryPolicy = DEFAULT_RETRY_POLICY, operationName: string = 'unknown'): Promise<RetryResult<T>> {
  const attempts: RetryAttempt[] = [];
  const startTime = Date.now();
  for (let attempt = 1; attempt <= policy.max_attempts; attempt++) {
    const attemptStart = Date.now();
    const delay = attempt > 1 ? calculateDelay(attempt - 1, policy) : 0;
    if (delay > 0) await sleep(delay);
    try {
      const data = await Promise.race([operation(), new Promise<never>((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), policy.timeout_ms))]);
      attempts.push({ attempt, started_at: new Date(attemptStart).toISOString(), completed_at: new Date().toISOString(), success: true, error: null, delay_ms: delay, duration_ms: Date.now() - attemptStart });
      return { success: true, data, attempts, total_duration_ms: Date.now() - startTime, final_error: null, exhausted: false, circuit_opened: false };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      attempts.push({ attempt, started_at: new Date(attemptStart).toISOString(), completed_at: new Date().toISOString(), success: false, error: errorMsg, delay_ms: delay, duration_ms: Date.now() - attemptStart });
      if (!isRetryable(errorMsg, policy) || attempt >= policy.max_attempts) {
        if (policy.on_exhaust === 'store') await addToDeadLetterQueue(operationName, errorMsg, attempt, policy);
        return { success: false, data: null, attempts, total_duration_ms: Date.now() - startTime, final_error: errorMsg, exhausted: true, circuit_opened: false };
      }
    }
  }
  return { success: false, data: null, attempts, total_duration_ms: Date.now() - startTime, final_error: 'Max attempts exhausted', exhausted: true, circuit_opened: false };
}

/* ── Circuit Breaker ── */

const circuitBreakers = new Map<string, CircuitBreakerState>();

export function getCircuitBreaker(serviceName: string, config: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG): CircuitBreakerState {
  const existing = circuitBreakers.get(serviceName);
  if (existing) { existing.config = config; return existing; }
  const state: CircuitBreakerState = { id: crypto.randomUUID(), service_name: serviceName, state: 'closed', failure_count: 0, success_count: 0, last_failure_at: null, last_success_at: null, last_state_change_at: new Date().toISOString(), config, total_requests: 0, total_failures: 0, total_timeouts: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  circuitBreakers.set(serviceName, state);
  return state;
}

export function recordCircuitSuccess(serviceName: string): void {
  const cb = circuitBreakers.get(serviceName); if (!cb) return;
  cb.total_requests += 1; cb.success_count += 1; cb.last_success_at = new Date().toISOString(); cb.updated_at = new Date().toISOString();
  if (cb.state === 'half_open' && cb.success_count >= cb.config.success_threshold) { cb.state = 'closed'; cb.failure_count = 0; cb.success_count = 0; cb.last_state_change_at = new Date().toISOString(); }
}

export function recordCircuitFailure(serviceName: string): void {
  const cb = circuitBreakers.get(serviceName); if (!cb) return;
  cb.total_requests += 1; cb.total_failures += 1; cb.failure_count += 1; cb.last_failure_at = new Date().toISOString(); cb.updated_at = new Date().toISOString();
  if (cb.failure_count >= cb.config.failure_threshold) { cb.state = 'open'; cb.last_state_change_at = new Date().toISOString(); }
}

export function canExecute(serviceName: string): boolean {
  const cb = circuitBreakers.get(serviceName); if (!cb) return true;
  if (cb.state === 'closed') return true;
  if (cb.state === 'open') {
    if (Date.now() - new Date(cb.last_state_change_at).getTime() >= cb.config.timeout_ms) { cb.state = 'half_open'; cb.success_count = 0; cb.failure_count = 0; cb.last_state_change_at = new Date().toISOString(); return true; }
    return false;
  }
  return cb.total_requests < cb.config.half_open_max_calls;
}

export async function executeWithCircuitBreaker<T>(serviceName: string, operation: () => Promise<T>, retryPolicy: RetryPolicy = DEFAULT_RETRY_POLICY, cbConfig: CircuitBreakerConfig = DEFAULT_CIRCUIT_CONFIG): Promise<RetryResult<T>> {
  getCircuitBreaker(serviceName, cbConfig);
  if (!canExecute(serviceName)) return { success: false, data: null, attempts: [], total_duration_ms: 0, final_error: `Circuit breaker OPEN for service: ${serviceName}`, exhausted: false, circuit_opened: true };
  const result = await executeWithRetry(operation, retryPolicy, serviceName);
  if (result.success) recordCircuitSuccess(serviceName); else recordCircuitFailure(serviceName);
  return result;
}

export function getAllCircuitBreakers(): CircuitBreakerState[] { return Array.from(circuitBreakers.values()); }
export function resetCircuitBreaker(serviceName: string): void { const cb = circuitBreakers.get(serviceName); if (!cb) return; cb.state = 'closed'; cb.failure_count = 0; cb.success_count = 0; cb.last_state_change_at = new Date().toISOString(); cb.updated_at = new Date().toISOString(); }

/* ── Dead Letter Queue ── */

export async function addToDeadLetterQueue(operation: string, error: string, attempts: number, policy: RetryPolicy): Promise<DeadLetterEntry> {
  const { data, error: dbError } = await fromTable('dead_letter_queue').insert({ source: 'retry_engine', operation, payload: {}, error, attempts, retry_policy: policy as unknown as Record<string, unknown>, status: 'pending' }).select().single();
  if (dbError) throw dbError;
  return data as DeadLetterEntry;
}

export async function listDeadLetters(status?: DeadLetterEntry['status'], limit: number = 50): Promise<DeadLetterEntry[]> {
  let query = fromTable('dead_letter_queue').select('*').order('created_at', { ascending: false }).limit(limit);
  if (status) query = query.eq('status', status);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DeadLetterEntry[];
}

export async function resolveDeadLetter(id: string, status: 'retried' | 'resolved' | 'discarded' = 'resolved'): Promise<void> {
  const { error } = await fromTable('dead_letter_queue').update({ status, resolved_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
}

export async function getDeadLetterStats(): Promise<{ total: number; pending: number; resolved: number; retried: number; discarded: number }> {
  const { data, error } = await fromTable('dead_letter_queue').select('status');
  if (error) throw error;
  const items = data ?? [];
  return { total: items.length, pending: items.filter((i: any) => i.status === 'pending').length, resolved: items.filter((i: any) => i.status === 'resolved').length, retried: items.filter((i: any) => i.status === 'retried').length, discarded: items.filter((i: any) => i.status === 'discarded').length };
}
