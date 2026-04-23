CREATE OR REPLACE FUNCTION public.get_slo_summary(p_window_hours integer DEFAULT 24)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_total bigint := 0;
  v_errors bigint := 0;
  v_tool_errors bigint := 0;
  v_non_tool_errors bigint := 0;
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

  -- Totals (now split tool vs non-tool errors)
  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE level = 'error'),
    COUNT(*) FILTER (WHERE level = 'error' AND event = 'tool.call'),
    COUNT(*) FILTER (WHERE level = 'error' AND event <> 'tool.call'),
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(percentile_cont(0.99) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(SUM(cost_usd), 0),
    COALESCE(SUM(tokens_used), 0)
  INTO v_total, v_errors, v_tool_errors, v_non_tool_errors,
       v_p50, v_p95, v_p99, v_cost, v_tokens
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
      COUNT(t.*) FILTER (WHERE t.level = 'error' AND t.event = 'tool.call') AS tool_errors,
      COUNT(t.*) FILTER (WHERE t.level = 'error' AND t.event <> 'tool.call') AS non_tool_errors,
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

  -- Hourly timeseries (last N hours) — also expose the split errors so the
  -- client can recompute drill-down contributions excluding tool failures.
  SELECT COALESCE(jsonb_agg(row_to_json(h) ORDER BY h.bucket_hour), '[]'::jsonb) INTO v_timeseries
  FROM (
    SELECT
      date_trunc('hour', created_at) AS bucket_hour,
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE level = 'error') AS errors,
      COUNT(*) FILTER (WHERE level = 'error' AND event = 'tool.call') AS tool_errors,
      COUNT(*) FILTER (WHERE level = 'error' AND event <> 'tool.call') AS non_tool_errors,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p95_ms,
      COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int AS p50_ms,
      COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms)
               FILTER (WHERE event <> 'tool.call'), 0)::int AS p95_ms_no_tools,
      COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms)
               FILTER (WHERE event <> 'tool.call'), 0)::int AS p50_ms_no_tools
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
    'tool_error_count', v_tool_errors,
    'non_tool_error_count', v_non_tool_errors,
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
$function$;