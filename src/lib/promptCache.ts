/**
 * Prompt Cache — `src/lib/promptCache.ts`
 *
 * Converte um `AgentConfig` no formato de mensagens com **cache breakpoints**
 * explícitos que o Lovable AI Gateway repassa pros providers que suportam
 * prompt caching:
 *
 *   - Anthropic: `cache_control: { type: 'ephemeral' }` (TTL 5m ou 1h)
 *   - OpenAI: caching automático para prefixos ≥ 1024 tokens (apenas sinalizamos boundary)
 *   - Google Gemini: `cachedContent` (cache explícito server-side)
 *
 * Estratégia: o **system prompt**, os **few-shot examples** e a lista de
 * tools (catalog) são quase sempre estáveis entre turns — cacheamos esse
 * prefixo; a mensagem do usuário (última) fica fora do cache.
 *
 * Economia esperada: 50-90% no custo de `input_tokens` em prompts longos
 * (nosso system prompt dos 7 agentes enriquecidos é ~6 KB = ~1500 tokens).
 */

export type CacheTTL = '5m' | '1h';

export interface CachableMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** Quando true, o gateway injeta `cache_control.ephemeral` aqui. */
  cache_checkpoint?: boolean;
  cache_ttl?: CacheTTL;
}

export interface BuildCachedPromptInput {
  system_prompt: string;
  few_shot: Array<{ input: string; expected_output: string }>;
  tools_descriptor?: string; // JSON schema serializado das tools (estável)
  user_message: string;
  history?: Array<{ role: 'user' | 'assistant' | 'tool'; content: string }>;
  ttl?: CacheTTL;
}

/**
 * Estrutura o prompt com 1-3 breakpoints de cache estratégicos:
 *
 *   [system_prompt] ← breakpoint #1 (1h) — muda raramente
 *   [tools_descriptor] ← breakpoint #2 (1h) — muda em deploy
 *   [few_shot + history] ← breakpoint #3 (5m) — muda por conversa
 *   [user_message] ← sem cache (sempre novo)
 */
export function buildCachedPrompt(input: BuildCachedPromptInput): CachableMessage[] {
  const ttl = input.ttl ?? '1h';
  const messages: CachableMessage[] = [];

  // 1. System prompt — breakpoint longo
  messages.push({
    role: 'system',
    content: input.system_prompt,
    cache_checkpoint: true,
    cache_ttl: ttl,
  });

  // 2. Tools descriptor — breakpoint longo (quando presente)
  if (input.tools_descriptor) {
    messages.push({
      role: 'system',
      content: `AVAILABLE TOOLS:\n${input.tools_descriptor}`,
      cache_checkpoint: true,
      cache_ttl: ttl,
    });
  }

  // 3. Few-shot — breakpoint curto (raramente muda durante a sessão)
  if (input.few_shot.length > 0) {
    const fewShotSerialized = input.few_shot
      .map(
        (ex, i) => `### Exemplo ${i + 1}\nUSUÁRIO: ${ex.input}\nASSISTENTE: ${ex.expected_output}`,
      )
      .join('\n\n');
    messages.push({
      role: 'system',
      content: `EXEMPLOS DE RESPOSTA:\n${fewShotSerialized}`,
      cache_checkpoint: true,
      cache_ttl: '5m',
    });
  }

  // 4. Histórico — sem cache (volátil)
  for (const h of input.history ?? []) {
    messages.push({ role: h.role, content: h.content });
  }

  // 5. User message — sem cache
  messages.push({ role: 'user', content: input.user_message });

  return messages;
}

/**
 * Estima quantos tokens serão beneficiados pelo cache.
 * Heurística conservadora: ~4 chars por token.
 */
export function estimateCachedTokens(messages: CachableMessage[]): {
  cached: number;
  fresh: number;
  savings_pct: number;
} {
  let cached = 0;
  let fresh = 0;
  for (const m of messages) {
    const t = Math.ceil(m.content.length / 4);
    if (m.cache_checkpoint) cached += t;
    else fresh += t;
  }
  const total = cached + fresh;
  const savings_pct = total > 0 ? Math.round((cached / total) * 100) : 0;
  return { cached, fresh, savings_pct };
}

/**
 * Hash estável do prefixo cacheado — serve como `cache_key` idempotente
 * para debug / métricas. Usa FNV-1a 32-bit (mesmo hash do A/B rollout).
 */
export function cacheKey(messages: CachableMessage[]): string {
  const prefix = messages
    .filter((m) => m.cache_checkpoint)
    .map((m) => `${m.role}:${m.content}`)
    .join('\n');
  let h = 0x811c9dc5;
  for (let i = 0; i < prefix.length; i++) {
    h ^= prefix.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `pc_${h.toString(16).padStart(8, '0')}`;
}
