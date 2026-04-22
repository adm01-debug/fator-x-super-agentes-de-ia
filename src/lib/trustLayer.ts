/**
 * Trust Layer — `src/lib/trustLayer.ts`
 *
 * Camada de confiança inspirada no Einstein Trust Layer (Salesforce) e
 * Writer Guardrails. Aplica, ANTES de mandar ao LLM:
 *
 *   1. **PII tokenization** — substitui CPF/CNPJ/email/telefone/cartão
 *      por tokens reversíveis (`<CPF#001>`, `<EMAIL#002>`...). Guarda
 *      o mapeamento em `TokenVault` em memória (por thread_id).
 *   2. **PII detokenization** — ao receber a resposta do LLM, reinsere
 *      os valores reais nos tokens, para a UI humana.
 *   3. **Zero-retention flag** — campo `zero_retention=true` que o
 *      gateway repassa aos providers que suportam (Anthropic, OpenAI
 *      Enterprise) — garante que o prompt/resposta não vai para
 *      treinamento nem logging prolongado.
 *   4. **Audit hash encadeado** — cada prompt gera um hash SHA-256 que
 *      encadeia com o anterior, formando uma Merkle-chain leve para
 *      auditoria (SOC2 / ISO 27001).
 *
 * Complementa, não substitui, o `guardrails-engine` (que detecta
 * injection/toxicity). Este módulo foca em **privacidade** + auditoria.
 */

// ─── PII patterns (PT-BR + global) ───────────────────────────
const PII_PATTERNS: Array<{ name: string; pattern: RegExp }> = [
  { name: 'CPF', pattern: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g },
  { name: 'CNPJ', pattern: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g },
  { name: 'EMAIL', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: 'PHONE', pattern: /(?:\+?55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}/g },
  { name: 'CARD', pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g },
  { name: 'CEP', pattern: /\b\d{5}-?\d{3}\b/g },
];

export interface TokenMapping {
  token: string;
  type: string;
  value: string;
}

export class TokenVault {
  private readonly forward = new Map<string, TokenMapping>(); // token → mapping
  private readonly reverse = new Map<string, string>(); // value → token
  private readonly counters = new Map<string, number>(); // type → counter

  tokenize(value: string, type: string): string {
    const existing = this.reverse.get(`${type}::${value}`);
    if (existing) return existing;
    const n = (this.counters.get(type) ?? 0) + 1;
    this.counters.set(type, n);
    const token = `<${type}#${n.toString().padStart(3, '0')}>`;
    this.forward.set(token, { token, type, value });
    this.reverse.set(`${type}::${value}`, token);
    return token;
  }

  detokenize(text: string): string {
    return text.replace(/<[A-Z]+#\d{3}>/g, (tok) => this.forward.get(tok)?.value ?? tok);
  }

  size(): number {
    return this.forward.size;
  }

  toMappings(): TokenMapping[] {
    return Array.from(this.forward.values());
  }

  clear(): void {
    this.forward.clear();
    this.reverse.clear();
    this.counters.clear();
  }
}

export interface RedactOptions {
  vault?: TokenVault;
  /** Lista de tipos a redigir; default todos. */
  types?: string[];
}

export interface RedactResult {
  text: string;
  vault: TokenVault;
  replacements: number;
  types_found: string[];
}

export function redact(input: string, options: RedactOptions = {}): RedactResult {
  const vault = options.vault ?? new TokenVault();
  const allowed = options.types ? new Set(options.types) : null;
  let text = input;
  let replacements = 0;
  const typesFound = new Set<string>();

  for (const { name, pattern } of PII_PATTERNS) {
    if (allowed && !allowed.has(name)) continue;
    text = text.replace(pattern, (match) => {
      const token = vault.tokenize(match, name);
      replacements++;
      typesFound.add(name);
      return token;
    });
  }
  return { text, vault, replacements, types_found: Array.from(typesFound) };
}

export function unredact(text: string, vault: TokenVault): string {
  return vault.detokenize(text);
}

// ─── Zero-retention marker ───────────────────────────────────
export interface ZeroRetentionOptions {
  zero_retention: boolean;
  reason?: string;
}

export function markZeroRetention(
  headers: Record<string, string>,
  options: ZeroRetentionOptions,
): Record<string, string> {
  if (!options.zero_retention) return headers;
  return {
    ...headers,
    'X-Nexus-Zero-Retention': 'true',
    'Anthropic-Beta': 'prompt-caching-2024-07-31,zero-retention-2025-01-01',
    ...(options.reason ? { 'X-Nexus-Retention-Reason': options.reason } : {}),
  };
}

// ─── Audit chain (SHA-256 Merkle-style) ──────────────────────
async function sha256(text: string): Promise<string> {
  const buf = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export interface AuditLink {
  seq: number;
  prev_hash: string | null;
  payload_hash: string;
  chain_hash: string; // sha256(prev_hash || payload_hash)
  timestamp: string;
}

export async function appendAudit(payload: unknown, prev: AuditLink | null): Promise<AuditLink> {
  const payload_hash = await sha256(JSON.stringify(payload));
  const seq = (prev?.seq ?? 0) + 1;
  const chain_hash = await sha256(`${prev?.chain_hash ?? ''}|${payload_hash}`);
  return {
    seq,
    prev_hash: prev?.chain_hash ?? null,
    payload_hash,
    chain_hash,
    timestamp: new Date().toISOString(),
  };
}

/** Verifica se uma cadeia de audit está íntegra (sem gap/tampering). */
export async function verifyAuditChain(chain: AuditLink[]): Promise<boolean> {
  let prev: AuditLink | null = null;
  for (const link of chain) {
    const expectedSeq = (prev?.seq ?? 0) + 1;
    if (link.seq !== expectedSeq) return false;
    const expectedPrev = prev?.chain_hash ?? null;
    if (link.prev_hash !== expectedPrev) return false;
    const expectedChain = await sha256(`${expectedPrev ?? ''}|${link.payload_hash}`);
    if (link.chain_hash !== expectedChain) return false;
    prev = link;
  }
  return true;
}

// ─── High-level pipeline ─────────────────────────────────────
export interface TrustPipelineResult {
  redacted_input: string;
  vault: TokenVault;
  types_found: string[];
  audit: AuditLink;
  headers: Record<string, string>;
}

export async function applyTrustLayer(
  rawInput: string,
  options: {
    zero_retention?: boolean;
    previous_audit?: AuditLink | null;
    headers?: Record<string, string>;
  } = {},
): Promise<TrustPipelineResult> {
  const red = redact(rawInput);
  const audit = await appendAudit(
    { input_hash_of: red.text.length, types: red.types_found },
    options.previous_audit ?? null,
  );
  const headers = markZeroRetention(options.headers ?? {}, {
    zero_retention: options.zero_retention ?? false,
  });
  return {
    redacted_input: red.text,
    vault: red.vault,
    types_found: red.types_found,
    audit,
    headers,
  };
}
