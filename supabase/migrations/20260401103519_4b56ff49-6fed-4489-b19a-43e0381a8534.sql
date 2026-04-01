
-- Collections
CREATE TABLE IF NOT EXISTS public.collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  collection_id UUID REFERENCES public.collections(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_type TEXT DEFAULT 'upload',
  source_url TEXT,
  mime_type TEXT,
  size_bytes BIGINT DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','processing','indexed','failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  embedding_status TEXT DEFAULT 'pending' CHECK (embedding_status IN ('pending','processing','done','failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.vector_indexes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  knowledge_base_id UUID REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  provider TEXT DEFAULT 'pgvector',
  model TEXT DEFAULT 'text-embedding-3-large',
  dimensions INTEGER DEFAULT 3072,
  status TEXT DEFAULT 'active',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tool_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'api',
  description TEXT DEFAULT '',
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.tool_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  tool_integration_id UUID REFERENCES public.tool_integrations(id) ON DELETE CASCADE,
  environment TEXT DEFAULT 'development',
  is_allowed BOOLEAN DEFAULT true,
  max_calls_per_run INTEGER,
  requires_approval BOOLEAN DEFAULT false,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','active','archived')),
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  role TEXT DEFAULT 'executor',
  step_order INTEGER NOT NULL DEFAULT 0,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.evaluation_datasets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  case_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.test_cases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dataset_id UUID REFERENCES public.evaluation_datasets(id) ON DELETE CASCADE,
  input TEXT NOT NULL,
  expected_output TEXT,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.environments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'development',
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','ended','error')),
  metadata JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS public.session_traces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
  trace_type TEXT NOT NULL DEFAULT 'llm_call',
  input JSONB,
  output JSONB,
  latency_ms INTEGER,
  tokens_used INTEGER,
  cost_usd NUMERIC,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.trace_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_trace_id UUID REFERENCES public.session_traces(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.guardrail_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'content_filter',
  config JSONB DEFAULT '{}',
  is_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  is_resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.usage_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  record_type TEXT NOT NULL DEFAULT 'llm_call',
  tokens INTEGER DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Mensal',
  limit_usd NUMERIC NOT NULL DEFAULT 100,
  current_usd NUMERIC DEFAULT 0,
  period TEXT DEFAULT 'monthly' CHECK (period IN ('daily','weekly','monthly')),
  alert_threshold NUMERIC DEFAULT 0.8,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vector_indexes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tool_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_datasets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trace_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guardrail_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;

-- RLS: Collections via kb -> workspace
CREATE POLICY "collections_all" ON public.collections FOR ALL TO authenticated
  USING (knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))
  WITH CHECK (knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())));

-- RLS: Documents via collection -> kb -> workspace
CREATE POLICY "documents_all" ON public.documents FOR ALL TO authenticated
  USING (collection_id IN (SELECT col.id FROM public.collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))))
  WITH CHECK (collection_id IN (SELECT col.id FROM public.collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))));

-- RLS: Chunks via document -> collection -> kb -> workspace
CREATE POLICY "chunks_all" ON public.chunks FOR ALL TO authenticated
  USING (document_id IN (SELECT doc.id FROM public.documents doc WHERE doc.collection_id IN (SELECT col.id FROM public.collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))))
  WITH CHECK (document_id IN (SELECT doc.id FROM public.documents doc WHERE doc.collection_id IN (SELECT col.id FROM public.collections col WHERE col.knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))));

-- RLS: Vector indexes via kb -> workspace
CREATE POLICY "vector_indexes_all" ON public.vector_indexes FOR ALL TO authenticated
  USING (knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))
  WITH CHECK (knowledge_base_id IN (SELECT kb.id FROM public.knowledge_bases kb WHERE kb.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())));

-- RLS: Workspace-scoped (simple pattern using subquery, no JOINs)
CREATE POLICY "tool_integrations_all" ON public.tool_integrations FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "tool_policies_all" ON public.tool_policies FOR ALL TO authenticated
  USING (agent_id IN (SELECT a.id FROM public.agents a WHERE a.user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT a.id FROM public.agents a WHERE a.user_id = auth.uid()));

CREATE POLICY "workflows_all" ON public.workflows FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "workflow_steps_all" ON public.workflow_steps FOR ALL TO authenticated
  USING (workflow_id IN (SELECT w.id FROM public.workflows w WHERE w.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))
  WITH CHECK (workflow_id IN (SELECT w.id FROM public.workflows w WHERE w.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())));

CREATE POLICY "evaluation_datasets_all" ON public.evaluation_datasets FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "test_cases_all" ON public.test_cases FOR ALL TO authenticated
  USING (dataset_id IN (SELECT ed.id FROM public.evaluation_datasets ed WHERE ed.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))
  WITH CHECK (dataset_id IN (SELECT ed.id FROM public.evaluation_datasets ed WHERE ed.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())));

CREATE POLICY "environments_all" ON public.environments FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "sessions_all" ON public.sessions FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "session_traces_all" ON public.session_traces FOR ALL TO authenticated
  USING (session_id IN (SELECT s.id FROM public.sessions s WHERE s.user_id = auth.uid()))
  WITH CHECK (session_id IN (SELECT s.id FROM public.sessions s WHERE s.user_id = auth.uid()));

CREATE POLICY "trace_events_all" ON public.trace_events FOR ALL TO authenticated
  USING (session_trace_id IN (SELECT st.id FROM public.session_traces st WHERE st.session_id IN (SELECT s.id FROM public.sessions s WHERE s.user_id = auth.uid())))
  WITH CHECK (session_trace_id IN (SELECT st.id FROM public.session_traces st WHERE st.session_id IN (SELECT s.id FROM public.sessions s WHERE s.user_id = auth.uid())));

CREATE POLICY "guardrail_policies_all" ON public.guardrail_policies FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "alerts_all" ON public.alerts FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "usage_records_all" ON public.usage_records FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "budgets_all" ON public.budgets FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));
