/**
 * Nexus — Entity Resolution Service (T07)
 * Detects duplicate or near-duplicate entities (memories, contacts,
 * companies, products) across the knowledge base. Uses lightweight
 * client-side similarity (normalized string + token overlap) so it
 * works without an extra Edge Function.
 *
 * Strategy:
 *  1. Normalize text (lowercase, strip punctuation, collapse spaces)
 *  2. Compute token-overlap Jaccard similarity
 *  3. Group entries with similarity >= threshold (default 0.7)
 *  4. Return clusters with canonical pick (longest content as canonical)
 */
import { logger } from '@/lib/logger';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

export interface EntityCandidate {
  id: string;
  content: string;
  source?: string | null;
  created_at?: string | null;
  memory_type?: string | null;
}

export interface EntityCluster {
  /** The cluster's canonical entry (longest content / highest signal) */
  canonical: EntityCandidate;
  /** All other entries that resolve to the same entity */
  duplicates: EntityCandidate[];
  /** Average similarity inside the cluster (0..1) */
  avg_similarity: number;
  /** Total members count */
  size: number;
}

export interface EntityResolutionReport {
  total_scanned: number;
  cluster_count: number;
  duplicates_found: number;
  clusters: EntityCluster[];
}

/**
 * Normalizes a string for fuzzy comparison.
 *  - Lowercase
 *  - Remove diacritics (NFD + strip combining marks)
 *  - Strip punctuation
 *  - Collapse whitespace
 */
export function normalizeForCompare(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenizes a normalized string into words. Returns a Set for fast
 * intersection ops.
 */
function tokenize(s: string): Set<string> {
  return new Set(
    normalizeForCompare(s)
      .split(' ')
      .filter((t) => t.length >= 3),
  );
}

/**
 * Jaccard similarity between two strings based on word tokens.
 * Returns 0..1 (1 = identical token sets).
 */
export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokenize(a);
  const tb = tokenize(b);
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const t of ta) {
    if (tb.has(t)) intersection++;
  }
  const union = ta.size + tb.size - intersection;
  return intersection / union;
}

/**
 * Groups candidates into entity clusters using greedy nearest-neighbor.
 * Each candidate is compared against the canonical of every existing
 * cluster. If similarity >= threshold the candidate joins that cluster.
 * Otherwise a new cluster is created.
 */
export function clusterCandidates(candidates: EntityCandidate[], threshold = 0.7): EntityCluster[] {
  const clusters: EntityCluster[] = [];

  for (const cand of candidates) {
    let bestCluster: EntityCluster | null = null;
    let bestSim = 0;

    for (const c of clusters) {
      const sim = jaccardSimilarity(cand.content, c.canonical.content);
      if (sim >= threshold && sim > bestSim) {
        bestCluster = c;
        bestSim = sim;
      }
    }

    if (bestCluster) {
      bestCluster.duplicates.push(cand);
      // Update running average similarity
      const prevTotal = bestCluster.avg_similarity * (bestCluster.size - 1);
      bestCluster.size++;
      bestCluster.avg_similarity = (prevTotal + bestSim) / (bestCluster.size - 1);

      // If this candidate has longer content, promote it as canonical
      if (cand.content.length > bestCluster.canonical.content.length) {
        bestCluster.duplicates.push(bestCluster.canonical);
        bestCluster.canonical = cand;
        bestCluster.duplicates = bestCluster.duplicates.filter((d) => d.id !== cand.id);
      }
    } else {
      clusters.push({
        canonical: cand,
        duplicates: [],
        avg_similarity: 1,
        size: 1,
      });
    }
  }

  // Only keep clusters with at least one duplicate
  return clusters.filter((c) => c.duplicates.length > 0);
}

/**
 * Loads up to `limit` recent memories and runs entity resolution
 * over their content. Returns clusters of likely duplicates.
 */
export async function resolveMemoryEntities(
  limit = 200,
  threshold = 0.7,
): Promise<EntityResolutionReport> {
  try {
    const { data, error } = await supabaseExternal
      .from('agent_memories')
      .select('id, content, source, created_at, memory_type')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      logger.error('resolveMemoryEntities query failed', { error: error.message });
      return { total_scanned: 0, cluster_count: 0, duplicates_found: 0, clusters: [] };
    }

    const candidates = ((data ?? []) as EntityCandidate[]).filter(
      (c: { content?: string }) => c.content && c.content.length >= 10,
    );

    const clusters = clusterCandidates(candidates, threshold);
    const duplicatesFound = clusters.reduce((acc, c) => acc + c.duplicates.length, 0);

    return {
      total_scanned: candidates.length,
      cluster_count: clusters.length,
      duplicates_found: duplicatesFound,
      clusters: clusters.sort((a, b) => b.size - a.size),
    };
  } catch (e) {
    logger.error('resolveMemoryEntities threw', {
      error: e instanceof Error ? e.message : String(e),
    });
    return { total_scanned: 0, cluster_count: 0, duplicates_found: 0, clusters: [] };
  }
}

/**
 * Merges a cluster: deletes all duplicates, keeping only the canonical.
 * Best-effort: returns count of deleted rows.
 */
export async function mergeEntityCluster(cluster: EntityCluster): Promise<number> {
  if (cluster.duplicates.length === 0) return 0;
  const idsToDelete = cluster.duplicates.map((d) => d.id);

  const { error } = await supabaseExternal.from('agent_memories').delete().in('id', idsToDelete);

  if (error) {
    logger.error('mergeEntityCluster failed', { error: error.message });
    throw new Error(error.message);
  }

  return idsToDelete.length;
}
