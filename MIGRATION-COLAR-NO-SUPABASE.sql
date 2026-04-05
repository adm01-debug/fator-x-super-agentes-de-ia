-- ═══════════════════════════════════════════════════════════════
-- NEXUS AGENTS STUDIO — 4 MIGRATIONS CONSOLIDADAS
-- Cole este SQL INTEIRO no Supabase Dashboard → SQL Editor → Run
-- Projeto: tifbqkyumdxzmxyyoqlu
-- ═══════════════════════════════════════════════════════════════

-- ══════ 1/4: SECURITY INFRASTRUCTURE ══════

CREATE TABLE IF NOT EXISTS public.rate_limit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  identifier TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  limit_name TEXT NOT NULL,
  was_blocked BOOLEAN DEFAULT false,
  request_count INTEGER DEFAULT 1,
  window_ms INTEGER NOT NULL,
  max_requests INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_logs_identifier ON public.rate_limit_logs(identifier, created_at DESC);
ALTER TABLE public.rate_limit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  scopes TEXT[] DEFAULT '{read,execute}',
  rate_limit_tier TEXT DEFAULT 'standard',
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON public.api_keys(key_hash) WHERE is_active = true;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.security_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  user_id UUID,
  workspace_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(event_type, created_at DESC);
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- ══════ 2/4: RBAC SYSTEM ══════

CREATE TABLE IF NOT EXISTS public.roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  level INTEGER NOT NULL DEFAULT 0,
  color TEXT DEFAULT '#4D96FF',
  icon TEXT DEFAULT '👤',
  is_system BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  module TEXT NOT NULL,
  category TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role_id UUID NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id UUID NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key TEXT NOT NULL REFERENCES public.roles(key),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, workspace_id)
);

CREATE TABLE IF NOT EXISTS public.agent_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL DEFAULT 'view',
  granted_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, user_id)
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_permissions ENABLE ROW LEVEL SECURITY;

-- Seed: 5 Roles
INSERT INTO public.roles (key, name, description, level, icon, is_system) VALUES
  ('workspace_admin', 'Administrador', 'Acesso total ao workspace', 100, '👑', true),
  ('agent_editor', 'Editor de Agentes', 'Criar, editar e testar agentes', 70, '✏️', true),
  ('agent_viewer', 'Visualizador', 'Visualizar agentes e dashboards', 30, '👁️', true),
  ('operator', 'Operador', 'Executar agentes e ver métricas', 50, '⚙️', true),
  ('auditor', 'Auditor', 'Acesso somente leitura a logs e auditoria', 40, '🔍', true)
ON CONFLICT (key) DO NOTHING;

-- Seed: 32 Permissions
INSERT INTO public.permissions (key, name, module, category, is_system) VALUES
  ('agents.create','Criar Agentes','agents','crud',true),
  ('agents.read','Visualizar Agentes','agents','crud',true),
  ('agents.update','Editar Agentes','agents','crud',true),
  ('agents.delete','Deletar Agentes','agents','crud',true),
  ('agents.deploy','Deploy de Agentes','agents','action',true),
  ('agents.test','Testar Agentes','agents','action',true),
  ('workflows.create','Criar Workflows','workflows','crud',true),
  ('workflows.read','Visualizar Workflows','workflows','crud',true),
  ('workflows.update','Editar Workflows','workflows','crud',true),
  ('workflows.delete','Deletar Workflows','workflows','crud',true),
  ('workflows.execute','Executar Workflows','workflows','action',true),
  ('knowledge.read','Consultar Conhecimento','knowledge','crud',true),
  ('knowledge.write','Adicionar Conhecimento','knowledge','crud',true),
  ('knowledge.delete','Remover Conhecimento','knowledge','crud',true),
  ('knowledge.manage','Gerenciar Coleções','knowledge','admin',true),
  ('oracle.query','Consultar Oráculo','oracle','action',true),
  ('oracle.configure','Configurar Oráculo','oracle','admin',true),
  ('oracle.history','Ver Histórico Oráculo','oracle','view',true),
  ('datahub.read','Consultar DataHub','datahub','crud',true),
  ('datahub.write','Alterar Dados no DataHub','datahub','crud',true),
  ('datahub.connections','Gerenciar Conexões','datahub','admin',true),
  ('team.read','Ver Membros','team','crud',true),
  ('team.invite','Convidar Membros','team','action',true),
  ('team.remove','Remover Membros','team','action',true),
  ('team.roles','Gerenciar Roles','team','admin',true),
  ('settings.read','Ver Configurações','settings','crud',true),
  ('settings.write','Alterar Configurações','settings','crud',true),
  ('settings.api_keys','Gerenciar API Keys','settings','admin',true),
  ('settings.billing','Ver Billing','settings','view',true),
  ('monitoring.read','Ver Monitoramento','monitoring','view',true),
  ('monitoring.traces','Ver Traces','monitoring','view',true),
  ('monitoring.audit','Ver Logs de Auditoria','monitoring','view',true)
ON CONFLICT (key) DO NOTHING;

-- Admin gets all permissions
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM public.roles r, public.permissions p WHERE r.key = 'workspace_admin'
ON CONFLICT DO NOTHING;

-- Helper function
CREATE OR REPLACE FUNCTION public.user_has_permission(p_user_id UUID, p_workspace_id UUID, p_permission_key TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles ur
    JOIN public.role_permissions rp ON rp.role_id = (SELECT id FROM public.roles WHERE key = ur.role_key)
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE ur.user_id = p_user_id AND ur.workspace_id = p_workspace_id AND p.key = p_permission_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Auto-assign admin
CREATE OR REPLACE FUNCTION public.auto_assign_admin_role() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE workspace_id = NEW.workspace_id AND role_key = 'workspace_admin') THEN
    INSERT INTO public.user_roles (user_id, role_key, workspace_id, assigned_by) VALUES (NEW.user_id, 'workspace_admin', NEW.workspace_id, NEW.user_id) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_assign_admin ON public.workspace_members;
CREATE TRIGGER trg_auto_assign_admin AFTER INSERT ON public.workspace_members FOR EACH ROW EXECUTE FUNCTION public.auto_assign_admin_role();

-- ══════ 3/4: MCP SERVERS ══════

CREATE TABLE IF NOT EXISTS public.mcp_servers (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  transport TEXT DEFAULT 'streamable-http',
  auth_type TEXT DEFAULT 'none',
  auth_config JSONB DEFAULT '{}',
  status TEXT DEFAULT 'disconnected',
  tools_discovered JSONB DEFAULT '[]',
  resources_discovered JSONB DEFAULT '[]',
  error TEXT,
  is_active BOOLEAN DEFAULT true,
  last_connected_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.mcp_servers ENABLE ROW LEVEL SECURITY;

-- ══════ 4/4: RAG HYBRID SEARCH ══════

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES public.chunks(id);
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS chunk_level TEXT DEFAULT 'child';
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE public.chunks ADD COLUMN embedding vector(1024);
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE public.chunks ADD COLUMN bm25_tsvector tsvector;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_chunks_bm25 ON public.chunks USING GIN(bm25_tsvector);
CREATE INDEX IF NOT EXISTS idx_chunks_parent ON public.chunks(parent_chunk_id);

CREATE OR REPLACE FUNCTION public.chunks_update_bm25() RETURNS TRIGGER AS $$
BEGIN
  NEW.bm25_tsvector := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_bm25 ON public.chunks;
CREATE TRIGGER trg_chunks_bm25 BEFORE INSERT OR UPDATE OF content ON public.chunks FOR EACH ROW EXECUTE FUNCTION public.chunks_update_bm25();

-- ═══ FIM — 4 migrations aplicadas com sucesso ═══
