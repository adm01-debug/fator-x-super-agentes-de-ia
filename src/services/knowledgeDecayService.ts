/**
 * Nexus — Knowledge Decay Detection Service (T08)
 * Identifies stale, outdated, or low-confidence knowledge that should
 * be refreshed or pruned. Uses simple heuristics:
 *  - Age (days since last update)
 *  - Access frequency (read_count, if available)
 *  - Importance score (relevance_score)
 *
 * Decay score = combined signal where higher = more decayed (worse).
 * Recommendations: 'fresh', 'review', 'refresh', 'archive'.
 */
import { supabaseExternal } from '@/integrations/supabase/externalClient';
import { logger } from '@/lib/logger';

export type DecayLevel = 'fresh' | 'review' | 'refresh' | 'archive';

export interface DecayItem {
  id: string;
  type: 'memory' | 'knowledge_base' | 'document';
  name: string;
  content_preview?: string | null;
  age_days: number;
  importance: number | null;
  decay_score: number;
  level: DecayLevel;
  last_updated: string | null;
  recommendation: string;
}

export interface DecayReport {
  total_scanned: number;
  fresh_count: number;
  review_count: number;
  refresh_count: number;
  archive_count: number;
  items: DecayItem[];
}

const RECOMMENDATIONS: Record<DecayLevel, string> = {
  fresh: 'Conhecimento atualizado — nenhuma ação necessária',
  review: 'Considere validar este conteúdo nas próximas semanas',
  refresh: 'Conteúdo desatualizado — atualize com fontes recentes',
  archive: 'Muito antigo e baixa relevância — considere arquivar',
};

/**
 * Computes decay score and level for an item based on age + importance.
 *
 * Score formula:
 *  - Age component: min(1, age_days / 180)  → 0..1 over 6 months
 *  - Importance component: 1 - importance   → 0..1 (low importance hurts)
 *  - Final: weighted avg (60% age + 40% low-importance)
 */
export function computeDecayScore(ageDays: number, importance: number | null): {
  score: number;
  level: DecayLevel;
} {
  const ageComponent = Math.min(1, ageDays / 180);
  const lowImportanceComponent = 1 - (importance ?? 0.5);
  const score = 0.6 * ageComponent + 0.4 * lowImportanceComponent;

  let level: DecayLevel;
  if (score < 0.3) level = 'fresh';
  else if (score < 0.5) level = 'review';
  else if (score < 0.75) level = 'refresh';
  else level = 'archive';

  return { score: Number(score.toFixed(3)), level };
}

/**
 * Scans recent memories and computes decay metrics for each.
 * Returns a sorted report (most decayed first).
 */
export async function detectKnowledgeDecay(limit = 200): Promise<DecayReport> {
  const empty: DecayReport = {
    total_scanned: 0,
    fresh_count: 0,
    review_count: 0,
    refresh_count: 0,
    archive_count: 0,
    items: [],
  };

  try {
    const { data: memData, error: memErr } = await supabase
      .from('agent_memories')
      .select('id, content, source, created_at, relevance_score, memory_type')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (memErr) {
      logger.error('detectKnowledgeDecay memories failed', { error: memErr.message });
      return empty;
    }

    const now = Date.now();
    const items: DecayItem[] = ((memData ?? []) as Array<Record<string, unknown>>).map((m) => {
      const createdAt = m.created_at ? new Date(String(m.created_at)) : null;
      const ageDays = createdAt ? (now - createdAt.getTime()) / (24 * 60 * 60 * 1000) : 0;
      const importance = typeof m.relevance_score === 'number' ? m.relevance_score : null;
      const { score, level } = computeDecayScore(ageDays, importance);
      const content = String(m.content ?? '');

      return {
        id: String(m.id),
        type: 'memory' as const,
        name: content.slice(0, 60) + (content.length > 60 ? '…' : ''),
        content_preview: content.slice(0, 200),
        age_days: Number(ageDays.toFixed(1)),
        importance,
        decay_score: score,
        level,
        last_updated: createdAt ? createdAt.toISOString() : null,
        recommendation: RECOMMENDATIONS[level],
      };
    });

    const sortedItems = items.sort((a, b) => b.decay_score - a.decay_score);

    return {
      total_scanned: items.length,
      fresh_count: items.filter((i) => i.level === 'fresh').length,
      review_count: items.filter((i) => i.level === 'review').length,
      refresh_count: items.filter((i) => i.level === 'refresh').length,
      archive_count: items.filter((i) => i.level === 'archive').length,
      items: sortedItems,
    };
  } catch (e) {
    logger.error('detectKnowledgeDecay threw', {
      error: e instanceof Error ? e.message : String(e),
    });
    return empty;
  }
}

/**
 * Bulk archives a list of decayed memory items by deleting them
 * from the agent_memories table. Returns count of items archived.
 */
export async function archiveDecayedItems(itemIds: string[]): Promise<number> {
  if (itemIds.length === 0) return 0;

  const { error } = await supabase
    .from('agent_memories')
    .delete()
    .in('id', itemIds);

  if (error) {
    logger.error('archiveDecayedItems failed', { error: error.message });
    throw new Error(error.message);
  }

  return itemIds.length;
}
