/**
 * Nexus — Temporal Knowledge Service (T06)
 * Time-aware knowledge graph: tracks how memories and knowledge evolve
 * over time, detects velocity (creation rate), and builds time-window
 * snapshots so the Super Cérebro can answer "what did we know when?".
 */
import { logger } from '@/lib/logger';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

export type TemporalWindow = '1h' | '24h' | '7d' | '30d' | '90d' | 'all';

export interface TemporalBucket {
  /** ISO date marking the start of the bucket */
  bucket_start: string;
  /** Number of memories created in this bucket */
  memories_created: number;
  /** Number of chunks created in this bucket */
  chunks_created: number;
  /** Average importance score of memories in this bucket */
  avg_importance: number;
}

export interface TemporalSnapshot {
  window: TemporalWindow;
  total_memories: number;
  total_chunks: number;
  buckets: TemporalBucket[];
  oldest_at: string | null;
  newest_at: string | null;
  velocity_per_day: number;
}

const WINDOW_TO_DAYS: Record<TemporalWindow, number> = {
  '1h': 1 / 24,
  '24h': 1,
  '7d': 7,
  '30d': 30,
  '90d': 90,
  all: 9999,
};

function bucketSizeForWindow(window: TemporalWindow): { sizeMs: number; label: string } {
  switch (window) {
    case '1h':
      return { sizeMs: 5 * 60 * 1000, label: '5min' };
    case '24h':
      return { sizeMs: 60 * 60 * 1000, label: '1h' };
    case '7d':
      return { sizeMs: 6 * 60 * 60 * 1000, label: '6h' };
    case '30d':
      return { sizeMs: 24 * 60 * 60 * 1000, label: '1d' };
    case '90d':
      return { sizeMs: 3 * 24 * 60 * 60 * 1000, label: '3d' };
    case 'all':
      return { sizeMs: 7 * 24 * 60 * 60 * 1000, label: '7d' };
  }
}

/**
 * Builds a temporal snapshot of the knowledge graph for the given time
 * window. Bucketizes creation timestamps and computes velocity.
 */
export async function getTemporalSnapshot(window: TemporalWindow = '7d'): Promise<TemporalSnapshot> {
  const days = WINDOW_TO_DAYS[window];
  const sinceIso =
    window === 'all'
      ? '1970-01-01T00:00:00Z'
      : new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const empty: TemporalSnapshot = {
    window,
    total_memories: 0,
    total_chunks: 0,
    buckets: [],
    oldest_at: null,
    newest_at: null,
    velocity_per_day: 0,
  };

  try {
    // Fetch memories within the window
    const { data: memData, error: memErr } = await supabaseExternal
      .from('agent_memories')
      .select('id, created_at, relevance_score')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });

    if (memErr) {
      logger.error('temporal memories query failed', { error: memErr.message });
      return empty;
    }

    const memories = (memData ?? []) as Array<{ id: string; created_at: string; relevance_score: number | null }>;

    // Fetch chunks within the window
    const { data: chunkData, error: chunkErr } = await supabaseExternal
      .from('chunks')
      .select('id, created_at')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: true });

    if (chunkErr) {
      logger.error('temporal chunks query failed', { error: chunkErr.message });
    }

    const chunks = (chunkData ?? []) as Array<{ id: string; created_at: string }>;

    // Bucketize
    const { sizeMs } = bucketSizeForWindow(window);
    const startTime = window === 'all' && memories.length > 0
      ? new Date(memories[0].created_at).getTime()
      : new Date(sinceIso).getTime();
    const endTime = Date.now();

    const bucketCount = Math.max(1, Math.min(60, Math.ceil((endTime - startTime) / sizeMs)));
    const bucketMap = new Map<number, TemporalBucket>();

    for (let i = 0; i < bucketCount; i++) {
      const bStart = startTime + i * sizeMs;
      bucketMap.set(i, {
        bucket_start: new Date(bStart).toISOString(),
        memories_created: 0,
        chunks_created: 0,
        avg_importance: 0,
      });
    }

    const importanceSums = new Map<number, { sum: number; count: number }>();

    for (const m of memories) {
      const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((new Date(m.created_at).getTime() - startTime) / sizeMs)));
      const b = bucketMap.get(idx);
      if (b) {
        b.memories_created++;
        const acc = importanceSums.get(idx) ?? { sum: 0, count: 0 };
        if (m.relevance_score != null) {
          acc.sum += m.relevance_score;
          acc.count++;
        }
        importanceSums.set(idx, acc);
      }
    }

    for (const c of chunks) {
      const idx = Math.min(bucketCount - 1, Math.max(0, Math.floor((new Date(c.created_at).getTime() - startTime) / sizeMs)));
      const b = bucketMap.get(idx);
      if (b) b.chunks_created++;
    }

    for (const [idx, b] of bucketMap.entries()) {
      const acc = importanceSums.get(idx);
      if (acc && acc.count > 0) {
        b.avg_importance = acc.sum / acc.count;
      }
    }

    const buckets = Array.from(bucketMap.values());
    const totalMemories = memories.length;
    const totalChunks = chunks.length;
    const oldestAt = memories[0]?.created_at ?? null;
    const newestAt = memories[memories.length - 1]?.created_at ?? null;
    const effectiveDays = Math.max(0.0001, days === 9999 && oldestAt ? (Date.now() - new Date(oldestAt).getTime()) / (24 * 60 * 60 * 1000) : days);
    const velocity = totalMemories / effectiveDays;

    return {
      window,
      total_memories: totalMemories,
      total_chunks: totalChunks,
      buckets,
      oldest_at: oldestAt,
      newest_at: newestAt,
      velocity_per_day: Number(velocity.toFixed(2)),
    };
  } catch (e) {
    logger.error('temporal snapshot threw', { error: e instanceof Error ? e.message : String(e) });
    return empty;
  }
}

/**
 * Lists the most recent N memories sorted descending by created_at.
 * Used by the temporal timeline view in Super Cérebro.
 */
export async function listRecentMemoryEvents(limit = 50) {
  const { data, error } = await supabaseExternal
    .from('agent_memories')
    .select('id, content, memory_type, source, relevance_score, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    logger.error('listRecentMemoryEvents failed', { error: error.message });
    return [];
  }
  return data ?? [];
}
