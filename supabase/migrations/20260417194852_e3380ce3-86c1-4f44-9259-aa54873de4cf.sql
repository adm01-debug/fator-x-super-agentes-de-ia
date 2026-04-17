
-- ═══════════════════════════════════════════════════════════════
-- Sprint 27 — SLO Dashboards & Alerting
-- ═══════════════════════════════════════════════════════════════
-- Aggregates agent_traces into hourly SLO metrics + RPC summary

-- ── 1. Hourly aggregation view ──────────────────────────────
CREATE OR REPLACE VIEW public.slo_metrics_hourly AS
SELECT
  date_trunc('hour', created_at) AS bucket_hour,
  user_id,
  agent_id,
  COUNT(*) AS total_traces,
  COUNT(*) FILTER (WHERE level = 'error') AS error_count,
  CASE WHEN COUNT(*) > 0
       THEN ROUND((COUNT(*) FILTER (WHERE level <> 'error'))::numeric / COUNT(*) * 100, 2)
       ELSE 100 END AS success_rate,
  COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p50_latency_ms,
  COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_latency_ms,
  COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p99_latency_ms,
  COALESCE(SUM(cost_usd), 0)::numeric(12,4) AS total_cost_usd,
  COALESCE(SUM(tokens_used), 0)::bigint AS total_tokens
FROM public.agent_traces
WHERE latency_ms IS NOT NULL
GROUP BY 1, 2, 3;

COMMENT ON VIEW public.slo_metrics_hourly IS 'Hourly SLO aggregation per user/agent. Inherits RLS from agent_traces.';

-- ── 2. RPC: SLO summary for a window ────────────────────────
CREATE OR REPLACE FUNCTION public.get_slo_summary(p_window_hours int DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_total bigint := 0;
  v_errors bigint := 0;
  v_success_rate numeric := 100;
  v_p50 int := 0;
  v_p95 int := 0;
  v_p99 int := 0;
  v_cost numeric := 0;
  v_tokens bigint := 0;
  v_top_agents jsonb := '[]'::jsonb;
  v_timeseries jsonb := '[]'::jsonb;
  v_since timestamptz;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'authentication required';
  END IF;
  v_since := now() - (p_window_hours || ' hours')::interval;

  -- Totals
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE level = 'error'),
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(SUM(cost_usd), 0),
    COALESCE(SUM(tokens_used), 0)
  INTO v_total, v_errors, v_p50, v_p95, v_p99, v_cost, v_tokens
  FROM public.agent_traces
  WHERE user_id = v_user_id
    AND created_at >= v_since
    AND latency_ms IS NOT NULL;

  IF v_total > 0 THEN
    v_success_rate := ROUND(((v_total - v_errors)::numeric / v_total) * 100, 2);
  END IF;

  -- Top 5 worst-performing agents (by p95)
  SELECT COALESCE(jsonb_agg(row_to_json(a)), '[]'::jsonb) INTO v_top_agents
  FROM (
    SELECT
      ag.id AS agent_id,
      ag.name AS agent_name,
      COUNT(t.*) AS traces,
      COUNT(t.*) FILTER (WHERE t.level = 'error') AS errors,
      ROUND(((COUNT(t.*) - COUNT(t.*) FILTER (WHERE t.level = 'error'))::numeric
             / NULLIF(COUNT(t.*), 0)) * 100, 2) AS success_rate,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY t.latency_ms), 0)::int AS p95_ms
    FROM public.agent_traces t
    JOIN public.agents ag ON ag.id = t.agent_id
    WHERE t.user_id = v_user_id
      AND t.created_at >= v_since
      AND t.latency_ms IS NOT NULL
    GROUP BY ag.id, ag.name
    HAVING COUNT(t.*) >= 1
    ORDER BY p95_ms DESC, errors DESC
    LIMIT 5
  ) a;

  -- Hourly timeseries (last N hours)
  SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.bucket_hour), '[]'::jsonb) INTO v_timeseries
  FROM (
    SELECT
      date_trunc('hour', created_at) AS bucket_hour,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE level = 'error') AS errors,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_ms,
      COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p50_ms
    FROM public.agent_traces
    WHERE user_id = v_user_id
      AND created_at >= v_since
      AND latency_ms IS NOT NULL
    GROUP BY 1
    ORDER BY 1
  ) h;

  RETURN jsonb_build_object(
    'window_hours', p_window_hours,
    'since', v_since,
    'total_traces', v_total,
    'error_count', v_errors,
    'success_rate', v_success_rate,
    'p50_latency_ms', v_p50,
    'p95_latency_ms', v_p95,
    'p99_latency_ms', v_p99,
    'total_cost_usd', v_cost,
    'total_tokens', v_tokens,
    'top_agents', v_top_agents,
    'timeseries', v_timeseries
  );
END;
$$;

COMMENT ON FUNCTION public.get_slo_summary IS 'Returns SLO summary for the authenticated user over a window in hours.';

GRANT EXECUTE ON FUNCTION public.get_slo_summary(int) TO authenticated;
GRANT SELECT ON public.slo_metrics_hourly TO authenticated;
