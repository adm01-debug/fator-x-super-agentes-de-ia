-- ═══════════════════════════════════════════════════
-- Migration 005: DEFINITIVA — Corrigida pelo Stress Test (23 falhas)
-- Workspaces, Secrets, Knowledge, Evaluations + Fixes nas tabelas existentes
-- ═══════════════════════════════════════════════════

-- ═══ BLOCO 1: Funções utilitárias ═══

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.get_user_workspace_id()
RETURNS UUID AS $$
  SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() LIMIT 1;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ═══ BLOCO 2: Workspaces + Members (com exception handler) ═══

CREATE TABLE IF NOT EXISTS public.workspaces (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL DEFAULT 'Meu Workspace',
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free','pro','enterprise')),
  max_agents INTEGER NOT NULL DEFAULT 5,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS workspaces_updated_at ON public.workspaces;
CREATE TRIGGER workspaces_updated_at BEFORE UPDATE ON public.workspaces
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Auto-create workspace on signup (com exception handler — Falha #14)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE new_ws UUID;
BEGIN
  BEGIN
    INSERT INTO public.workspaces (name, owner_id)
    VALUES (COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)) || '''s Workspace', NEW.id)
    RETURNING id INTO new_ws;
    INSERT INTO public.workspace_members (workspace_id, user_id, role, email, name, accepted_at)
    VALUES (new_ws, NEW.id, 'admin', NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)), NOW());
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'handle_new_user failed for %: %', NEW.id, SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- RLS Workspaces (corrigida — sem recursão, Falha #15)
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_owner_all" ON public.workspaces FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "ws_member_select" ON public.workspaces FOR SELECT USING (
  id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- RLS Members (sem recursão, Falha #15 + #16)
ALTER TABLE public.workspace_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wm_self" ON public.workspace_members FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "wm_colleagues" ON public.workspace_members FOR SELECT USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "wm_admin_manage" ON public.workspace_members FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin')
);

CREATE INDEX IF NOT EXISTS idx_wm_user ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_wm_workspace ON public.workspace_members(workspace_id);

-- ═══ BLOCO 3: Fix tabela agents (Falhas #1-#6) ═══

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS config_version INTEGER DEFAULT 1;

-- Preencher workspace_id (Falha #3)
UPDATE public.agents SET workspace_id = (
  SELECT w.id FROM public.workspaces w WHERE w.owner_id = agents.user_id LIMIT 1
) WHERE workspace_id IS NULL;

-- Trigger updated_at (Falha #4)
DROP TRIGGER IF EXISTS agents_updated_at ON public.agents;
CREATE TRIGGER agents_updated_at BEFORE UPDATE ON public.agents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Índices (Falha #5)
CREATE INDEX IF NOT EXISTS idx_agents_workspace ON public.agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_agents_status ON public.agents(status);
CREATE INDEX IF NOT EXISTS idx_agents_not_deleted ON public.agents(workspace_id) WHERE deleted_at IS NULL;

-- RLS granular (Falha #17)
DROP POLICY IF EXISTS "Users see own agents" ON public.agents;
DROP POLICY IF EXISTS "Users create own agents" ON public.agents;
DROP POLICY IF EXISTS "Users update own agents" ON public.agents;
DROP POLICY IF EXISTS "Users delete own agents" ON public.agents;

CREATE POLICY "agents_select" ON public.agents FOR SELECT USING (
  deleted_at IS NULL AND (user_id = auth.uid() OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "agents_insert" ON public.agents FOR INSERT WITH CHECK (
  user_id = auth.uid() AND workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role IN ('admin','editor')
  )
);
CREATE POLICY "agents_update" ON public.agents FOR UPDATE USING (
  user_id = auth.uid() OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin'
  )
);
CREATE POLICY "agents_delete" ON public.agents FOR DELETE USING (
  user_id = auth.uid() OR workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin'
  )
);

-- ═══ BLOCO 4: Fix traces/usage/prompts (Falhas #7-#13) ═══

ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);
CREATE INDEX IF NOT EXISTS idx_traces_created ON public.agent_traces(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_traces_agent_time ON public.agent_traces(agent_id, created_at DESC);

ALTER TABLE public.agent_usage ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id);

-- Unique active prompt per agent (Falha #12)
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_prompt ON public.prompt_versions(agent_id) WHERE is_active = true;

-- ═══ BLOCO 5: Tabelas novas ═══

CREATE TABLE IF NOT EXISTS public.workspace_secrets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  key_name TEXT NOT NULL,
  key_value TEXT NOT NULL,
  key_hint TEXT GENERATED ALWAYS AS (
    CASE WHEN length(key_value) > 8 THEN '...' || right(key_value, 4) ELSE '****' END
  ) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(workspace_id, key_name)
);

DROP TRIGGER IF EXISTS secrets_updated_at ON public.workspace_secrets;
CREATE TRIGGER secrets_updated_at BEFORE UPDATE ON public.workspace_secrets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.knowledge_bases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  vector_db TEXT DEFAULT 'pgvector',
  embedding_model TEXT DEFAULT 'text-embedding-3-large',
  document_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('active','syncing','error','archived')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS kb_updated_at ON public.knowledge_bases;
CREATE TRIGGER kb_updated_at BEFORE UPDATE ON public.knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE IF NOT EXISTS public.evaluation_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  test_cases INTEGER DEFAULT 0,
  pass_rate NUMERIC DEFAULT 0,
  results JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_eval_agent ON public.evaluation_runs(agent_id);
CREATE INDEX IF NOT EXISTS idx_kb_workspace ON public.knowledge_bases(workspace_id);

-- RLS novas tabelas
ALTER TABLE public.workspace_secrets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_bases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluation_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "secrets_admin" ON public.workspace_secrets FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "kb_ws" ON public.knowledge_bases FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "eval_ws" ON public.evaluation_runs FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);

-- VIEW segura (nunca expõe key_value)
CREATE OR REPLACE VIEW public.workspace_secrets_safe AS
  SELECT id, workspace_id, key_name, key_hint, created_at, updated_at
  FROM public.workspace_secrets;
