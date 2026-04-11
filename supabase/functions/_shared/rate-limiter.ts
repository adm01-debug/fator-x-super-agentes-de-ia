/**
 * Nexus Agents Studio — Shared Rate Limiter (HARDENED)
 * FIX P0-01: Postgres-backed sliding window (was in-memory Map)
 * 
 * Usage:
 *   import { checkRateLimit, RATE_LIMITS } from "../_shared/rate-limiter.ts";
 *   const result = await checkRateLimit(supabase, identifier, RATE_LIMITS.standard, workspaceId);
 *   if (!result.allowed) return createRateLimitResponse(result, corsHeaders);
 */

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  llm: { windowMs: 60_000, maxRequests: 15, name: 'llm' } as RateLimitConfig,
  heavy: { windowMs: 60_000, maxRequests: 5, name: 'heavy' } as RateLimitConfig,
  auth: { windowMs: 300_000, maxRequests: 10, name: 'auth' } as RateLimitConfig,
  webhook: { windowMs: 60_000, maxRequests: 60, name: 'webhook' } as RateLimitConfig,
  datahub: { windowMs: 60_000, maxRequests: 20, name: 'datahub' } as RateLimitConfig,
  oracle: { windowMs: 60_000, maxRequests: 3, name: 'oracle' } as RateLimitConfig,
} as const;

/**
 * Extract rate limit identifier from request.
 * Priority: user_id > API key > IP > 'anonymous'
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
 * Check rate limit using Postgres RPC (distributed, persistent).
 * Falls back to allow-with-warning if DB unavailable.
 */
export async function checkRateLimit(
  supabase: SupabaseClient,
  identifier: string,
  config: RateLimitConfig = RATE_LIMITS.standard,
  workspaceId?: string
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowSeconds = Math.ceil(config.windowMs / 1000);

  try {
    const { data, error } = await supabase.rpc('check_rate_limit', {
      p_identifier: identifier,
      p_window_seconds: windowSeconds,
      p_max_requests: config.maxRequests,
      p_workspace_id: workspaceId || null,
      p_limit_name: config.name || 'default'
    });

    if (error) throw error;

    const result = data as { allowed: boolean; current_count: number; oldest_timestamp: string | null };
    
    if (!result.allowed) {
      const oldest = result.oldest_timestamp ? new Date(result.oldest_timestamp).getTime() : now;
      const resetAt = oldest + config.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        limit: config.maxRequests,
        retryAfterMs: Math.max(0, resetAt - now),
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - result.current_count,
      resetAt: now + config.windowMs,
      limit: config.maxRequests,
      retryAfterMs: 0,
    };
  } catch (err) {
    // Fail-open with warning (better than blocking all traffic on DB issues)
    console.warn('[rate-limiter] DB error, allowing request:', err);
    return {
      allowed: true,
      remaining: config.maxRequests,
      resetAt: now + config.windowMs,
      limit: config.maxRequests,
      retryAfterMs: 0,
    };
  }
}

/**
 * Create 429 response with standard headers (RFC 6585).
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
