CREATE TABLE IF NOT EXISTS public.agent_workflows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL DEFAULT '[]'::jsonb,
  edges JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.agent_workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID NOT NULL REFERENCES public.agent_workflows(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running',
  input JSONB,
  output JSONB,
  trace JSONB NOT NULL DEFAULT '[]'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  created_by UUID NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agent_workflows_agent ON public.agent_workflows(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_workflows_ws ON public.agent_workflows(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agent_workflow_runs_wf ON public.agent_workflow_runs(workflow_id);

ALTER TABLE public.agent_workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_workflow_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Workspace members view workflows" ON public.agent_workflows;
DROP POLICY IF EXISTS "Workspace members create workflows" ON public.agent_workflows;
DROP POLICY IF EXISTS "Workspace members update workflows" ON public.agent_workflows;
DROP POLICY IF EXISTS "Workspace members delete workflows" ON public.agent_workflows;
DROP POLICY IF EXISTS "View workflow runs" ON public.agent_workflow_runs;
DROP POLICY IF EXISTS "Create workflow runs" ON public.agent_workflow_runs;
DROP POLICY IF EXISTS "Update workflow runs" ON public.agent_workflow_runs;

CREATE POLICY "Workspace members view workflows" ON public.agent_workflows
  FOR SELECT USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members create workflows" ON public.agent_workflows
  FOR INSERT WITH CHECK (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())) AND created_by = auth.uid());
CREATE POLICY "Workspace members update workflows" ON public.agent_workflows
  FOR UPDATE USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));
CREATE POLICY "Workspace members delete workflows" ON public.agent_workflows
  FOR DELETE USING (workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid())));

CREATE POLICY "View workflow runs" ON public.agent_workflow_runs
  FOR SELECT USING (workflow_id IN (SELECT id FROM public.agent_workflows WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));
CREATE POLICY "Create workflow runs" ON public.agent_workflow_runs
  FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Update workflow runs" ON public.agent_workflow_runs
  FOR UPDATE USING (workflow_id IN (SELECT id FROM public.agent_workflows WHERE workspace_id IN (SELECT public.get_user_workspace_ids(auth.uid()))));

DROP TRIGGER IF EXISTS trg_agent_workflows_updated ON public.agent_workflows;
CREATE TRIGGER trg_agent_workflows_updated BEFORE UPDATE ON public.agent_workflows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();