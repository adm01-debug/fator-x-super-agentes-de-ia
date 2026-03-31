-- ═══════════════════════════════════════════════════════════════
-- NEXUS AGENTS STUDIO — SQL Migration v1
-- Tabelas core + RLS + pgvector + triggers
-- ═══════════════════════════════════════════════════════════════

-- 0. Extensions
CREATE EXTENSION IF NOT EXISTS "pgvector" WITH SCHEMA "extensions";
CREATE EXTENSION IF NOT EXISTS "pg_trgm" WITH SCHEMA "extensions";

-- ═══ ENUMS ═══
DO $$ BEGIN
  CREATE TYPE agent_status AS ENUM (
    'draft', 'configured', 'testing', 'staging',
    'review', 'production', 'monitoring', 'deprecated', 'archived'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE trace_level AS ENUM ('debug', 'info', 'warning', 'error', 'critical');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ═══ 1. AGENTS ═══
CREATE TABLE IF NOT EXISTS public.agents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID,
  name TEXT NOT NULL,
  mission TEXT DEFAULT '',
  persona TEXT DEFAULT 'assistant',
  model TEXT DEFAULT 'claude-sonnet-4.6',
  reasoning TEXT DEFAULT 'react',
  status agent_status DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  avatar_emoji TEXT DEFAULT '🤖',
  config JSONB NOT NULL DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_template BOOLEAN DEFAULT false,
  template_category TEXT,
  readiness_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_user ON public.agents(user_id);
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_template ON public.agents(is_template) WHERE is_template = true;

-- ═══ 2. PROMPT VERSIONS ═══
CREATE TABLE IF NOT EXISTS public.prompt_versions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  version INTEGER NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  change_summary TEXT DEFAULT '',
  test_results JSONB,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_prompt_versions_agent ON public.prompt_versions(agent_id);

-- ═══ 3. AGENT TRACES ═══
CREATE TABLE IF NOT EXISTS public.agent_traces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  session_id UUID,
  event TEXT NOT NULL,
  input JSONB,
  output JSONB,
  latency_ms INTEGER,
  tokens_used INTEGER,
  cost_usd NUMERIC(10,6),
  level trace_level DEFAULT 'info',
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_traces_agent ON public.agent_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_traces_session ON public.agent_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_traces_created ON public.agent_traces(created_at DESC);

-- ═══ 4. AGENT USAGE (BILLING) ═══
CREATE TABLE IF NOT EXISTS public.agent_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  requests INTEGER DEFAULT 0,
  tokens_input INTEGER DEFAULT 0,
  tokens_output INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER,
  total_cost_usd NUMERIC(10,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, date)
);

CREATE INDEX IF NOT EXISTS idx_usage_agent_date ON public.agent_usage(agent_id, date);

-- ═══ 5. AGENT TEMPLATES ═══
CREATE TABLE IF NOT EXISTS public.agent_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  icon TEXT DEFAULT '🤖',
  config JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  author TEXT DEFAULT 'system',
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 6. AGENT TEST RESULTS ═══
CREATE TABLE IF NOT EXISTS public.agent_test_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  prompt_version INTEGER,
  model_used TEXT,
  results JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 7. WORKSPACE MEMBERS ═══
CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT DEFAULT '',
  role TEXT DEFAULT 'viewer' CHECK (role IN ('admin', 'editor', 'viewer', 'operator')),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ
);

-- ═══ 8. AGENT PERMISSIONS ═══
CREATE TABLE IF NOT EXISTS public.agent_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  can_edit BOOLEAN DEFAULT false,
  can_deploy BOOLEAN DEFAULT false,
  can_view_traces BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  UNIQUE(agent_id, user_id)
);

-- ═══ 9. AGENT FEEDBACK ═══
CREATE TABLE IF NOT EXISTS public.agent_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  trace_id UUID REFERENCES public.agent_traces(id),
  feedback_type TEXT CHECK (feedback_type IN ('thumbs_up', 'thumbs_down', 'correction', 'auto_eval')),
  user_correction TEXT,
  auto_eval_score NUMERIC(5,2),
  auto_eval_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ 10. EXECUTION TRACES (DETAILED) ═══
CREATE TABLE IF NOT EXISTS public.agent_execution_traces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  session_id UUID,
  user_input TEXT,
  context_retrieved JSONB,
  memories_used JSONB,
  prompt_assembled TEXT,
  llm_response TEXT,
  tool_calls JSONB,
  guardrails_triggered JSONB,
  final_output TEXT,
  total_tokens INTEGER,
  total_cost NUMERIC(10,6),
  latency_ms INTEGER,
  status TEXT DEFAULT 'success',
  error_details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_exec_traces_agent ON public.agent_execution_traces(agent_id);
CREATE INDEX IF NOT EXISTS idx_exec_traces_session ON public.agent_execution_traces(session_id);
CREATE INDEX IF NOT EXISTS idx_exec_traces_created ON public.agent_execution_traces(created_at DESC);

-- ═══ RLS (Row Level Security) ═══
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_traces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_feedback ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_execution_traces ENABLE ROW LEVEL SECURITY;

-- Policies: agents
CREATE POLICY "Users see own agents" ON public.agents FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users create own agents" ON public.agents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own agents" ON public.agents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own agents" ON public.agents FOR DELETE USING (auth.uid() = user_id);

-- Policies: prompt_versions
CREATE POLICY "Users manage own prompt versions" ON public.prompt_versions FOR ALL USING (
  agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);

-- Policies: traces
CREATE POLICY "Users see own traces" ON public.agent_traces FOR ALL USING (user_id = auth.uid());

-- Policies: usage
CREATE POLICY "Users see own usage" ON public.agent_usage FOR ALL USING (user_id = auth.uid());

-- Policies: templates (public read)
CREATE POLICY "Public templates" ON public.agent_templates FOR SELECT USING (is_public = true);

-- Policies: test results
CREATE POLICY "Users manage own test results" ON public.agent_test_results FOR ALL USING (
  agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);

-- Policies: execution traces
CREATE POLICY "Users see own execution traces" ON public.agent_execution_traces FOR ALL USING (
  agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);

-- Policies: feedback
CREATE POLICY "Users manage own feedback" ON public.agent_feedback FOR ALL USING (
  agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid())
);

-- Policies: workspace members
CREATE POLICY "Members see own workspace" ON public.workspace_members FOR SELECT USING (user_id = auth.uid());

-- Policies: agent permissions
CREATE POLICY "Users see own permissions" ON public.agent_permissions FOR SELECT USING (user_id = auth.uid());

-- ═══ TRIGGERS ═══
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON public.agents;
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
