/**
 * Nexus Agents Studio — SLO Service
 * Fetches SLO summary from Supabase RPC.
 */
import { supabase } from '@/integrations/supabase/client';

export interface SLOTopAgent {
  agent_id: string;
  agent_name: string;
  traces: number;
  errors: number;
  success_rate: number | null;
  p95_ms: number;
}

export interface SLOTimeseriesPoint {
  bucket_hour: string;
  total: number;
  errors: number;
  p50_ms: number;
  p95_ms: number;
}

export interface SLOSummary {
  window_hours: number;
  since: string;
  total_traces: number;
  error_count: number;
  success_rate: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  total_cost_usd: number;
  total_tokens: number;
  top_agents: SLOTopAgent[];
  timeseries: SLOTimeseriesPoint[];
}

export async function fetchSLOSummary(windowHours = 24): Promise<SLOSummary> {
  // RPC name not in generated types yet — cast through unknown
  const client = supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc('get_slo_summary', { p_window_hours: windowHours });
  if (error) throw new Error(error.message);
  return data as SLOSummary;
}
