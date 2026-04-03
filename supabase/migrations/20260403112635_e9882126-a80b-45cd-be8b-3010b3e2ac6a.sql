
-- deploy_connections: tracks agent deployment channels
CREATE TABLE IF NOT EXISTS public.deploy_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'inactive',
  config JSONB DEFAULT '{}',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, channel)
);
ALTER TABLE public.deploy_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view deploy connections" ON public.deploy_connections FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "Members can manage deploy connections" ON public.deploy_connections FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- agent_versions: versioned snapshots for rollback
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  config JSONB NOT NULL DEFAULT '{}',
  name TEXT,
  model TEXT,
  persona TEXT,
  mission TEXT,
  change_summary TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(agent_id, version)
);
ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view agent versions" ON public.agent_versions FOR SELECT USING (
  agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create agent versions" ON public.agent_versions FOR INSERT WITH CHECK (
  agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);

-- workflow_runs: execution tracking
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  output JSONB,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members can view workflow runs" ON public.workflow_runs FOR SELECT USING (
  workflow_id IN (
    SELECT w.id FROM public.workflows w
    WHERE w.workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
);
CREATE POLICY "Members can manage workflow runs" ON public.workflow_runs FOR ALL USING (
  workflow_id IN (
    SELECT w.id FROM public.workflows w
    WHERE w.workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  )
);

-- consent_records: LGPD consent tracking
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  consent_type TEXT NOT NULL,
  granted BOOLEAN NOT NULL DEFAULT false,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own consents" ON public.consent_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can manage own consents" ON public.consent_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own consents" ON public.consent_records FOR UPDATE USING (auth.uid() = user_id);

-- data_deletion_requests: LGPD deletion requests
CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own deletion requests" ON public.data_deletion_requests FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create deletion requests" ON public.data_deletion_requests FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_deploy_connections_agent ON public.deploy_connections(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON public.agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_workflow ON public.workflow_runs(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_runs_status ON public.workflow_runs(status);
CREATE INDEX IF NOT EXISTS idx_consent_records_user ON public.consent_records(user_id);
CREATE INDEX IF NOT EXISTS idx_data_deletion_requests_user ON public.data_deletion_requests(user_id);

-- Triggers for updated_at
CREATE TRIGGER update_deploy_connections_updated_at BEFORE UPDATE ON public.deploy_connections FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_consent_records_updated_at BEFORE UPDATE ON public.consent_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
