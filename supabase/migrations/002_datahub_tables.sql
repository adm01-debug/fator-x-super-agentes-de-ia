-- ═══════════════════════════════════════════════════
-- NEXUS DATAHUB: Tabelas do módulo de gestão de BDs
-- Migration 002
-- ═══════════════════════════════════════════════════

-- 1. Conexões com bancos externos
CREATE TABLE IF NOT EXISTS public.datahub_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  project_ref TEXT NOT NULL,
  supabase_url TEXT NOT NULL,
  anon_key_encrypted TEXT NOT NULL DEFAULT '',
  domain TEXT NOT NULL,
  color TEXT DEFAULT '#4D96FF',
  icon TEXT DEFAULT '📊',
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error','hibernated','syncing')),
  last_health_check TIMESTAMPTZ,
  latency_ms INTEGER,
  table_count INTEGER DEFAULT 0,
  total_rows BIGINT DEFAULT 0,
  postgres_version TEXT,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Cache de schemas
CREATE TABLE IF NOT EXISTS public.datahub_table_schemas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES public.datahub_connections(id) ON DELETE CASCADE,
  table_name TEXT NOT NULL,
  columns JSONB NOT NULL DEFAULT '[]',
  primary_key TEXT,
  foreign_keys JSONB DEFAULT '[]',
  row_count BIGINT DEFAULT 0,
  last_discovered TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(connection_id, table_name)
);

-- 3. Mapeamento de entidades
CREATE TABLE IF NOT EXISTS public.datahub_entity_mappings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  entity_icon TEXT DEFAULT '📊',
  description TEXT DEFAULT '',
  primary_connection_id UUID REFERENCES public.datahub_connections(id),
  primary_table TEXT NOT NULL,
  primary_id_column TEXT NOT NULL DEFAULT 'id',
  primary_display_column TEXT NOT NULL,
  primary_filter TEXT,
  secondary_sources JSONB DEFAULT '[]',
  sync_to_brain BOOLEAN DEFAULT false,
  record_count BIGINT DEFAULT 0,
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Queries salvas
CREATE TABLE IF NOT EXISTS public.datahub_saved_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  connection_id UUID REFERENCES public.datahub_connections(id),
  sql_query TEXT NOT NULL,
  last_run TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Query log
CREATE TABLE IF NOT EXISTS public.datahub_query_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES public.datahub_connections(id),
  query_source TEXT CHECK (query_source IN ('agent','explorer','query_builder','sync','brain','natural_language')),
  sql_executed TEXT,
  result_count INTEGER,
  latency_ms INTEGER,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sync log
CREATE TABLE IF NOT EXISTS public.datahub_sync_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_mapping_id UUID REFERENCES public.datahub_entity_mappings(id),
  sync_type TEXT CHECK (sync_type IN ('full','incremental','realtime')),
  records_synced INTEGER DEFAULT 0,
  facts_generated INTEGER DEFAULT 0,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Permissões
CREATE TABLE IF NOT EXISTS public.datahub_access_policies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  connection_id UUID REFERENCES public.datahub_connections(id),
  agent_id UUID,
  access_level TEXT DEFAULT 'read' CHECK (access_level IN ('none','read','read_write')),
  restricted_tables TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_datahub_connections_ws ON public.datahub_connections(workspace_id);
CREATE INDEX IF NOT EXISTS idx_datahub_query_log_ts ON public.datahub_query_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_datahub_table_schemas_conn ON public.datahub_table_schemas(connection_id);

-- RLS
ALTER TABLE public.datahub_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_table_schemas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_entity_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_saved_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_query_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_sync_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.datahub_access_policies ENABLE ROW LEVEL SECURITY;

-- Seed: 5 conexões reais da Promo Brindes
INSERT INTO public.datahub_connections (name, display_name, project_ref, supabase_url, domain, color, icon, description, status, table_count, total_rows, workspace_id)
VALUES
  ('bancodadosclientes', 'CRM & Vendas', 'pgxfvjmuubtbowutlide', 'https://pgxfvjmuubtbowutlide.supabase.co', 'clientes', '#4D96FF', '📊', '57K empresas, 52K clientes, SINGU, RFM, vendas', 'connected', 100, 524000, '00000000-0000-0000-0000-000000000000'),
  ('supabase-fuchsia-kite', 'Catálogo de Produtos', 'doufsxqlfjyuvxuezpln', 'https://doufsxqlfjyuvxuezpln.supabase.co', 'produtos', '#6BCB77', '📦', '6K produtos, 16K variantes, 46K imagens, kits', 'connected', 115, 380000, '00000000-0000-0000-0000-000000000000'),
  ('backupgiftstore', 'WhatsApp & Atendimento', 'rhqfnvvjdwvnulxybmrk', 'https://rhqfnvvjdwvnulxybmrk.supabase.co', 'atendimento', '#FF6B6B', '📱', '8K mensagens, 783 contatos, filas, SLA', 'connected', 79, 9200, '00000000-0000-0000-0000-000000000000'),
  ('gestao_time_promo', 'RH & Colaboradores', 'hncgwjbzdajfdztqgefe', 'https://hncgwjbzdajfdztqgefe.supabase.co', 'rh', '#9B59B6', '👥', '53 colaboradores, ponto eletrônico, férias', 'connected', 36, 6000, '00000000-0000-0000-0000-000000000000'),
  ('financeiro_promo', 'Financeiro', 'xyykivpcdbfukaongpbw', 'https://xyykivpcdbfukaongpbw.supabase.co', 'financeiro', '#FFD93D', '💰', 'Contas a pagar/receber, fluxo de caixa', 'hibernated', 0, 0, '00000000-0000-0000-0000-000000000000')
ON CONFLICT DO NOTHING;
