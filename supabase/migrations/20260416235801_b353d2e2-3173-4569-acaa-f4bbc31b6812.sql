-- Eval Suite tables
CREATE TABLE public.agent_eval_datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  agent_id UUID,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_eval_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  dataset_id UUID NOT NULL REFERENCES public.agent_eval_datasets(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  total_items INTEGER NOT NULL DEFAULT 0,
  passed INTEGER NOT NULL DEFAULT 0,
  failed INTEGER NOT NULL DEFAULT 0,
  avg_score NUMERIC DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  total_cost_usd NUMERIC DEFAULT 0,
  model TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.agent_eval_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  run_id UUID NOT NULL REFERENCES public.agent_eval_runs(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  input TEXT NOT NULL,
  expected TEXT,
  actual TEXT,
  passed BOOLEAN NOT NULL DEFAULT false,
  score NUMERIC NOT NULL DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  judge_reasoning TEXT,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_eval_datasets_workspace ON public.agent_eval_datasets(workspace_id);
CREATE INDEX idx_agent_eval_runs_dataset ON public.agent_eval_runs(dataset_id);
CREATE INDEX idx_agent_eval_runs_agent ON public.agent_eval_runs(agent_id);
CREATE INDEX idx_agent_eval_results_run ON public.agent_eval_results(run_id);

ALTER TABLE public.agent_eval_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_eval_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_eval_results ENABLE ROW LEVEL SECURITY;

-- Datasets policies
CREATE POLICY "members read eval datasets" ON public.agent_eval_datasets
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members create eval datasets" ON public.agent_eval_datasets
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "members update own eval datasets" ON public.agent_eval_datasets
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id))
  WITH CHECK (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id));

CREATE POLICY "members delete own eval datasets" ON public.agent_eval_datasets
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id));

-- Runs policies
CREATE POLICY "members read eval runs" ON public.agent_eval_runs
  FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members create eval runs" ON public.agent_eval_runs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())) AND created_by = auth.uid());

CREATE POLICY "members update eval runs" ON public.agent_eval_runs
  FOR UPDATE TO authenticated
  USING (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())))
  WITH CHECK (workspace_id IN (SELECT get_user_workspace_ids(auth.uid())));

CREATE POLICY "members delete eval runs" ON public.agent_eval_runs
  FOR DELETE TO authenticated
  USING (created_by = auth.uid() OR is_workspace_admin(auth.uid(), workspace_id));

-- Results policies
CREATE POLICY "members read eval results" ON public.agent_eval_results
  FOR SELECT TO authenticated
  USING (run_id IN (SELECT id FROM public.agent_eval_runs WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

CREATE POLICY "members insert eval results" ON public.agent_eval_results
  FOR INSERT TO authenticated
  WITH CHECK (run_id IN (SELECT id FROM public.agent_eval_runs WHERE workspace_id IN (SELECT get_user_workspace_ids(auth.uid()))));

CREATE TRIGGER update_agent_eval_datasets_updated_at
  BEFORE UPDATE ON public.agent_eval_datasets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();