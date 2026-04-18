-- Tabela de configuração dos checks
CREATE TABLE public.synthetic_checks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target TEXT NOT NULL CHECK (target IN ('llm-gateway', 'agent-workflow-runner', 'health')),
  interval_minutes INTEGER NOT NULL DEFAULT 5 CHECK (interval_minutes BETWEEN 1 AND 60),
  expected_status_max_ms INTEGER NOT NULL DEFAULT 3000 CHECK (expected_status_max_ms BETWEEN 100 AND 30000),
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_synthetic_checks_workspace ON public.synthetic_checks(workspace_id);
CREATE INDEX idx_synthetic_checks_due ON public.synthetic_checks(enabled, last_run_at) WHERE enabled = true;

-- Tabela de resultados
CREATE TABLE public.synthetic_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  check_id UUID NOT NULL REFERENCES public.synthetic_checks(id) ON DELETE CASCADE,
  ran_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  success BOOLEAN NOT NULL,
  latency_ms INTEGER,
  status_code INTEGER,
  error_message TEXT
);

CREATE INDEX idx_synthetic_results_check_time ON public.synthetic_results(check_id, ran_at DESC);

-- RLS
ALTER TABLE public.synthetic_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.synthetic_results ENABLE ROW LEVEL SECURITY;

-- synthetic_checks: members SELECT, admins CRUD
CREATE POLICY "Members view synthetic_checks"
ON public.synthetic_checks FOR SELECT
USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "Admins insert synthetic_checks"
ON public.synthetic_checks FOR INSERT
WITH CHECK (public.is_workspace_admin(auth.uid(), workspace_id) AND created_by = auth.uid());

CREATE POLICY "Admins update synthetic_checks"
ON public.synthetic_checks FOR UPDATE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "Admins delete synthetic_checks"
ON public.synthetic_checks FOR DELETE
USING (public.is_workspace_admin(auth.uid(), workspace_id));

-- synthetic_results: members SELECT (via parent check)
CREATE POLICY "Members view synthetic_results"
ON public.synthetic_results FOR SELECT
USING (check_id IN (
  SELECT id FROM public.synthetic_checks
  WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
));

-- Trigger updated_at
CREATE TRIGGER update_synthetic_checks_updated_at
BEFORE UPDATE ON public.synthetic_checks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.synthetic_results;

-- RPC: synthetic_check_summary - estatísticas agregadas para um check
CREATE OR REPLACE FUNCTION public.get_synthetic_summary(p_check_id UUID, p_window_hours INTEGER DEFAULT 24)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total INTEGER := 0;
  v_success INTEGER := 0;
  v_uptime NUMERIC := 100;
  v_p50 INTEGER := 0;
  v_p95 INTEGER := 0;
  v_recent jsonb := '[]'::jsonb;
BEGIN
  -- Auth check via RLS-aware query
  IF NOT EXISTS (
    SELECT 1 FROM public.synthetic_checks c
    WHERE c.id = p_check_id
      AND c.workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT
    COUNT(*),
    COUNT(*) FILTER (WHERE success),
    COALESCE(percentile_cont(0.50) WITHIN GROUP (ORDER BY latency_ms), 0)::int,
    COALESCE(percentile_cont(0.95) WITHIN GROUP (ORDER BY latency_ms), 0)::int
  INTO v_total, v_success, v_p50, v_p95
  FROM public.synthetic_results
  WHERE check_id = p_check_id
    AND ran_at >= now() - (p_window_hours || ' hours')::interval;

  IF v_total > 0 THEN
    v_uptime := ROUND((v_success::numeric / v_total) * 100, 2);
  END IF;

  -- Últimos 60 resultados (sparkline)
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.ran_at), '[]'::jsonb)
  INTO v_recent
  FROM (
    SELECT ran_at, success, latency_ms
    FROM public.synthetic_results
    WHERE check_id = p_check_id
    ORDER BY ran_at DESC
    LIMIT 60
  ) r;

  RETURN jsonb_build_object(
    'window_hours', p_window_hours,
    'total_runs', v_total,
    'success_count', v_success,
    'uptime_pct', v_uptime,
    'p50_latency_ms', v_p50,
    'p95_latency_ms', v_p95,
    'recent', v_recent
  );
END;
$$;