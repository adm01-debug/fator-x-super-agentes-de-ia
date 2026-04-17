-- Tabela de experimentos A/B de prompts
CREATE TABLE public.prompt_experiments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL,
  agent_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  variant_a_version_id UUID NOT NULL,
  variant_b_version_id UUID NOT NULL,
  variant_a_label TEXT NOT NULL DEFAULT 'Controle',
  variant_b_label TEXT NOT NULL DEFAULT 'Challenger',
  traffic_split INTEGER NOT NULL DEFAULT 50 CHECK (traffic_split BETWEEN 0 AND 100),
  success_metric TEXT NOT NULL DEFAULT 'quality' CHECK (success_metric IN ('quality','latency','cost','success_rate')),
  guardrails JSONB NOT NULL DEFAULT '{"max_cost_increase_pct":50,"max_latency_increase_ms":2000,"min_quality":0.6}'::jsonb,
  winner TEXT CHECK (winner IN ('a','b')),
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_experiments_workspace ON public.prompt_experiments(workspace_id);
CREATE INDEX idx_prompt_experiments_agent ON public.prompt_experiments(agent_id);
CREATE INDEX idx_prompt_experiments_status ON public.prompt_experiments(status);

ALTER TABLE public.prompt_experiments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read prompt experiments" ON public.prompt_experiments
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members create prompt experiments" ON public.prompt_experiments
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "owner or admin update prompt experiments" ON public.prompt_experiments
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "owner or admin delete prompt experiments" ON public.prompt_experiments
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id));

CREATE TRIGGER trg_prompt_experiments_updated_at
  BEFORE UPDATE ON public.prompt_experiments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de runs do experimento
CREATE TABLE public.prompt_experiment_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id UUID NOT NULL REFERENCES public.prompt_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('a','b')),
  prompt_version_id UUID,
  session_key TEXT,
  latency_ms INTEGER NOT NULL DEFAULT 0,
  cost_cents NUMERIC(10,4) NOT NULL DEFAULT 0,
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  quality_score NUMERIC(4,3) CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 1)),
  success BOOLEAN NOT NULL DEFAULT true,
  trace_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_prompt_exp_runs_experiment ON public.prompt_experiment_runs(experiment_id, created_at DESC);
CREATE INDEX idx_prompt_exp_runs_variant ON public.prompt_experiment_runs(experiment_id, variant);

ALTER TABLE public.prompt_experiment_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read experiment runs" ON public.prompt_experiment_runs
  FOR SELECT TO authenticated
  USING (experiment_id IN (
    SELECT id FROM public.prompt_experiments
    WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  ));

CREATE POLICY "members insert experiment runs" ON public.prompt_experiment_runs
  FOR INSERT TO authenticated
  WITH CHECK (experiment_id IN (
    SELECT id FROM public.prompt_experiments
    WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
  ));

-- RPC: atribuir variante de forma determinística
CREATE OR REPLACE FUNCTION public.assign_variant(p_experiment_id UUID, p_session_key TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_split INTEGER;
  v_status TEXT;
  v_hash INTEGER;
  v_key TEXT;
BEGIN
  SELECT traffic_split, status INTO v_split, v_status
    FROM public.prompt_experiments WHERE id = p_experiment_id;
  IF NOT FOUND OR v_status <> 'running' THEN
    RETURN 'a';
  END IF;
  v_key := COALESCE(p_session_key, gen_random_uuid()::text);
  v_hash := abs(hashtext(v_key)) % 100;
  IF v_hash < v_split THEN
    RETURN 'a';
  ELSE
    RETURN 'b';
  END IF;
END $$;

-- RPC: estatísticas do experimento (com z-test)
CREATE OR REPLACE FUNCTION public.compute_experiment_stats(p_experiment_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metric TEXT;
  v_a_n INTEGER; v_b_n INTEGER;
  v_a_success INTEGER; v_b_success INTEGER;
  v_a_lat NUMERIC; v_b_lat NUMERIC;
  v_a_cost NUMERIC; v_b_cost NUMERIC;
  v_a_qual NUMERIC; v_b_qual NUMERIC;
  v_p1 NUMERIC; v_p2 NUMERIC; v_p_pool NUMERIC;
  v_se NUMERIC; v_z NUMERIC; v_p_value NUMERIC;
  v_winner TEXT;
  v_significant BOOLEAN;
BEGIN
  SELECT success_metric INTO v_metric FROM public.prompt_experiments WHERE id = p_experiment_id;

  SELECT COUNT(*), COUNT(*) FILTER (WHERE success),
         COALESCE(AVG(latency_ms),0), COALESCE(AVG(cost_cents),0), COALESCE(AVG(quality_score),0)
    INTO v_a_n, v_a_success, v_a_lat, v_a_cost, v_a_qual
    FROM public.prompt_experiment_runs
    WHERE experiment_id = p_experiment_id AND variant = 'a';

  SELECT COUNT(*), COUNT(*) FILTER (WHERE success),
         COALESCE(AVG(latency_ms),0), COALESCE(AVG(cost_cents),0), COALESCE(AVG(quality_score),0)
    INTO v_b_n, v_b_success, v_b_lat, v_b_cost, v_b_qual
    FROM public.prompt_experiment_runs
    WHERE experiment_id = p_experiment_id AND variant = 'b';

  -- Z-test de proporções (success rate)
  IF v_a_n > 0 AND v_b_n > 0 THEN
    v_p1 := v_a_success::NUMERIC / v_a_n;
    v_p2 := v_b_success::NUMERIC / v_b_n;
    v_p_pool := (v_a_success + v_b_success)::NUMERIC / (v_a_n + v_b_n);
    v_se := sqrt(v_p_pool * (1 - v_p_pool) * (1.0/v_a_n + 1.0/v_b_n));
    IF v_se > 0 THEN
      v_z := (v_p2 - v_p1) / v_se;
      -- Aproximação de p-value (two-tailed) via fórmula de erro
      v_p_value := 2 * (1 - (0.5 * (1 + (
        CASE WHEN abs(v_z) > 6 THEN 1
        ELSE (1 - exp(-0.717*abs(v_z) - 0.416*v_z*v_z)) END
      ))));
    ELSE
      v_p_value := 1;
    END IF;
  ELSE
    v_p_value := 1; v_z := 0;
  END IF;

  -- Winner candidato pela métrica
  v_winner := CASE
    WHEN v_metric = 'latency' THEN CASE WHEN v_a_lat <= v_b_lat THEN 'a' ELSE 'b' END
    WHEN v_metric = 'cost' THEN CASE WHEN v_a_cost <= v_b_cost THEN 'a' ELSE 'b' END
    WHEN v_metric = 'quality' THEN CASE WHEN v_a_qual >= v_b_qual THEN 'a' ELSE 'b' END
    ELSE CASE WHEN v_p1 >= v_p2 THEN 'a' ELSE 'b' END
  END;

  v_significant := (v_p_value < 0.05) AND (v_a_n >= 100) AND (v_b_n >= 100);

  RETURN jsonb_build_object(
    'variant_a', jsonb_build_object('runs', v_a_n, 'success', v_a_success, 'avg_latency_ms', v_a_lat, 'avg_cost_cents', v_a_cost, 'avg_quality', v_a_qual, 'success_rate', COALESCE(v_p1,0)),
    'variant_b', jsonb_build_object('runs', v_b_n, 'success', v_b_success, 'avg_latency_ms', v_b_lat, 'avg_cost_cents', v_b_cost, 'avg_quality', v_b_qual, 'success_rate', COALESCE(v_p2,0)),
    'p_value', COALESCE(v_p_value, 1),
    'z_score', COALESCE(v_z, 0),
    'significant', v_significant,
    'winner_candidate', v_winner,
    'metric', v_metric
  );
END $$;

-- RPC: promover vencedor
CREATE OR REPLACE FUNCTION public.promote_experiment_winner(p_experiment_id UUID, p_winner TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_workspace UUID;
  v_owner UUID;
BEGIN
  IF p_winner NOT IN ('a','b') THEN RAISE EXCEPTION 'invalid winner'; END IF;
  SELECT workspace_id, created_by INTO v_workspace, v_owner
    FROM public.prompt_experiments WHERE id = p_experiment_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'experiment not found'; END IF;
  IF v_owner <> auth.uid() AND NOT is_workspace_admin(auth.uid(), v_workspace) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  UPDATE public.prompt_experiments
    SET winner = p_winner, status = 'completed', ended_at = now()
    WHERE id = p_experiment_id;
  RETURN jsonb_build_object('experiment_id', p_experiment_id, 'winner', p_winner, 'status', 'completed');
END $$;