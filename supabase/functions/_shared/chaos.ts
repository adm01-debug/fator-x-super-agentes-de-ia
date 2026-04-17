/**
 * Chaos Engineering — fault injection middleware for edge functions
 * Reads active experiments from `chaos_experiments` table and probabilistically
 * injects faults (latency, errors, timeouts) for resilience validation.
 *
 * Zero overhead when no experiment is active for the target.
 */

export type ChaosFault = {
  id: string;
  fault_type: 'latency' | 'error_500' | 'error_429' | 'timeout';
  latency_ms: number;
};

const FAULT_CACHE_TTL_MS = 5_000; // 5s cache to avoid hammering DB
const cache = new Map<string, { faults: ChaosFault[]; expiresAt: number }>();

export async function maybeInjectFault(
  target: 'llm-gateway' | 'agent-workflow-runner',
  // deno-lint-ignore no-explicit-any
  supabaseAdmin: any,
): Promise<ChaosFault | null> {
  try {
    const now = Date.now();
    const cached = cache.get(target);
    let faults: ChaosFault[];

    if (cached && cached.expiresAt > now) {
      faults = cached.faults;
    } else {
      const { data, error } = await supabaseAdmin.rpc('get_active_chaos_faults', {
        p_target: target,
      });
      if (error) return null;
      faults = (data || []) as ChaosFault[];
      cache.set(target, { faults, expiresAt: now + FAULT_CACHE_TTL_MS });
    }

    if (faults.length === 0) return null;

    // Roll dice for each active fault — first match wins
    for (const fault of faults) {
      const probability = Number(fault.probability ?? 0);
      if (Math.random() < probability) {
        return fault;
      }
    }
    return null;
  } catch {
    return null; // chaos must never break production
  }
}

export async function applyFault(fault: ChaosFault): Promise<void> {
  switch (fault.fault_type) {
    case 'latency':
      await new Promise((r) => setTimeout(r, fault.latency_ms || 500));
      return;
    case 'error_500': {
      const e = new Error('chaos: injected 500');
      // deno-lint-ignore no-explicit-any
      (e as any).status = 500;
      throw e;
    }
    case 'error_429': {
      const e = new Error('chaos: injected 429 rate limit');
      // deno-lint-ignore no-explicit-any
      (e as any).status = 429;
      throw e;
    }
    case 'timeout':
      await new Promise((r) => setTimeout(r, 30_000));
      throw new Error('chaos: injected timeout');
  }
}
