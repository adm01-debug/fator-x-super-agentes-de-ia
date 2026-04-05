-- ═══════════════════════════════════════════════════════════════
-- Agent Self-Evolution + Skills Registry + Context Tiers
-- ═══════════════════════════════════════════════════════════════

-- Agent Skills (learned from experience)
CREATE TABLE IF NOT EXISTS public.agent_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  skill_name TEXT NOT NULL,
  description TEXT,
  pattern TEXT NOT NULL,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  confidence NUMERIC(3,2) DEFAULT 0.5,
  source_trace_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, skill_name)
);
CREATE INDEX IF NOT EXISTS idx_agent_skills_agent ON public.agent_skills(agent_id, confidence DESC);
ALTER TABLE public.agent_skills ENABLE ROW LEVEL SECURITY;

-- Skills Registry (marketplace)
CREATE TABLE IF NOT EXISTS public.skill_registry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  version TEXT DEFAULT '1.0.0',
  author TEXT,
  category TEXT NOT NULL DEFAULT 'tools',
  tags TEXT[] DEFAULT '{}',
  install_count INTEGER DEFAULT 0,
  rating NUMERIC(3,2) DEFAULT 0,
  skill_config JSONB DEFAULT '{}',
  mcp_server_url TEXT,
  is_verified BOOLEAN DEFAULT false,
  is_public BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_skill_registry_category ON public.skill_registry(category);
CREATE INDEX IF NOT EXISTS idx_skill_registry_public ON public.skill_registry(is_public, install_count DESC);
ALTER TABLE public.skill_registry ENABLE ROW LEVEL SECURITY;

-- Installed Skills (many-to-many)
CREATE TABLE IF NOT EXISTS public.agent_installed_skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL,
  skill_id UUID NOT NULL REFERENCES public.skill_registry(id) ON DELETE CASCADE,
  installed_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, skill_id)
);
ALTER TABLE public.agent_installed_skills ENABLE ROW LEVEL SECURITY;

-- Context Tiers: Add L0/L1 columns to chunks
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS l0_abstract TEXT;
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS l1_overview TEXT;

-- RPC: Search context L0 (fast relevance scan)
CREATE OR REPLACE FUNCTION public.search_context_l0(
  p_query TEXT,
  p_collection_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE(
  chunk_id UUID,
  document_id UUID,
  collection_id UUID,
  l0_abstract TEXT,
  l1_overview TEXT,
  l2_content TEXT,
  token_count INTEGER,
  relevance_score FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id AS chunk_id,
    c.document_id,
    c.collection_id,
    COALESCE(c.l0_abstract, LEFT(c.content, 200)) AS l0_abstract,
    COALESCE(c.l1_overview, LEFT(c.content, 2000)) AS l1_overview,
    '' AS l2_content,
    COALESCE(c.token_count, 0) AS token_count,
    ts_rank(c.bm25_tsvector, plainto_tsquery('portuguese', p_query))::FLOAT AS relevance_score
  FROM public.chunks c
  WHERE (p_collection_id IS NULL OR c.collection_id = p_collection_id)
    AND c.bm25_tsvector @@ plainto_tsquery('portuguese', p_query)
  ORDER BY relevance_score DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Increment skill counter
CREATE OR REPLACE FUNCTION public.increment_skill_installs(p_skill_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.skill_registry SET install_count = install_count + 1 WHERE id = p_skill_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
