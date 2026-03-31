
-- Workspaces (multi-tenant)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Meu Workspace',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free',
  max_agents INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.workspace_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'editor',
  email TEXT,
  name TEXT,
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  UNIQUE(workspace_id, user_id)
);

-- Trigger: auto-create workspace when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  new_workspace_id UUID;
BEGIN
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Meu Workspace'), NEW.id)
  RETURNING id INTO new_workspace_id;
  
  INSERT INTO public.workspace_members (workspace_id, user_id, role, email, name)
  VALUES (new_workspace_id, NEW.id, 'admin', NEW.email, NEW.raw_user_meta_data->>'full_name');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Add workspace_id to agents
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'agents' AND column_name = 'workspace_id'
  ) THEN
    ALTER TABLE public.agents ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
  END IF;
END $$;

-- Knowledge Bases
CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  vector_db TEXT DEFAULT 'pgvector',
  embedding_model TEXT DEFAULT 'text-embedding-3-large',
  document_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Templates
CREATE TABLE IF NOT EXISTS public.agent_templates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  category TEXT DEFAULT 'general',
  icon TEXT DEFAULT '🤖',
  config JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Evaluation Runs
CREATE TABLE IF NOT EXISTS public.evaluation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  test_cases INTEGER DEFAULT 0,
  pass_rate NUMERIC DEFAULT 0,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;

-- Workspace policies
CREATE POLICY "Users see own workspaces" ON public.workspaces
  FOR SELECT TO authenticated
  USING (owner_id = auth.uid() OR id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "Owner can update workspace" ON public.workspaces
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

CREATE POLICY "Users can insert workspaces" ON public.workspaces
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

-- Workspace members policies
CREATE POLICY "Members see workspace members" ON public.workspace_members
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()
  ));

CREATE POLICY "Admins can insert members" ON public.workspace_members
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT ws.id FROM public.workspaces ws WHERE ws.owner_id = auth.uid()
  ));

-- Knowledge bases policies
CREATE POLICY "kb_workspace_select" ON public.knowledge_bases
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "kb_workspace_insert" ON public.knowledge_bases
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

-- Agent templates policies
CREATE POLICY "templates_public_select" ON public.agent_templates
  FOR SELECT TO authenticated
  USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "templates_insert" ON public.agent_templates
  FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Evaluation runs policies
CREATE POLICY "evals_workspace_select" ON public.evaluation_runs
  FOR SELECT TO authenticated
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));

CREATE POLICY "evals_workspace_insert" ON public.evaluation_runs
  FOR INSERT TO authenticated
  WITH CHECK (workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ));
