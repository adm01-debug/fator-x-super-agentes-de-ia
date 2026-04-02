/**
 * Resilience Service — Rate Limiting, Circuit Breaker, Correlation IDs, SLOs
 * Covers: Maintainability, Performance, Security, Operability, Observability gaps
 */
import { logger } from '@/lib/logger';

// ═══ CORRELATION IDs ═══

let currentCorrelationId = `req-${Date.now()}`;

export function getCorrelationId(): string { return currentCorrelationId; }
export function newCorrelationId(): string {
  currentCorrelationId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  return currentCorrelationId;
}

// ═══ RATE LIMITER ═══

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  maxTokens: number;
  refillRate: number; // tokens per second
}

const buckets = new Map<string, RateLimitBucket>();

/** Check if a request is allowed under rate limit. Token bucket algorithm. */
export function checkRateLimit(key: string, maxPerMinute = 60): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const refillRate = maxPerMinute / 60; // tokens per second

  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { tokens: maxPerMinute, lastRefill: now, maxTokens: maxPerMinute, refillRate };
    buckets.set(key, bucket);
  }

  // Refill tokens
  const elapsed = (now - bucket.lastRefill) / 1000;
  bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + elapsed * bucket.refillRate);
  bucket.lastRefill = now;

  if (bucket.tokens >= 1) {
    bucket.tokens -= 1;
    return { allowed: true, remaining: Math.floor(bucket.tokens), retryAfterMs: 0 };
  }

  const retryAfterMs = Math.ceil((1 - bucket.tokens) / bucket.refillRate * 1000);
  logger.warn(`Rate limited: ${key} (retry after ${retryAfterMs}ms)`, 'resilience');
  return { allowed: false, remaining: 0, retryAfterMs };
}

/** Reset rate limit for a key. */
export function resetRateLimit(key: string): void { buckets.delete(key); }

// Clean up old buckets every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - 300000;
  buckets.forEach((bucket, key) => { if (bucket.lastRefill < cutoff) buckets.delete(key); });
}, 300000);

// ═══ CIRCUIT BREAKER ═══

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreaker {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number;
  threshold: number; // failures to open
  resetTimeout: number; // ms to try half-open
  halfOpenSuccesses: number; // successes needed to close
}

const circuits = new Map<string, CircuitBreaker>();

/** Get or create a circuit breaker for a service. */
function getCircuit(name: string, threshold = 5, resetTimeoutMs = 30000): CircuitBreaker {
  if (!circuits.has(name)) {
    circuits.set(name, {
      state: 'closed', failures: 0, successes: 0,
      lastFailure: 0, threshold, resetTimeout: resetTimeoutMs, halfOpenSuccesses: 2,
    });
  }
  return circuits.get(name)!;
}

/** Check if circuit allows request. */
export function isCircuitOpen(name: string): boolean {
  const circuit = getCircuit(name);

  if (circuit.state === 'open') {
    if (Date.now() - circuit.lastFailure > circuit.resetTimeout) {
      circuit.state = 'half-open';
      circuit.successes = 0;
      logger.info(`Circuit ${name}: open → half-open`, 'resilience');
      return false; // Allow test request
    }
    return true; // Still open
  }

  return false; // Closed or half-open = allow
}

/** Record success for circuit breaker. */
export function recordSuccess(name: string): void {
  const circuit = getCircuit(name);
  if (circuit.state === 'half-open') {
    circuit.successes++;
    if (circuit.successes >= circuit.halfOpenSuccesses) {
      circuit.state = 'closed';
      circuit.failures = 0;
      logger.info(`Circuit ${name}: half-open → closed`, 'resilience');
    }
  } else {
    circuit.failures = Math.max(0, circuit.failures - 1); // Decay on success
  }
}

/** Record failure for circuit breaker. */
export function recordFailure(name: string): void {
  const circuit = getCircuit(name);
  circuit.failures++;
  circuit.lastFailure = Date.now();

  if (circuit.state === 'half-open') {
    circuit.state = 'open';
    logger.warn(`Circuit ${name}: half-open → open (test failed)`, 'resilience');
  } else if (circuit.failures >= circuit.threshold) {
    circuit.state = 'open';
    logger.warn(`Circuit ${name}: closed → open (${circuit.failures} failures)`, 'resilience');
  }
}

/** Get circuit state for display. */
export function getCircuitState(name: string): { state: CircuitState; failures: number } {
  const circuit = getCircuit(name);
  return { state: circuit.state, failures: circuit.failures };
}

/** Get all circuit states. */
export function getAllCircuits(): { name: string; state: CircuitState; failures: number }[] {
  return Array.from(circuits.entries()).map(([name, c]) => ({ name, state: c.state, failures: c.failures }));
}

// ═══ SLO DEFINITIONS ═══

export interface SLODefinition {
  name: string;
  metric: string;
  target: number;
  unit: string;
  window: string;
  current?: number;
}

export const SLO_DEFINITIONS: SLODefinition[] = [
  { name: 'Availability', metric: 'uptime', target: 99.9, unit: '%', window: '30d' },
  { name: 'Latency P50', metric: 'latency_p50', target: 2000, unit: 'ms', window: '24h' },
  { name: 'Latency P95', metric: 'latency_p95', target: 5000, unit: 'ms', window: '24h' },
  { name: 'Latency P99', metric: 'latency_p99', target: 10000, unit: 'ms', window: '24h' },
  { name: 'Error Rate', metric: 'error_rate', target: 1, unit: '%', window: '24h' },
  { name: 'TTFT', metric: 'time_to_first_token', target: 500, unit: 'ms', window: '24h' },
  { name: 'Throughput', metric: 'requests_per_minute', target: 100, unit: 'rpm', window: '1h' },
  { name: 'Cost per Request', metric: 'cost_per_request', target: 0.05, unit: 'USD', window: '24h' },
];

/** Evaluate SLOs against current metrics. */
export function evaluateSLOs(metrics: Record<string, number>): { name: string; target: number; current: number; met: boolean; unit: string }[] {
  return SLO_DEFINITIONS.map(slo => {
    const current = metrics[slo.metric] ?? 0;
    const met = slo.metric === 'error_rate' || slo.metric === 'cost_per_request'
      ? current <= slo.target // Lower is better
      : slo.metric === 'uptime' || slo.metric === 'requests_per_minute'
        ? current >= slo.target // Higher is better
        : current <= slo.target; // Latency: lower is better
    return { name: slo.name, target: slo.target, current, met, unit: slo.unit };
  });
}

// ═══ DEBOUNCE / THROTTLE HELPERS ═══

/** Debounce a function — only execute after delay since last call. */
export function debounce<T extends (...args: unknown[]) => unknown>(fn: T, delayMs: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delayMs);
  };
}

/** Throttle a function — execute at most once per interval. */
export function throttle<T extends (...args: unknown[]) => unknown>(fn: T, intervalMs: number): (...args: Parameters<T>) => void {
  let lastCall = 0;
  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastCall >= intervalMs) {
      lastCall = now;
      fn(...args);
    }
  };
}

// ═══ RETRY WITH BACKOFF ═══

/** Retry an async function with exponential backoff. */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelayMs = 1000,
  circuitName?: string
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    // Check circuit breaker
    if (circuitName && isCircuitOpen(circuitName)) {
      throw new Error(`Circuit ${circuitName} is open — request blocked`);
    }

    try {
      const result = await fn();
      if (circuitName) recordSuccess(circuitName);
      return result;
    } catch (err) {
      if (circuitName) recordFailure(circuitName);
      if (attempt === maxRetries) throw err;

      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500;
      logger.warn(`Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`, 'resilience');
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Max retries exceeded');
}
