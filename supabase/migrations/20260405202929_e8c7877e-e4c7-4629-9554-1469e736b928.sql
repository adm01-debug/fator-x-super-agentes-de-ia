-- Agent Skills — skills learned from experience
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  pattern TEXT NOT NULL DEFAULT '',
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  confidence NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  source_trace_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own agent skills"
  ON public.agent_skills FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own agent skills"
  ON public.agent_skills FOR INSERT TO authenticated
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY "Users can update own agent skills"
  ON public.agent_skills FOR UPDATE TO authenticated
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete own agent skills"
  ON public.agent_skills FOR DELETE TO authenticated
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE INDEX idx_agent_skills_agent ON public.agent_skills(agent_id);
CREATE INDEX idx_agent_skills_confidence ON public.agent_skills(confidence DESC);

-- Skill Registry — marketplace
CREATE TABLE IF NOT EXISTS public.skill_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  version TEXT NOT NULL DEFAULT '1.0.0',
  author TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'tools',
  tags TEXT[] DEFAULT '{}',
  install_count INTEGER NOT NULL DEFAULT 0,
  rating NUMERIC(3,2) NOT NULL DEFAULT 0,
  skill_config JSONB NOT NULL DEFAULT '{}',
  mcp_server_url TEXT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.skill_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view public skills"
  ON public.skill_registry FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users can create skills"
  ON public.skill_registry FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Users can update own skills"
  ON public.skill_registry FOR UPDATE TO authenticated
  USING (created_by = auth.uid());

CREATE POLICY "Users can delete own skills"
  ON public.skill_registry FOR DELETE TO authenticated
  USING (created_by = auth.uid());

CREATE INDEX idx_skill_registry_category ON public.skill_registry(category);
CREATE INDEX idx_skill_registry_slug ON public.skill_registry(slug);

-- Agent Installed Skills — junction table
CREATE TABLE IF NOT EXISTS public.agent_installed_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  skill_id UUID NOT NULL REFERENCES public.skill_registry(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  config_overrides JSONB DEFAULT '{}',
  UNIQUE(agent_id, skill_id)
);

ALTER TABLE public.agent_installed_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own installed skills"
  ON public.agent_installed_skills FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY "Users can install skills"
  ON public.agent_installed_skills FOR INSERT TO authenticated
  WITH CHECK (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE POLICY "Users can uninstall skills"
  ON public.agent_installed_skills FOR DELETE TO authenticated
  USING (agent_id IN (SELECT id FROM agents WHERE user_id = auth.uid()));

CREATE INDEX idx_installed_skills_agent ON public.agent_installed_skills(agent_id);

-- RPC: increment install count
CREATE OR REPLACE FUNCTION public.increment_skill_installs(p_skill_id UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE skill_registry SET install_count = install_count + 1 WHERE id = p_skill_id;
$$;