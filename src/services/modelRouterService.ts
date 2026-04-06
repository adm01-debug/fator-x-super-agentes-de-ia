/**
 * Nexus — Smart Model Router Service
 * Routes queries to optimal LLM based on complexity, cost, and capability.
 */
import { supabase } from '@/integrations/supabase/client';
import { logger } from '@/lib/logger';

export interface RouteResult {
  recommended_model: string;
  tier: string;
  estimated_cost_per_query: number;
  complexity: { level: string; score: number; factors: string[] };
  alternatives: Array<{ model: string; tier: string; cost: number }>;
}

export async function routeQuery(query: string, preferredProvider?: string): Promise<RouteResult> {
  const { data, error } = await supabase.functions.invoke('smart-model-router', {
    body: { query, preferred_provider: preferredProvider },
  });
  if (error) {
    logger.error('Model router failed', { error: error.message });
    throw new Error(`Router error: ${error.message}`);
  }
  return data as RouteResult;
}
