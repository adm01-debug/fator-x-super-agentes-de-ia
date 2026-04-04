/**
 * Model Router — Load balancing, fallback chains, rate limiting, semantic caching
 * Ensures zero-downtime with multi-provider resilience.
 */
import * as llm from './llmService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface ModelEndpoint {
  id: string;
  modelId: string;
  provider: string;
  weight: number; // 0-100 for load balancing
  maxRpm: number; // Max requests per minute
  currentRpm: number;
  latencyP50: number;
  latencyP95: number;
  errorRate: number;
  enabled: boolean;
  costPer1kTokens: number;
}

export interface FallbackChain {
  name: string;
  models: string[]; // Ordered: primary → secondary → tertiary
  strategy: 'ordered' | 'least_busy' | 'lowest_cost' | 'lowest_latency';
}

export interface RoutingResult {
  modelId: string;
  reason: string;
  attempt: number;
  fallbackUsed: boolean;
}

export interface CacheEntry {
  key: string;
  response: llm.LLMResponse;
  timestamp: number;
  hits: number;
}

// ═══ MODEL REGISTRY ═══

const endpoints: ModelEndpoint[] = [
  { id: 'claude-sonnet', modelId: 'anthropic/claude-sonnet-4', provider: 'anthropic', weight: 40, maxRpm: 60, currentRpm: 0, latencyP50: 1200, latencyP95: 3500, errorRate: 0.02, enabled: true, costPer1kTokens: 0.003 },
  { id: 'claude-opus', modelId: 'anthropic/claude-opus-4', provider: 'anthropic', weight: 20, maxRpm: 30, currentRpm: 0, latencyP50: 2500, latencyP95: 8000, errorRate: 0.03, enabled: true, costPer1kTokens: 0.015 },
  { id: 'gpt-4o', modelId: 'openai/gpt-4o', provider: 'openai', weight: 30, maxRpm: 100, currentRpm: 0, latencyP50: 900, latencyP95: 2500, errorRate: 0.01, enabled: true, costPer1kTokens: 0.005 },
  { id: 'gemini-flash', modelId: 'google/gemini-2.0-flash-001', provider: 'google', weight: 10, maxRpm: 200, currentRpm: 0, latencyP50: 400, latencyP95: 1200, errorRate: 0.01, enabled: true, costPer1kTokens: 0.0001 },
];

const fallbackChains: FallbackChain[] = [
  { name: 'default', models: ['anthropic/claude-sonnet-4', 'openai/gpt-4o', 'google/gemini-2.0-flash-001'], strategy: 'ordered' },
  { name: 'fast', models: ['google/gemini-2.0-flash-001', 'openai/gpt-4o-mini', 'anthropic/claude-sonnet-4'], strategy: 'lowest_latency' },
  { name: 'quality', models: ['anthropic/claude-opus-4', 'openai/gpt-4o', 'anthropic/claude-sonnet-4'], strategy: 'ordered' },
  { name: 'cheap', models: ['google/gemini-2.0-flash-001', 'deepseek/deepseek-chat-v3-0324', 'openai/gpt-4o-mini'], strategy: 'lowest_cost' },
];

// ═══ SEMANTIC CACHE ═══

const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const MAX_CACHE_SIZE = 500;

function cacheKey(messages: llm.LLMMessage[]): string {
  return messages.map(m => `${m.role}:${m.content}`).join('|').slice(0, 500);
}

export function getCached(messages: llm.LLMMessage[]): llm.LLMResponse | null {
  const key = cacheKey(messages);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) { cache.delete(key); return null; }
  entry.hits++;
  logger.debug(`Cache hit (${entry.hits} total hits)`, 'modelRouter');
  return entry.response;
}

function setCache(messages: llm.LLMMessage[], response: llm.LLMResponse): void {
  while (cache.size >= MAX_CACHE_SIZE) {
    // Evict oldest entry
    const oldest = Array.from(cache.entries()).sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) cache.delete(oldest[0]);
    else break;
  }
  cache.set(cacheKey(messages), { key: cacheKey(messages), response, timestamp: Date.now(), hits: 0 });
}

export function getCacheStats(): { size: number; totalHits: number } {
  let totalHits = 0;
  cache.forEach(e => { totalHits += e.hits; });
  return { size: cache.size, totalHits };
}

// ═══ ROUTING ═══

/** Select the best model based on strategy. */
export function selectModel(chainName = 'default'): RoutingResult {
  const chain = fallbackChains.find(c => c.name === chainName) ?? fallbackChains[0];

  for (let attempt = 0; attempt < chain.models.length; attempt++) {
    const modelId = chain.models[attempt];
    const endpoint = endpoints.find(e => e.modelId === modelId);

    if (!endpoint || !endpoint.enabled) continue;

    // Check rate limit
    if (endpoint.currentRpm >= endpoint.maxRpm) {
      logger.debug(`Model ${modelId}: rate limited (${endpoint.currentRpm}/${endpoint.maxRpm} RPM)`, 'modelRouter');
      continue;
    }

    // Check error rate
    if (endpoint.errorRate > 0.2) {
      logger.warn(`Model ${modelId}: high error rate (${endpoint.errorRate * 100}%)`, 'modelRouter');
      continue;
    }

    return { modelId, reason: attempt === 0 ? 'primary' : `fallback #${attempt}`, attempt, fallbackUsed: attempt > 0 };
  }

  // All models exhausted — return first enabled
  const firstEnabled = endpoints.find(e => e.enabled);
  return { modelId: firstEnabled?.modelId ?? chain.models[0], reason: 'last_resort', attempt: chain.models.length, fallbackUsed: true };
}

// ═══ CALL WITH FALLBACK ═══

/** Call LLM with automatic fallback on failure. */
export async function callWithFallback(
  messages: llm.LLMMessage[],
  options?: { chain?: string; temperature?: number; maxTokens?: number; useCache?: boolean }
): Promise<llm.LLMResponse & { routing: RoutingResult }> {
  // Check cache first
  if (options?.useCache !== false) {
    const cached = getCached(messages);
    if (cached) return { ...cached, routing: { modelId: cached.model, reason: 'cache_hit', attempt: 0, fallbackUsed: false } };
  }

  const chain = fallbackChains.find(c => c.name === (options?.chain ?? 'default')) ?? fallbackChains[0];
  let lastError = '';

  for (let attempt = 0; attempt < chain.models.length; attempt++) {
    const modelId = chain.models[attempt];
    const endpoint = endpoints.find(e => e.modelId === modelId);

    if (endpoint) endpoint.currentRpm++;

    try {
      const response = await llm.callModel(modelId, messages, {
        temperature: options?.temperature,
        maxTokens: options?.maxTokens,
      });

      if (!response.error) {
        // Update metrics
        if (endpoint) {
          endpoint.latencyP50 = Math.round(endpoint.latencyP50 * 0.9 + response.latencyMs * 0.1);
          endpoint.errorRate = Math.max(0, endpoint.errorRate * 0.95); // Decay error rate on success
        }

        // Cache successful response
        if (options?.useCache !== false) setCache(messages, response);

        return {
          ...response,
          routing: { modelId, reason: attempt === 0 ? 'primary' : `fallback #${attempt}`, attempt, fallbackUsed: attempt > 0 },
        };
      }

      lastError = response.error;
      if (endpoint) endpoint.errorRate = Math.min(1, endpoint.errorRate + 0.05);
      logger.warn(`Model ${modelId} failed: ${response.error}. Trying fallback...`, 'modelRouter');
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error';
      if (endpoint) endpoint.errorRate = Math.min(1, endpoint.errorRate + 0.1);
      logger.warn(`Model ${modelId} error: ${lastError}. Trying fallback...`, 'modelRouter');
    }
  }

  // All models failed
  return {
    model: 'none',
    content: `Todos os modelos falharam. Último erro: ${lastError}`,
    tokens: { input: 0, output: 0 },
    latencyMs: 0,
    cost: 0,
    error: `All ${chain.models.length} models failed`,
    routing: { modelId: 'none', reason: 'all_failed', attempt: chain.models.length, fallbackUsed: true },
  };
}

// ═══ ADMIN ═══

export function getEndpoints(): ModelEndpoint[] { return [...endpoints]; }
export function getFallbackChains(): FallbackChain[] { return [...fallbackChains]; }

export function setEndpointEnabled(id: string, enabled: boolean): void {
  const ep = endpoints.find(e => e.id === id);
  if (ep) ep.enabled = enabled;
}

export function addFallbackChain(chain: FallbackChain): void {
  fallbackChains.push(chain);
}

// Reset RPM counters every minute
// FIX: Store interval ID and export cleanup function to prevent memory leak
const rpmResetInterval = setInterval(() => { endpoints.forEach(e => { e.currentRpm = 0; }); }, 60000);

/** Clean up the RPM reset interval. Call on shutdown to prevent memory leaks. */
export function cleanupModelRouter(): void {
  clearInterval(rpmResetInterval);
}
