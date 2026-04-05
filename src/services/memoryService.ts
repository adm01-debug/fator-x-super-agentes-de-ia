/**
 * Memory Service — Persistence layer for agent memory (6 layers)
 * Stores in localStorage with optional Supabase sync.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface MemoryEntry {
  id: string;
  layer: 'short_term' | 'episodic' | 'semantic' | 'procedural' | 'profile' | 'shared';
  agentId: string;
  content: string;
  metadata?: Record<string, unknown>;
  confidence?: number;
  source?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface MemoryLayerConfig {
  enabled: boolean;
  retention: string;
  strategy: string;
  maxEntries: number;
}

// ═══ STORAGE ═══

const STORAGE_KEY = 'nexus_agent_memory';

function loadAll(): Record<string, MemoryEntry[]> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch { return {}; }
}

function saveAll(data: Record<string, MemoryEntry[]>): void {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch { /* quota */ }
}

// ═══ CRUD ═══

/** Add a memory entry to a specific layer for an agent. */
export function addMemory(agentId: string, layer: MemoryEntry['layer'], content: string, opts?: { metadata?: Record<string, unknown>; confidence?: number; source?: string; ttlDays?: number }): MemoryEntry {
  const entry: MemoryEntry = {
    id: crypto.randomUUID(),
    layer, agentId, content,
    metadata: opts?.metadata,
    confidence: opts?.confidence ?? 80,
    source: opts?.source ?? 'user',
    createdAt: new Date().toISOString(),
    expiresAt: opts?.ttlDays ? new Date(Date.now() + opts.ttlDays * 86400000).toISOString() : undefined,
  };

  const all = loadAll();
  const key = `${agentId}:${layer}`;
  if (!all[key]) all[key] = [];
  all[key].unshift(entry);

  // Enforce max entries per layer
  const maxEntries = layer === 'short_term' ? 20 : layer === 'episodic' ? 200 : 500;
  if (all[key].length > maxEntries) all[key].length = maxEntries;

  saveAll(all);
  persistToSupabase(entry);
  logger.debug(`Memory added: ${layer}/${agentId} — "${content.slice(0, 50)}..."`, 'memoryService');
  return entry;
}

/** Get all memories for an agent layer. */
export function getMemories(agentId: string, layer: MemoryEntry['layer']): MemoryEntry[] {
  const all = loadAll();
  const entries = all[`${agentId}:${layer}`] ?? [];
  // Filter expired
  const now = new Date().toISOString();
  return entries.filter(e => !e.expiresAt || e.expiresAt > now);
}

/** Get all memories across all layers for an agent. */
export function getAllMemories(agentId: string): Record<string, MemoryEntry[]> {
  const result: Record<string, MemoryEntry[]> = {};
  const layers: MemoryEntry['layer'][] = ['short_term', 'episodic', 'semantic', 'procedural', 'profile', 'shared'];
  layers.forEach(layer => {
    const entries = getMemories(agentId, layer);
    if (entries.length > 0) result[layer] = entries;
  });
  return result;
}

/** Delete a specific memory entry. */
export function deleteMemory(agentId: string, layer: MemoryEntry['layer'], entryId: string): void {
  const all = loadAll();
  const key = `${agentId}:${layer}`;
  if (all[key]) {
    all[key] = all[key].filter(e => e.id !== entryId);
    saveAll(all);
  }
}

/** Clear all memories for an agent layer. */
export function clearLayer(agentId: string, layer: MemoryEntry['layer']): number {
  const all = loadAll();
  const key = `${agentId}:${layer}`;
  const count = all[key]?.length ?? 0;
  delete all[key];
  saveAll(all);
  logger.info(`Memory cleared: ${layer}/${agentId} — ${count} entries`, 'memoryService');
  return count;
}

/** Clear ALL memories for an agent. */
export function clearAllMemories(agentId: string): number {
  const all = loadAll();
  let total = 0;
  Object.keys(all).forEach(key => {
    if (key.startsWith(`${agentId}:`)) {
      total += all[key].length;
      delete all[key];
    }
  });
  saveAll(all);
  return total;
}

/** Get memory stats for an agent. */
export function getStats(agentId: string): { layer: string; count: number; sizeBytes: number }[] {
  const all = loadAll();
  const layers: MemoryEntry['layer'][] = ['short_term', 'episodic', 'semantic', 'procedural', 'profile', 'shared'];
  return layers.map(layer => {
    const entries = all[`${agentId}:${layer}`] ?? [];
    const size = JSON.stringify(entries).length;
    return { layer, count: entries.length, sizeBytes: size };
  });
}

/** Search memories across layers by content. */
export function searchMemories(agentId: string, query: string, limit = 10): MemoryEntry[] {
  const allMem = getAllMemories(agentId);
  const results: MemoryEntry[] = [];
  const q = query.toLowerCase();
  Object.values(allMem).forEach(entries => {
    entries.forEach(e => {
      if (e.content.toLowerCase().includes(q)) results.push(e);
    });
  });
  return results.slice(0, limit);
}

// ═══ AUTO-MEMORY FROM CONVERSATIONS ═══

/** Auto-extract memories from a conversation turn. Call after each LLM response. */
export function autoExtractFromConversation(agentId: string, userMessage: string, assistantResponse: string): void {
  // Short-term: always save last exchange
  addMemory(agentId, 'short_term', `User: ${userMessage.slice(0, 200)}\nAssistant: ${assistantResponse.slice(0, 200)}`, { source: 'auto', ttlDays: 1 });

  // Episodic: save if response is substantial (>100 chars)
  if (assistantResponse.length > 100) {
    addMemory(agentId, 'episodic', `Interaction: "${userMessage.slice(0, 100)}" → Response about ${assistantResponse.slice(0, 150)}...`, { source: 'auto-episodic', ttlDays: 90 });
  }
}

// ═══ LAYER → COLLECTION ID MAP ═══

const LAYER_COLLECTION_MAP: Record<MemoryEntry['layer'], string> = {
  short_term: 'col_short_term',
  episodic: 'col_episodic',
  semantic: 'col_semantic',
  procedural: 'col_procedural',
  profile: 'col_profile',
  shared: 'col_shared',
};

function layerToCollectionId(layer: MemoryEntry['layer']): string {
  return LAYER_COLLECTION_MAP[layer] ?? layer;
}

// ═══ WORKSPACE HELPER ═══

async function getWorkspaceId(): Promise<string | null> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return null;
    const { data } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .limit(1)
      .single();
    return data?.workspace_id ?? null;
  } catch {
    return null;
  }
}

// ═══ SUPABASE PERSISTENCE (async, fire-and-forget) ═══

async function persistToSupabase(entry: MemoryEntry): Promise<void> {
  try {
    const workspaceId = await getWorkspaceId();
    await supabase.from('brain_facts').insert({
      collection_id: layerToCollectionId(entry.layer),
      content: entry.content,
      fact_type: entry.layer,
      confidence: entry.confidence ?? 0.5,
      source: 'agent_memory',
      ...(workspaceId ? { workspace_id: workspaceId } : {}),
    });
  } catch (err) {
    logger.warn(`persistToSupabase failed: ${err instanceof Error ? err.message : 'unknown'}`, 'memoryService');
  }
}

// ═══ SUPABASE LOAD (with localStorage fallback) ═══

async function loadMemoriesFromSupabase(agentId: string, layer: MemoryEntry['layer']): Promise<MemoryEntry[] | null> {
  try {
    const workspaceId = await getWorkspaceId();
    let query = supabase
      .from('brain_facts')
      .select('*')
      .eq('fact_type', layer)
      .eq('source', 'agent_memory')
      .order('created_at', { ascending: false })
      .limit(layer === 'short_term' ? 20 : layer === 'episodic' ? 200 : 500);

    if (workspaceId) {
      query = query.eq('workspace_id', workspaceId);
    }

    const { data, error } = await query;
    if (error || !data) return null;

    return data.map((row: Record<string, unknown>) => ({
      id: String(row.id ?? crypto.randomUUID()),
      layer,
      agentId,
      content: String(row.content ?? ''),
      confidence: typeof row.confidence === 'number' ? row.confidence : 80,
      source: String(row.source ?? 'agent_memory'),
      createdAt: String(row.created_at ?? new Date().toISOString()),
    }));
  } catch {
    return null;
  }
}

/** Load memories: try Supabase first, fall back to localStorage cache. */
export async function loadMemories(agentId: string, layer: MemoryEntry['layer']): Promise<MemoryEntry[]> {
  // Try Supabase first
  const supabaseEntries = await loadMemoriesFromSupabase(agentId, layer);
  if (supabaseEntries && supabaseEntries.length > 0) {
    // Update localStorage cache
    const all = loadAll();
    const key = `${agentId}:${layer}`;
    all[key] = supabaseEntries;
    saveAll(all);
    return supabaseEntries;
  }

  // Fall back to localStorage
  return getMemories(agentId, layer);
}

// ═══ FORGETTING POLICIES ═══

export interface ForgettingPolicy {
  layer: MemoryEntry['layer'];
  strategy: 'time_decay' | 'relevance_decay' | 'lru' | 'compliance';
  maxAgeDays: number;
  minConfidence: number;
  maxEntries: number;
}

const DEFAULT_POLICIES: ForgettingPolicy[] = [
  { layer: 'short_term', strategy: 'time_decay', maxAgeDays: 1, minConfidence: 0, maxEntries: 20 },
  { layer: 'episodic', strategy: 'relevance_decay', maxAgeDays: 90, minConfidence: 30, maxEntries: 200 },
  { layer: 'semantic', strategy: 'lru', maxAgeDays: 365, minConfidence: 50, maxEntries: 500 },
  { layer: 'procedural', strategy: 'lru', maxAgeDays: 365, minConfidence: 60, maxEntries: 100 },
  { layer: 'profile', strategy: 'compliance', maxAgeDays: 365, minConfidence: 0, maxEntries: 50 },
  { layer: 'shared', strategy: 'lru', maxAgeDays: 365, minConfidence: 40, maxEntries: 300 },
];

/** Apply forgetting policies to an agent's memory. Returns count of removed entries. */
export function applyForgettingPolicies(agentId: string, customPolicies?: ForgettingPolicy[]): { removed: number; byLayer: Record<string, number> } {
  const policies = customPolicies ?? DEFAULT_POLICIES;
  const all = loadAll();
  let totalRemoved = 0;
  const byLayer: Record<string, number> = {};

  for (const policy of policies) {
    const key = `${agentId}:${policy.layer}`;
    const entries = all[key] ?? [];
    if (entries.length === 0) continue;

    const now = Date.now();
    const maxAgeMs = policy.maxAgeDays * 86400000;
    let removed = 0;

    // Filter by age
    let filtered = entries.filter(e => {
      const age = now - new Date(e.createdAt).getTime();
      if (age > maxAgeMs) { removed++; return false; }
      return true;
    });

    // Filter by confidence (relevance decay)
    if (policy.strategy === 'relevance_decay') {
      filtered = filtered.filter(e => {
        // Ebbinghaus decay: confidence decreases over time
        const ageDays = (now - new Date(e.createdAt).getTime()) / 86400000;
        const decayedConfidence = (e.confidence ?? 80) * Math.exp(-0.01 * ageDays);
        if (decayedConfidence < policy.minConfidence) { removed++; return false; }
        return true;
      });
    }

    // Cap max entries (LRU: keep newest)
    if (filtered.length > policy.maxEntries) {
      removed += filtered.length - policy.maxEntries;
      filtered = filtered.slice(0, policy.maxEntries);
    }

    all[key] = filtered;
    totalRemoved += removed;
    if (removed > 0) byLayer[policy.layer] = removed;
  }

  saveAll(all);
  if (totalRemoved > 0) {
    logger.info(`Forgetting policies applied for ${agentId}: ${totalRemoved} entries removed`, 'memoryService');
  }

  return { removed: totalRemoved, byLayer };
}

/** Get forgetting policies for display/editing. */
export function getForgettingPolicies(): ForgettingPolicy[] {
  return [...DEFAULT_POLICIES];
}
