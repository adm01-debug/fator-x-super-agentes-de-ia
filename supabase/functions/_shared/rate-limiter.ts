/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — Shared Rate Limiter
 * ═══════════════════════════════════════════════════════════════
 * Sliding window rate limiter for Supabase Edge Functions.
 * Import in every function to prevent abuse and DDoS.
 *
 * Usage:
 *   import { checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS } from "../_shared/rate-limiter.ts";
 *
 *   const identifier = getRateLimitIdentifier(req, user?.id);
 *   const result = checkRateLimit(identifier, RATE_LIMITS.standard);
 *   if (!result.allowed) return createRateLimitResponse(result);
 *
 * Pattern: n8n enterprise rate limiting + Dify API protection
 * ═══════════════════════════════════════════════════════════════
 */

// ═══ Types ═══

export interface RateLimitConfig {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests allowed within window */
  maxRequests: number;
  /** Optional: name for logging/identification */
  name?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  retryAfterMs: number;
}

interface RateLimitEntry {
  timestamps: number[];
  lastCleanup: number;
}

// ═══ In-memory store ═══
// Resets on cold starts — acceptable for Edge Functions (stateless by design).
// For persistent rate limiting, use Supabase table (see rate_limit_logs migration).
const store = new Map<string, RateLimitEntry>();

// ═══ Preset Configurations ═══

export const RATE_LIMITS = {
  /** Standard API endpoints: 30 req/min */
  standard: { windowMs: 60_000, maxRequests: 30, name: 'standard' } as RateLimitConfig,

  /** LLM calls (expensive): 15 req/min */
  llm: { windowMs: 60_000, maxRequests: 15, name: 'llm' } as RateLimitConfig,

  /** Heavy operations (RAG ingest, eval, research): 5 req/min */
  heavy: { windowMs: 60_000, maxRequests: 5, name: 'heavy' } as RateLimitConfig,

  /** Auth/login endpoints: 10 req/5min (brute force protection) */
  auth: { windowMs: 300_000, maxRequests: 10, name: 'auth' } as RateLimitConfig,

  /** Webhook receivers: 60 req/min */
  webhook: { windowMs: 60_000, maxRequests: 60, name: 'webhook' } as RateLimitConfig,

  /** DataHub queries: 20 req/min */
  datahub: { windowMs: 60_000, maxRequests: 20, name: 'datahub' } as RateLimitConfig,

  /** Oracle council (very expensive, multiple LLM calls): 3 req/min */
  oracle: { windowMs: 60_000, maxRequests: 3, name: 'oracle' } as RateLimitConfig,
} as const;

// ═══ Cleanup ═══

function cleanupEntry(entry: RateLimitEntry, windowMs: number): number[] {
  const now = Date.now();
  return entry.timestamps.filter(t => now - t < windowMs);
}

// Global cleanup every 60s to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store.entries()) {
    // Remove entries not accessed in 5 minutes
    if (now - entry.lastCleanup > 300_000) {
      store.delete(key);
    }
  }
}, 60_000);

// ═══ Core Functions ═══

/**
 * Extract a rate limit identifier from the request.
 * Priority: user_id > API key > IP address > 'anonymous'
 */
export function getRateLimitIdentifier(req: Request, userId?: string | null): string {
  if (userId) return `user:${userId}`;

  const apiKey = req.headers.get('x-api-key') || req.headers.get('apikey');
  if (apiKey) return `key:${apiKey.substring(0, 16)}`;

  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'unknown';
  return `ip:${ip}`;
}

/**
 * Check if a request should be allowed under rate limits.
 * Uses sliding window algorithm for smooth limiting.
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.standard
): RateLimitResult {
  const now = Date.now();

  let entry = store.get(identifier);
  if (!entry) {
    entry = { timestamps: [], lastCleanup: now };
    store.set(identifier, entry);
  }

  // Clean expired timestamps
  entry.timestamps = cleanupEntry(entry, config.windowMs);
  entry.lastCleanup = now;

  const currentCount = entry.timestamps.length;

  if (currentCount >= config.maxRequests) {
    // Find when the oldest timestamp in window will expire
    const oldestInWindow = entry.timestamps[0];
    const resetAt = oldestInWindow + config.windowMs;
    const retryAfterMs = Math.max(0, resetAt - now);

    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit: config.maxRequests,
      retryAfterMs,
    };
  }

  // Allow and record
  entry.timestamps.push(now);

  return {
    allowed: true,
    remaining: config.maxRequests - currentCount - 1,
    resetAt: now + config.windowMs,
    limit: config.maxRequests,
    retryAfterMs: 0,
  };
}

/**
 * Create a standardized 429 Too Many Requests response.
 * Includes proper headers per RFC 6585.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string> = {}
): Response {
  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);

  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Please retry after ${retryAfterSeconds} seconds.`,
      limit: result.limit,
      remaining: result.remaining,
      retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetAt / 1000)),
      },
    }
  );
}
