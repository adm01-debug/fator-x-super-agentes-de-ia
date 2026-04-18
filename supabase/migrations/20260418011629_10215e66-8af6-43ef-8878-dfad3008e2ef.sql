-- ═══ Cost Baselines ═══
CREATE TABLE public.cost_baselines (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','agent','model')),
  scope_id TEXT,
  hour_of_day INTEGER NOT NULL CHECK (hour_of_day BETWEEN 0 AND 23),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  avg_cost_usd NUMERIC NOT NULL DEFAULT 0,
  stddev_cost_usd NUMERIC NOT NULL DEFAULT 0,
  sample_count INTEGER NOT NULL DEFAULT 0,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, scope, scope_id, hour_of_day, day_of_week)
);
CREATE INDEX idx_cost_baselines_lookup ON public.cost_baselines(workspace_id, scope, scope_id, hour_of_day, day_of_week);

ALTER TABLE public.cost_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view baselines" ON public.cost_baselines FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

-- ═══ Cost Alerts ═══
CREATE TABLE public.cost_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  scope TEXT NOT NULL CHECK (scope IN ('workspace','agent','model')),
  scope_id TEXT,
  scope_label TEXT,
  observed_cost_usd NUMERIC NOT NULL,
  baseline_cost_usd NUMERIC NOT NULL,
  z_score NUMERIC NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info','warning','critical')),
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID
);
CREATE INDEX idx_cost_alerts_workspace ON public.cost_alerts(workspace_id, triggered_at DESC);
CREATE INDEX idx_cost_alerts_active ON public.cost_alerts(workspace_id, severity) WHERE acknowledged_at IS NULL;

ALTER TABLE public.cost_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view alerts" ON public.cost_alerts FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "admins acknowledge alerts" ON public.cost_alerts FOR UPDATE TO authenticated
  USING (public.is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id));

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.cost_alerts;

-- ═══ RPC: compute_cost_baselines ═══
CREATE OR REPLACE FUNCTION public.compute_cost_baselines()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  -- Workspace-level baselines
  INSERT INTO public.cost_baselines (workspace_id, scope, scope_id, hour_of_day, day_of_week, avg_cost_usd, stddev_cost_usd, sample_count, computed_at)
  SELECT
    a.workspace_id,
    'workspace',
    NULL,
    EXTRACT(HOUR FROM t.created_at)::int,
    EXTRACT(DOW FROM t.created_at)::int,
    COALESCE(AVG(hourly_cost), 0),
    COALESCE(STDDEV(hourly_cost), 0),
    COUNT(*)
  FROM (
    SELECT
      tt.agent_id,
      date_trunc('hour', tt.created_at) AS hour_bucket,
      tt.created_at,
      SUM(tt.cost_usd) AS hourly_cost
    FROM public.agent_traces tt
    WHERE tt.created_at >= now() - interval '14 days'
      AND tt.cost_usd IS NOT NULL
    GROUP BY tt.agent_id, date_trunc('hour', tt.created_at), tt.created_at
  ) t
  JOIN public.agents a ON a.id = t.agent_id
  WHERE a.workspace_id IS NOT NULL
  GROUP BY a.workspace_id, EXTRACT(HOUR FROM t.created_at), EXTRACT(DOW FROM t.created_at)
  ON CONFLICT (workspace_id, scope, scope_id, hour_of_day, day_of_week)
  DO UPDATE SET
    avg_cost_usd = EXCLUDED.avg_cost_usd,
    stddev_cost_usd = EXCLUDED.stddev_cost_usd,
    sample_count = EXCLUDED.sample_count,
    computed_at = now();
  GET DIAGNOSTICS v_inserted = ROW_COUNT;

  -- Agent-level baselines
  INSERT INTO public.cost_baselines (workspace_id, scope, scope_id, hour_of_day, day_of_week, avg_cost_usd, stddev_cost_usd, sample_count, computed_at)
  SELECT
    a.workspace_id,
    'agent',
    a.id::text,
    EXTRACT(HOUR FROM t.created_at)::int,
    EXTRACT(DOW FROM t.created_at)::int,
    COALESCE(AVG(t.cost_usd), 0),
    COALESCE(STDDEV(t.cost_usd), 0),
    COUNT(*)
  FROM public.agent_traces t
  JOIN public.agents a ON a.id = t.agent_id
  WHERE t.created_at >= now() - interval '14 days'
    AND t.cost_usd IS NOT NULL
    AND a.workspace_id IS NOT NULL
  GROUP BY a.workspace_id, a.id, EXTRACT(HOUR FROM t.created_at), EXTRACT(DOW FROM t.created_at)
  ON CONFLICT (workspace_id, scope, scope_id, hour_of_day, day_of_week)
  DO UPDATE SET
    avg_cost_usd = EXCLUDED.avg_cost_usd,
    stddev_cost_usd = EXCLUDED.stddev_cost_usd,
    sample_count = EXCLUDED.sample_count,
    computed_at = now();

  RETURN jsonb_build_object('status', 'ok', 'computed_at', now());
END;
$$;

-- ═══ RPC: detect_cost_anomalies ═══
CREATE OR REPLACE FUNCTION public.detect_cost_anomalies()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alerts INTEGER := 0;
  v_hour INTEGER := EXTRACT(HOUR FROM now())::int;
  v_dow INTEGER := EXTRACT(DOW FROM now())::int;
  r RECORD;
  v_z NUMERIC;
  v_severity TEXT;
BEGIN
  FOR r IN
    SELECT
      a.workspace_id,
      a.id AS agent_id,
      a.name AS agent_name,
      SUM(t.cost_usd) AS observed
    FROM public.agent_traces t
    JOIN public.agents a ON a.id = t.agent_id
    WHERE t.created_at >= now() - interval '1 hour'
      AND t.cost_usd IS NOT NULL
      AND a.workspace_id IS NOT NULL
    GROUP BY a.workspace_id, a.id, a.name
    HAVING SUM(t.cost_usd) > 0.10
  LOOP
    -- find baseline for this agent
    SELECT
      CASE WHEN cb.stddev_cost_usd > 0
        THEN (r.observed - cb.avg_cost_usd) / cb.stddev_cost_usd
        ELSE 0
      END,
      cb.avg_cost_usd
    INTO v_z, r.observed
    FROM public.cost_baselines cb
    WHERE cb.workspace_id = r.workspace_id
      AND cb.scope = 'agent'
      AND cb.scope_id = r.agent_id::text
      AND cb.hour_of_day = v_hour
      AND cb.day_of_week = v_dow
      AND cb.sample_count >= 3
    LIMIT 1;

    IF v_z IS NULL OR v_z < 2 THEN CONTINUE; END IF;

    v_severity := CASE WHEN v_z >= 3 THEN 'critical' WHEN v_z >= 2 THEN 'warning' ELSE 'info' END;

    -- Avoid duplicate alerts within 1 hour
    IF EXISTS (
      SELECT 1 FROM public.cost_alerts
      WHERE workspace_id = r.workspace_id
        AND scope = 'agent'
        AND scope_id = r.agent_id::text
        AND triggered_at >= now() - interval '1 hour'
    ) THEN CONTINUE; END IF;

    INSERT INTO public.cost_alerts (workspace_id, scope, scope_id, scope_label, observed_cost_usd, baseline_cost_usd, z_score, severity)
    VALUES (r.workspace_id, 'agent', r.agent_id::text, r.agent_name, r.observed,
            (SELECT avg_cost_usd FROM public.cost_baselines WHERE workspace_id = r.workspace_id AND scope='agent' AND scope_id=r.agent_id::text AND hour_of_day=v_hour AND day_of_week=v_dow LIMIT 1),
            v_z, v_severity);
    v_alerts := v_alerts + 1;
  END LOOP;

  RETURN jsonb_build_object('alerts_created', v_alerts, 'checked_at', now());
END;
$$;

-- ═══ RPC: acknowledge_cost_alert ═══
CREATE OR REPLACE FUNCTION public.acknowledge_cost_alert(p_alert_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws UUID;
BEGIN
  SELECT workspace_id INTO v_ws FROM public.cost_alerts WHERE id = p_alert_id;
  IF v_ws IS NULL THEN RAISE EXCEPTION 'alert not found'; END IF;
  IF NOT public.is_workspace_admin(auth.uid(), v_ws) THEN
    RAISE EXCEPTION 'forbidden: workspace admin required';
  END IF;
  UPDATE public.cost_alerts
    SET acknowledged_at = now(), acknowledged_by = auth.uid()
    WHERE id = p_alert_id;
END;
$$;

-- ═══ Cron jobs ═══
-- Daily baseline recomputation at 3 AM
SELECT cron.schedule(
  'cost-baselines-daily',
  '0 3 * * *',
  $$ SELECT public.compute_cost_baselines(); $$
);

-- Anomaly detection every 15 minutes
SELECT cron.schedule(
  'cost-anomalies-15min',
  '*/15 * * * *',
  $$ SELECT public.detect_cost_anomalies(); $$
);