-- ═══════════════════════════════════════════════════
-- Migration 006: Database Manager — Plug & Play Supabase
-- Módulo para conectar, analisar e administrar qualquer banco Supabase
-- ═══════════════════════════════════════════════════

-- Bancos conectados pelo usuário
CREATE TABLE IF NOT EXISTS public.connected_databases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  anon_key TEXT NOT NULL,
  service_role_key TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','connected','error','analyzing','disconnected')),
  last_analysis TIMESTAMPTZ,
  schema_cache JSONB DEFAULT '{}',
  table_count INTEGER DEFAULT 0,
  function_count INTEGER DEFAULT 0,
  total_rows BIGINT DEFAULT 0,
  pg_version TEXT,
  region TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

DROP TRIGGER IF EXISTS connected_dbs_updated ON public.connected_databases;
CREATE TRIGGER connected_dbs_updated BEFORE UPDATE ON public.connected_databases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX IF NOT EXISTS idx_connected_dbs_ws ON public.connected_databases(workspace_id);

-- Cache de schemas descobertos
CREATE TABLE IF NOT EXISTS public.db_discovered_tables (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES public.connected_databases(id) ON DELETE CASCADE,
  table_schema TEXT NOT NULL DEFAULT 'public',
  table_name TEXT NOT NULL,
  table_type TEXT DEFAULT 'BASE TABLE',
  columns JSONB NOT NULL DEFAULT '[]',
  primary_key TEXT,
  foreign_keys JSONB DEFAULT '[]',
  indexes JSONB DEFAULT '[]',
  row_count BIGINT DEFAULT 0,
  size_bytes BIGINT DEFAULT 0,
  has_rls BOOLEAN DEFAULT false,
  rls_policies JSONB DEFAULT '[]',
  table_comment TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(database_id, table_schema, table_name)
);

CREATE INDEX IF NOT EXISTS idx_discovered_tables_db ON public.db_discovered_tables(database_id);

-- Cache de funções descobertas
CREATE TABLE IF NOT EXISTS public.db_discovered_functions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES public.connected_databases(id) ON DELETE CASCADE,
  function_schema TEXT NOT NULL DEFAULT 'public',
  function_name TEXT NOT NULL,
  return_type TEXT,
  argument_types TEXT,
  language TEXT DEFAULT 'plpgsql',
  is_trigger BOOLEAN DEFAULT false,
  source_code TEXT,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(database_id, function_schema, function_name, argument_types)
);

-- Log de operações no banco remoto
CREATE TABLE IF NOT EXISTS public.db_operation_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  database_id UUID NOT NULL REFERENCES public.connected_databases(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  operation TEXT NOT NULL CHECK (operation IN ('query','create_table','alter_table','drop_table','insert','update','delete','create_function','drop_function')),
  sql_executed TEXT,
  affected_rows INTEGER,
  duration_ms INTEGER,
  success BOOLEAN DEFAULT true,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_db_op_log ON public.db_operation_log(database_id, created_at DESC);

-- RLS
ALTER TABLE public.connected_databases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.db_discovered_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.db_discovered_functions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.db_operation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "connected_dbs_ws" ON public.connected_databases FOR ALL USING (
  workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
);
CREATE POLICY "discovered_tables_ws" ON public.db_discovered_tables FOR ALL USING (
  database_id IN (SELECT id FROM public.connected_databases WHERE workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "discovered_functions_ws" ON public.db_discovered_functions FOR ALL USING (
  database_id IN (SELECT id FROM public.connected_databases WHERE workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ))
);
CREATE POLICY "db_op_log_ws" ON public.db_operation_log FOR ALL USING (
  database_id IN (SELECT id FROM public.connected_databases WHERE workspace_id IN (
    SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
  ))
);
