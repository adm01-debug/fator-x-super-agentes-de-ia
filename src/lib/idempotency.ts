const IDEMPOTENCY_CACHE = new Map<string, { response: unknown; timestamp: number }>();
const TTL_MS = 5 * 60 * 1000; // 5 minutes

export function generateIdempotencyKey(operation: string, ...args: unknown[]): string {
  return `${operation}:${JSON.stringify(args)}`;
}

export function getCachedResponse<T>(key: string): T | null {
  const entry = IDEMPOTENCY_CACHE.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL_MS) {
    IDEMPOTENCY_CACHE.delete(key);
    return null;
  }
  return entry.response as T;
}

export function setCachedResponse(key: string, response: unknown): void {
  IDEMPOTENCY_CACHE.set(key, { response, timestamp: Date.now() });
  // Cleanup old entries
  if (IDEMPOTENCY_CACHE.size > 1000) {
    const now = Date.now();
    for (const [k, v] of IDEMPOTENCY_CACHE) {
      if (now - v.timestamp > TTL_MS) IDEMPOTENCY_CACHE.delete(k);
    }
  }
}
