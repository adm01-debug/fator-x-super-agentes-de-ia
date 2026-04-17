
-- Fix: ensure view uses invoker rights so RLS of agent_traces applies
DROP VIEW IF EXISTS public.slo_metrics_hourly;

CREATE VIEW public.slo_metrics_hourly
WITH (security_invoker = true) AS
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

COMMENT ON VIEW public.slo_metrics_hourly IS 'Hourly SLO aggregation per user/agent. Uses invoker rights — inherits RLS from agent_traces.';

GRANT SELECT ON public.slo_metrics_hourly TO authenticated;
