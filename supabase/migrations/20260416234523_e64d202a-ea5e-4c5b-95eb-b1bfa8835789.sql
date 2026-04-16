-- A/B Testing for agents
CREATE TABLE public.agent_experiments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','running','paused','completed')),
  variant_a_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  variant_b_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  traffic_split INTEGER NOT NULL DEFAULT 50 CHECK (traffic_split BETWEEN 0 AND 100),
  winner TEXT CHECK (winner IN ('a','b') OR winner IS NULL),
  started_at TIMESTAMP WITH TIME ZONE,
  ended_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_experiments_agent ON public.agent_experiments(agent_id);
CREATE INDEX idx_agent_experiments_workspace ON public.agent_experiments(workspace_id);
CREATE INDEX idx_agent_experiments_status ON public.agent_experiments(status);

CREATE TABLE public.agent_experiment_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  experiment_id UUID NOT NULL REFERENCES public.agent_experiments(id) ON DELETE CASCADE,
  variant TEXT NOT NULL CHECK (variant IN ('a','b')),
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output JSONB,
  latency_ms INTEGER,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  score NUMERIC,
  feedback TEXT,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_experiment_runs_exp ON public.agent_experiment_runs(experiment_id);
CREATE INDEX idx_agent_experiment_runs_variant ON public.agent_experiment_runs(experiment_id, variant);

ALTER TABLE public.agent_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_experiment_runs ENABLE ROW LEVEL SECURITY;

-- Experiments policies
CREATE POLICY "members read experiments"
  ON public.agent_experiments FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members create experiments"
  ON public.agent_experiments FOR INSERT TO authenticated
  WITH CHECK (
    workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    AND created_by = auth.uid()
  );

CREATE POLICY "members update own experiments"
  ON public.agent_experiments FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR is_workspace_admin(auth.uid(), workspace_id)
  )
  WITH CHECK (
    created_by = auth.uid()
    OR is_workspace_admin(auth.uid(), workspace_id)
  );

CREATE POLICY "admins delete experiments"
  ON public.agent_experiments FOR DELETE TO authenticated
  USING (
    is_workspace_admin(auth.uid(), workspace_id)
    OR created_by = auth.uid()
  );

-- Runs policies (inherit from experiment)
CREATE POLICY "members read runs"
  ON public.agent_experiment_runs FOR SELECT TO authenticated
  USING (
    experiment_id IN (
      SELECT id FROM public.agent_experiments
      WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    )
  );

CREATE POLICY "members create runs"
  ON public.agent_experiment_runs FOR INSERT TO authenticated
  WITH CHECK (
    experiment_id IN (
      SELECT id FROM public.agent_experiments
      WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
    )
  );

CREATE POLICY "members delete runs"
  ON public.agent_experiment_runs FOR DELETE TO authenticated
  USING (
    experiment_id IN (
      SELECT id FROM public.agent_experiments
      WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))
        AND (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
    )
  );

-- Trigger updated_at
CREATE TRIGGER trg_agent_experiments_updated_at
  BEFORE UPDATE ON public.agent_experiments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();