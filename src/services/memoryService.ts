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

// ═══ SUPABASE PERSISTENCE (async) ═══

async function persistToSupabase(entry: MemoryEntry): Promise<void> {
  try {
    await supabase.from('brain_facts').insert({
      content: entry.content,
      domain: entry.layer,
      confidence: entry.confidence ?? 80,
      source_type: entry.source ?? 'memory',
    });
  } catch {
    // Table might not exist — silently fail
  }
}
