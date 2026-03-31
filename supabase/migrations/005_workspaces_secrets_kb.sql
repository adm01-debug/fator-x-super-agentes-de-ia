-- ═══════════════════════════════════════════════════
-- Migration 005: Workspaces, Secrets, Knowledge, Evaluations
-- Tabelas complementares para multi-tenancy e features
-- ═══════════════════════════════════════════════════

-- 1. Workspaces (multi-tenant)
CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Meu Workspace',
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  max_agents INTEGER DEFAULT 5,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Auto-create workspace on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE new_ws UUID;
BEGIN
  INSERT INTO public.workspaces (name, owner_id)
  VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', 'Meu Workspace'), NEW.id)
  RETURNING id INTO new_ws;
  INSERT INTO public.workspace_members (workspace_id, user_id, role, email, name)
  VALUES (new_ws, NEW.id, 'admin', NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Workspace Secrets (API keys encrypted)
CREATE TABLE IF NOT EXISTS public.workspace_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, key_name)
);

-- 4. Knowledge Bases
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

-- 5. Evaluation Runs
CREATE TABLE IF NOT EXISTS public.evaluation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id),
  name TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  test_cases INTEGER DEFAULT 0,
  pass_rate NUMERIC DEFAULT 0,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- RLS
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ws_owner" ON public.workspaces FOR ALL USING (
  owner_id = auth.uid() OR id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "secrets_ws" ON public.workspace_secrets FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "kb_ws" ON public.knowledge_bases FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "eval_ws" ON public.evaluation_runs FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- Add workspace_id to agents if missing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agents' AND column_name = 'workspace_id') THEN
    ALTER TABLE public.agents ADD COLUMN workspace_id UUID REFERENCES public.workspaces(id);
  END IF;
END $$;
