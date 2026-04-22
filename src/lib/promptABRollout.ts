/**
 * Prompt A/B Rollout — `src/lib/promptABRollout.ts`
 *
 * Helper sticky-session para roteamento de tráfego em experimentos de
 * prompt (tabela `prompt_experiments`). Uma vez que um session_key cai
 * na variante A, ele **continua** em A para o resto do experimento.
 *
 * Implementa o contrato esperado por `promptExperimentService`:
 *   - `traffic_split: number` ∈ [0, 1] — fração que vai para variante B
 *   - sticky por hash(session_key) → [0, 1)
 *
 * Determinístico: o mesmo session_key + experiment_id sempre devolve a
 * mesma variante. Isso garante consistência de UX e também que a
 * métrica seja atribuída corretamente ao rollout.
 */

export type Variant = 'a' | 'b';

export interface SelectVariantInput {
  experiment_id: string;
  session_key: string;
  /** Fração do tráfego destinada à variante B (0..1). */
  traffic_split: number;
}

/** FNV-1a 32-bit — simples, rápido, zero dependências. */
export function hashFNV1a(s: string): number {
  let h = 0x811c9dc5; // offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Retorna um número determinístico em [0, 1) a partir do par (experiment, session). */
export function hashToUnitInterval(experimentId: string, sessionKey: string): number {
  const h = hashFNV1a(`${experimentId}::${sessionKey}`);
  return h / 0x1_0000_0000; // divide por 2^32
}

export function selectVariantForSession(input: SelectVariantInput): Variant {
  const split = clamp01(input.traffic_split);
  if (split <= 0) return 'a';
  if (split >= 1) return 'b';
  const u = hashToUnitInterval(input.experiment_id, input.session_key);
  return u < split ? 'b' : 'a';
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/**
 * Computa a distribuição empírica de uma lista de session_keys sob um split
 * fixado. Útil para validar em teste / UI se o rollout está funcionando.
 */
export function estimateSplit(
  experimentId: string,
  sessionKeys: string[],
  traffic_split: number,
): { a: number; b: number; pct_b: number } {
  let a = 0;
  let b = 0;
  for (const key of sessionKeys) {
    const v = selectVariantForSession({
      experiment_id: experimentId,
      session_key: key,
      traffic_split,
    });
    if (v === 'a') a++;
    else b++;
  }
  const pct_b = sessionKeys.length === 0 ? 0 : b / sessionKeys.length;
  return { a, b, pct_b };
}
