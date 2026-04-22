/**
 * LLM Guardrail — `src/lib/llmGuardrail.ts`
 *
 * Defesa em camadas para input/output de agentes:
 *
 *  1. `scanLocal` — heurística O(1) em regex, roda no cliente, zero custo.
 *     Detecta padrões clássicos de prompt injection, PII e exfiltração.
 *  2. `scanRemote` — invoca o edge `guardrails-engine` para análise de alta
 *     fidelidade (NeMo-style 4-layer) quando o risco local for moderado+.
 *  3. `defendInput` — wrap conveniente: roda local → se "warn" sobe pro edge.
 *
 * O resultado é um veredito `GuardrailVerdict` que o call site converte em
 * ação (allow | warn | block). Severities batem com `GuardrailConfig.severity`.
 */
import { supabase } from '@/integrations/supabase/client';

export type GuardrailAction = 'allow' | 'warn' | 'block' | 'modify';
export type GuardrailLayer = 'input' | 'dialog' | 'output' | 'runtime';

export interface GuardrailHit {
  rail: string;
  layer: GuardrailLayer;
  action: GuardrailAction;
  confidence: number; // 0..1
  reason: string;
}

export interface GuardrailVerdict {
  action: GuardrailAction;
  hits: GuardrailHit[];
  source: 'local' | 'remote' | 'hybrid';
}

// ─── Local rails (fast path) ───────────────────────────────────

const INJECTION_PATTERNS: Array<[RegExp, string]> = [
  [/ignore (all |your |previous |above |any )?(instructions?|prompts?)/i, 'ignore_instructions'],
  [/disregard (all |your |previous |any )?(instructions?|prompts?)/i, 'disregard_instructions'],
  [/you are now (a |an )?/i, 'role_rewrite'],
  [/pretend (you are|to be)/i, 'role_rewrite'],
  [/jailbreak/i, 'jailbreak_keyword'],
  [/\bDAN\b/i, 'dan_mode'],
  [/do anything now/i, 'dan_mode'],
  [/bypass (your |the )?(filters?|safety|guardrails?)/i, 'bypass_filters'],
  [/reveal (your |the )?(system |internal )?prompts?/i, 'prompt_leak'],
  [/repeat (the |your )?(system |above )?(prompt|message)/i, 'prompt_leak'],
  [/what (are|were) your instructions/i, 'prompt_leak'],
  [/act as if you (are|were)/i, 'role_rewrite'],
  [/forget (the |your |all |any )?(instructions|rules|constraints)/i, 'forget_constraints'],
];

const PII_PATTERNS: Array<[RegExp, string]> = [
  [/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/, 'cpf'],
  [/\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/, 'cnpj'],
  [/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, 'credit_card'],
];

const EXFIL_PATTERNS: Array<[RegExp, string]> = [
  [/\b(api[_-]?key|service[_-]?role|sk_live_|sk_test_|ghp_)/i, 'secret_leak'],
  [/send (.*) to (http|https):\/\//i, 'exfil_http'],
  [/curl .*https?:\/\//i, 'exfil_curl'],
];

export function scanLocal(text: string): GuardrailVerdict {
  const hits: GuardrailHit[] = [];
  if (!text) return { action: 'allow', hits, source: 'local' };

  let injectionMatches = 0;
  for (const [pattern, name] of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      injectionMatches++;
      hits.push({
        rail: `injection.${name}`,
        layer: 'input',
        action: 'warn',
        confidence: 0.7,
        reason: `Pattern ${name} detected`,
      });
    }
  }
  if (injectionMatches >= 2) {
    hits.push({
      rail: 'injection.multiple',
      layer: 'input',
      action: 'block',
      confidence: 0.95,
      reason: `Múltiplos padrões de prompt injection (${injectionMatches})`,
    });
  }

  for (const [pattern, name] of PII_PATTERNS) {
    if (pattern.test(text)) {
      hits.push({
        rail: `pii.${name}`,
        layer: 'input',
        action: 'warn',
        confidence: 0.85,
        reason: `Possível ${name} no texto`,
      });
    }
  }

  for (const [pattern, name] of EXFIL_PATTERNS) {
    if (pattern.test(text)) {
      hits.push({
        rail: `exfil.${name}`,
        layer: 'input',
        action: 'block',
        confidence: 0.85,
        reason: `Tentativa de exfiltração (${name})`,
      });
    }
  }

  const action: GuardrailAction = hits.some((h) => h.action === 'block')
    ? 'block'
    : hits.some((h) => h.action === 'warn')
      ? 'warn'
      : 'allow';

  return { action, hits, source: 'local' };
}

// ─── Remote rails (high fidelity) ──────────────────────────────

export interface RemoteScanInput {
  text: string;
  agent_id?: string;
  action?: 'check_input' | 'check_output' | 'check_full';
}

export async function scanRemote(input: RemoteScanInput): Promise<GuardrailVerdict> {
  const { data, error } = await supabase.functions.invoke('guardrails-engine', {
    body: {
      action: input.action ?? 'check_input',
      text: input.text,
      agent_id: input.agent_id,
    },
  });
  if (error) throw error;

  const rails = (data as { rails?: GuardrailHit[]; action?: GuardrailAction } | null)?.rails ?? [];
  const remoteAction =
    (data as { action?: GuardrailAction } | null)?.action ??
    (rails.some((r) => r.action === 'block')
      ? 'block'
      : rails.some((r) => r.action === 'warn')
        ? 'warn'
        : 'allow');

  return { action: remoteAction, hits: rails, source: 'remote' };
}

// ─── Composed defense ──────────────────────────────────────────

export interface DefendOptions {
  agentId?: string;
  /** Se true, força chamar o edge mesmo quando local = allow (default false). */
  alwaysRemote?: boolean;
}

export async function defendInput(
  text: string,
  options: DefendOptions = {},
): Promise<GuardrailVerdict> {
  const local = scanLocal(text);
  if (local.action === 'block') return local; // sem necessidade de network
  if (local.action === 'allow' && !options.alwaysRemote) return local;

  try {
    const remote = await scanRemote({ text, agent_id: options.agentId, action: 'check_input' });
    return {
      action: remote.action === 'allow' ? local.action : remote.action,
      hits: [...local.hits, ...remote.hits],
      source: 'hybrid',
    };
  } catch {
    // se o edge falha, a decisão local prevalece — fail-safe
    return local;
  }
}

export class GuardrailBlockedError extends Error {
  readonly verdict: GuardrailVerdict;
  constructor(verdict: GuardrailVerdict) {
    super(
      verdict.hits
        .filter((h) => h.action === 'block')
        .map((h) => h.reason)
        .join('; ') || 'Guardrail bloqueou a entrada',
    );
    this.name = 'GuardrailBlockedError';
    this.verdict = verdict;
  }
}

export async function assertInputAllowed(
  text: string,
  options: DefendOptions = {},
): Promise<GuardrailVerdict> {
  const verdict = await defendInput(text, options);
  if (verdict.action === 'block') throw new GuardrailBlockedError(verdict);
  return verdict;
}
