/**
 * Nexus Agents Studio — Oracle Service
 * Multi-LLM Council queries, history, and analytics.
 */

import { supabase } from '@/integrations/supabase/client';

export interface OracleQuery {
  id: string;
  query: string;
  mode: string;
  preset_name: string;
  result: Record<string, unknown>;
  total_cost: number;
  total_tokens: number;
  latency_ms: number;
  consensus_score: number;
  models_used: string[];
  created_at: string;
}

export async function queryOracle(params: {
  query: string;
  preset?: string;
  models?: string[];
}): Promise<Record<string, unknown>> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.access_token) throw new Error('Not authenticated');

  const resp = await fetch(`${supabaseUrl}/functions/v1/oracle-council`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
      'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify(params),
  });

  if (!resp.ok) {
    const errText = await resp.text().catch(() => '');
    let errMsg = `Oracle query failed (${resp.status})`;
    try {
      const errJson = JSON.parse(errText) as Record<string, string>;
      if (errJson.error) errMsg = errJson.error;
    } catch { errMsg += `: ${errText || resp.statusText}`; }
    throw new Error(errMsg);
  }

  return resp.json();
}

export async function getOracleHistory(limit = 20): Promise<OracleQuery[]> {
  const { data, error } = await supabase
    .from('oracle_history')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as unknown as OracleQuery[];
}

export async function getOracleStats() {
  const { data, error } = await supabase
    .from('oracle_history')
    .select('total_cost_usd, total_tokens, total_latency_ms, created_at');

  if (error) throw error;

  const records = data ?? [];
  return {
    totalQueries: records.length,
    totalCost: records.reduce((s, r) => s + Number(r.total_cost_usd || 0), 0),
    totalTokens: records.reduce((s, r) => s + Number(r.total_tokens || 0), 0),
    avgLatency: records.length > 0
      ? records.reduce((s, r) => s + Number(r.total_latency_ms || 0), 0) / records.length
      : 0,
  };
}
