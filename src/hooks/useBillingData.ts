/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — useBillingData Hook
 * ═══════════════════════════════════════════════════════════════
 * Fetches real usage & cost data from Supabase usage_records table.
 * Replaces MOCK_USAGE and MOCK_PROJECTION in BillingModule.
 */

import { useState, useEffect } from 'react';
import { supabaseExternal } from '@/integrations/supabase/externalClient';

interface DailyUsage {
  date: string;
  llm: number;
  embedding: number;
  tools: number;
  storage: number;
  total: number;
}

interface WeeklyProjection {
  week: string;
  real: number | null;
  projetado: number;
}

interface BillingData {
  dailyUsage: DailyUsage[];
  projection: WeeklyProjection[];
  totalWeek: number;
  avgDaily: number;
  projectedMonth: number;
  interactionsPerDay: number;
  loading: boolean;
  error: string | null;
}

const DAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function useBillingData(agentId?: string): BillingData {
  const [data, setData] = useState<BillingData>({
    dailyUsage: [],
    projection: [],
    totalWeek: 0,
    avgDaily: 0,
    projectedMonth: 0,
    interactionsPerDay: 0,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        // Fetch usage records from last 7 days
        let query = supabase
          .from('usage_records')
          .select('cost_usd, record_type, created_at')
          .gte('created_at', weekAgo.toISOString())
          .order('created_at', { ascending: true });

        if (agentId) {
          query = query.eq('agent_id', agentId);
        }

        const { data: records, error: usageError } = await query;

        if (usageError) throw usageError;

        // Group by day of week
        const dayMap = new Map<string, DailyUsage>();

        // Initialize all 7 days
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
          const key = DAY_NAMES[d.getDay()];
          dayMap.set(key, { date: key, llm: 0, embedding: 0, tools: 0, storage: 0, total: 0 });
        }

        // Accumulate real costs
        (records ?? []).forEach((r) => {
          const d = new Date(r.created_at as string);
          const key = DAY_NAMES[d.getDay()];
          const entry = dayMap.get(key);
          if (!entry) return;

          const cost = Number(r.cost_usd) || 0;
          const type = String(r.record_type || 'llm');

          if (type.includes('llm') || type.includes('chat')) entry.llm += cost;
          else if (type.includes('embed')) entry.embedding += cost;
          else if (type.includes('tool')) entry.tools += cost;
          else if (type.includes('storage')) entry.storage += cost;
          else entry.llm += cost;

          entry.total += cost;
        });

        const dailyUsage = Array.from(dayMap.values());
        const totalWeek = dailyUsage.reduce((s, d) => s + d.total, 0);
        const avgDaily = totalWeek / 7;
        const projectedMonth = avgDaily * 30;

        // Count interactions per day (sessions or traces)
        const { count: traceCount } = await supabase
          .from('trace_events')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', weekAgo.toISOString());

        const interactionsPerDay = Math.round((traceCount || 0) / 7);

        // Projection: weekly totals for current month
        const projection: WeeklyProjection[] = [];
        for (let w = 0; w < 4; w++) {
          const weekStart = new Date(monthAgo.getTime() + w * 7 * 24 * 60 * 60 * 1000);
          const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
          const isFuture = weekStart > now;

          if (isFuture) {
            projection.push({ week: `S${w + 1}`, real: null, projetado: Math.round(avgDaily * 7) });
          } else {
            // Filter records that fall within this specific week
            const weekRecords = (records ?? []).filter((r) => {
              const d = new Date(r.created_at as string);
              return d >= weekStart && d < weekEnd;
            });
            const weekCost = weekRecords.reduce((s, r) => s + (Number(r.cost_usd) || 0), 0);
            projection.push({
              week: `S${w + 1}`,
              real: Math.round(weekCost * 100) / 100,
              projetado: Math.round(avgDaily * 7),
            });
          }
        }

        if (!cancelled) {
          setData({
            dailyUsage,
            projection,
            totalWeek,
            avgDaily,
            projectedMonth,
            interactionsPerDay,
            loading: false,
            error: null,
          });
        }
      } catch (err) {
        if (!cancelled) {
          // Fallback to zeros instead of crashing
          setData((prev) => ({
            ...prev,
            loading: false,
            error: err instanceof Error ? err.message : 'Failed to load billing data',
          }));
        }
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  return data;
}
