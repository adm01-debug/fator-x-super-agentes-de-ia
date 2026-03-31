-- ═══ SUPER CÉREBRO — Enterprise Memory Layer ═══

CREATE TABLE IF NOT EXISTS public.brain_collections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  domain TEXT NOT NULL,
  description TEXT DEFAULT '',
  doc_count INTEGER DEFAULT 0,
  chunk_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','syncing','synced','error')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brain_facts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  content TEXT NOT NULL,
  domain TEXT NOT NULL,
  confidence NUMERIC(5,2) DEFAULT 0,
  source TEXT DEFAULT 'manual',
  validated BOOLEAN DEFAULT false,
  validated_by UUID,
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  superseded_by UUID REFERENCES public.brain_facts(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brain_entities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  name TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  domain TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brain_relationships (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_entity_id UUID REFERENCES public.brain_entities(id) ON DELETE CASCADE,
  target_entity_id UUID REFERENCES public.brain_entities(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL,
  properties JSONB DEFAULT '{}',
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brain_decay_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fact_id UUID REFERENCES public.brain_facts(id) ON DELETE CASCADE,
  alert_type TEXT CHECK (alert_type IN ('aging','contradiction','unused','gap')),
  severity TEXT CHECK (severity IN ('low','medium','high','critical')),
  description TEXT,
  resolved BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.brain_sandbox_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  queries JSONB NOT NULL DEFAULT '[]',
  results JSONB DEFAULT '[]',
  avg_score NUMERIC(5,2),
  avg_latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══ ORÁCULO — Multi-LLM Council ═══

CREATE TABLE IF NOT EXISTS public.oracle_configs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  gateway TEXT DEFAULT 'openrouter' CHECK (gateway IN ('openrouter','direct','hybrid')),
  chairman_model TEXT DEFAULT 'claude-sonnet-4.6',
  auto_classify BOOLEAN DEFAULT true,
  max_models INTEGER DEFAULT 5,
  timeout_seconds INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oracle_presets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID,
  name TEXT NOT NULL,
  icon TEXT DEFAULT '⚡',
  description TEXT DEFAULT '',
  models TEXT[] NOT NULL DEFAULT '{}',
  mode TEXT DEFAULT 'council' CHECK (mode IN ('council','debate','research','validator','executor','advisor')),
  stages INTEGER DEFAULT 4,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oracle_queries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL,
  user_id UUID,
  query TEXT NOT NULL,
  preset_id UUID REFERENCES public.oracle_presets(id),
  consensus_score NUMERIC(5,2),
  total_cost NUMERIC(10,4),
  total_latency_ms INTEGER,
  models_used TEXT[] DEFAULT '{}',
  final_response TEXT,
  consensus_matrix JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.oracle_member_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  query_id UUID REFERENCES public.oracle_queries(id) ON DELETE CASCADE,
  model TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER,
  latency_ms INTEGER,
  cost NUMERIC(10,6),
  peer_review_score NUMERIC(5,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE public.brain_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_facts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_decay_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.brain_sandbox_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_presets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_member_responses ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_brain_facts_domain ON public.brain_facts(domain);
CREATE INDEX IF NOT EXISTS idx_brain_facts_confidence ON public.brain_facts(confidence DESC);
CREATE INDEX IF NOT EXISTS idx_brain_entities_type ON public.brain_entities(entity_type);
CREATE INDEX IF NOT EXISTS idx_oracle_queries_ws ON public.oracle_queries(workspace_id, created_at DESC);

-- Seed: System presets do Oráculo
INSERT INTO public.oracle_presets (name, icon, description, models, mode, stages, is_system, workspace_id)
VALUES
  ('Executivo', '👔', '4 frontier models + peer review', ARRAY['claude-opus-4.6','gpt-4o','gemini-2.5-pro','claude-sonnet-4.6'], 'council', 4, true, NULL),
  ('Rápido', '⚡', '3 modelos leves em paralelo', ARRAY['claude-haiku-4.5','gpt-4o-mini','gemini-flash'], 'council', 2, true, NULL),
  ('Pesquisa Profunda', '🔬', '5 modelos × 3 camadas MoA', ARRAY['claude-opus-4.6','gpt-4o','gemini-2.5-pro','claude-sonnet-4.6','llama-4'], 'research', 4, true, NULL),
  ('Debate', '⚔️', '2 modelos × 3 rounds + juiz', ARRAY['claude-opus-4.6','gpt-4o'], 'debate', 3, true, NULL),
  ('Técnico', '🔧', '4 especializados em código', ARRAY['claude-sonnet-4.6','gpt-4o','gemini-2.5-pro','codestral'], 'council', 3, true, NULL),
  ('Verificação', '✅', '3 modelos com search', ARRAY['claude-sonnet-4.6','gpt-4o','gemini-2.5-pro'], 'validator', 2, true, NULL)
ON CONFLICT DO NOTHING;
