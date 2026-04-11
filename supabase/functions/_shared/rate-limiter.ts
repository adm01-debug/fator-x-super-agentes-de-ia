/**
 * Nexus Agents Studio — Shared Rate Limiter
 * In-memory sliding window rate limiter for Edge Functions.
 * Each function instance has its own state — good enough for single-instance Deno Deploy.
 */

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  name?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  limit: number;
  retryAfterMs: number;
}

export const RATE_LIMITS = {
  standard: { windowMs: 60_000, maxRequests: 30, name: 'standard' } as RateLimitConfig,
  llm:      { windowMs: 60_000, maxRequests: 15, name: 'llm' } as RateLimitConfig,
  heavy:    { windowMs: 60_000, maxRequests: 5,  name: 'heavy' } as RateLimitConfig,
  auth:     { windowMs: 300_000, maxRequests: 10, name: 'auth' } as RateLimitConfig,
  webhook:  { windowMs: 60_000, maxRequests: 60, name: 'webhook' } as RateLimitConfig,
  datahub:  { windowMs: 60_000, maxRequests: 20, name: 'datahub' } as RateLimitConfig,
  oracle:   { windowMs: 60_000, maxRequests: 3,  name: 'oracle' } as RateLimitConfig,
} as const;

// In-memory store: identifier -> timestamps[]
const store = new Map<string, number[]>();
const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function cleanup(now: number) {
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, timestamps] of store) {
    const filtered = timestamps.filter(t => now - t < 300_000);
    if (filtered.length === 0) store.delete(key);
    else store.set(key, filtered);
  }
}

/**
 * Extract rate limit identifier from request.
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
 * Check rate limit (synchronous, in-memory sliding window).
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.standard
): RateLimitResult {
  const now = Date.now();
  cleanup(now);

  const timestamps = store.get(identifier) || [];
  const windowStart = now - config.windowMs;
  const recent = timestamps.filter(t => t > windowStart);

  if (recent.length >= config.maxRequests) {
    const oldest = recent[0];
    const resetAt = oldest + config.windowMs;
    return {
      allowed: false,
      remaining: 0,
      resetAt,
      limit: config.maxRequests,
      retryAfterMs: Math.max(0, resetAt - now),
    };
  }

  recent.push(now);
  store.set(identifier, recent);

  return {
    allowed: true,
    remaining: config.maxRequests - recent.length,
    resetAt: now + config.windowMs,
    limit: config.maxRequests,
    retryAfterMs: 0,
  };
}

/**
 * Create 429 response with standard headers.
 */
export function createRateLimitResponse(
  result: RateLimitResult,
  corsHeaders: Record<string, string> = {}
): Response {
  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      message: `Too many requests. Retry after ${retryAfterSeconds} seconds.`,
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
