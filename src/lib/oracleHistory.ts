import { supabase } from '@/integrations/supabase/client';
import type { OracleResult, OracleMode } from '@/stores/oracleStore';
import { logger } from '@/lib/logger';

export interface OracleHistoryEntry {
  id: string;
  query: string;
  mode: string;
  preset_id: string;
  preset_name: string | null;
  chairman_model: string | null;
  enable_thinking: boolean;
  results: OracleResult;
  confidence_score: number | null;
  consensus_degree: number | null;
  total_cost_usd: number | null;
  total_latency_ms: number | null;
  total_tokens: number | null;
  models_used: number | null;
  created_at: string;
}

export interface HistoryFilters {
  mode?: OracleMode;
  presetId?: string;
  dateFrom?: string;
  dateTo?: string;
}

export async function saveOracleHistory(
  query: string,
  mode: OracleMode,
  presetId: string,
  presetName: string,
  chairmanModel: string,
  enableThinking: boolean,
  results: OracleResult,
) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('oracle_history')
    .insert({
      user_id: user.id,
      query,
      mode,
      preset_id: presetId,
      preset_name: presetName,
      chairman_model: chairmanModel,
      enable_thinking: enableThinking,
      results: results as unknown as import("@/integrations/supabase/types").Json,
      confidence_score: results.confidence_score,
      consensus_degree: results.consensus_degree,
      total_cost_usd: results.metrics.total_cost_usd,
      total_latency_ms: results.metrics.total_latency_ms,
      total_tokens: results.metrics.total_tokens,
      models_used: results.metrics.models_used,
    })
    .select()
    .single();

  if (error) logger.error('Failed to save oracle history', { error: error.message });
  return data;
}

export async function fetchOracleHistory(filters: HistoryFilters = {}): Promise<OracleHistoryEntry[]> {
  let query = supabase
    .from('oracle_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);

  if (filters.mode) query = query.eq('mode', filters.mode);
  if (filters.presetId) query = query.eq('preset_id', filters.presetId);
  if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom);
  if (filters.dateTo) query = query.lte('created_at', filters.dateTo);

  const { data, error } = await query;
  if (error) { logger.error('Failed to fetch oracle history', { error: error.message }); return []; }
  return (data || []) as unknown as OracleHistoryEntry[];
}

export async function deleteOracleHistory(id: string) {
  const { error } = await supabase
    .from('oracle_history')
    .delete()
    .eq('id', id);
  if (error) console.error('Failed to delete oracle history:', error);
  return !error;
}
