/**
 * invokeWithRetry — wraps supabase.functions.invoke with retry on transient
 * Edge Runtime errors (503 / SUPABASE_EDGE_RUNTIME_ERROR / "Service is
 * temporarily unavailable" / network blips during cold starts).
 *
 * Usage:
 *   const { data, error } = await invokeWithRetry(supabase, 'datahub-query', { body });
 */
import type { SupabaseClient, FunctionInvokeOptions } from '@supabase/supabase-js';

type InvokeResponse<T> = { data: T | null; error: Error | null };

const TRANSIENT_PATTERNS = [
  'SUPABASE_EDGE_RUNTIME_ERROR',
  'Service is temporarily unavailable',
  'non-2xx status code',
  'Failed to fetch',
  '503',
];

function isTransient(err: unknown): boolean {
  if (!err) return false;
  const msg = err instanceof Error ? err.message : String(err);
  return TRANSIENT_PATTERNS.some((p) => msg.includes(p));
}

export async function invokeWithRetry<T = unknown>(
  client: SupabaseClient,
  fn: string,
  options?: FunctionInvokeOptions,
  { retries = 2, baseDelayMs = 400 }: { retries?: number; baseDelayMs?: number } = {},
): Promise<FunctionsResponse<T>> {
  let lastResp: FunctionsResponse<T> | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const resp = (await client.functions.invoke<T>(fn, options)) as FunctionsResponse<T>;
    lastResp = resp;
    if (!resp.error || !isTransient(resp.error)) return resp;
    if (attempt < retries) {
      await new Promise((r) => setTimeout(r, baseDelayMs * Math.pow(2, attempt)));
    }
  }
  return lastResp as FunctionsResponse<T>;
}
