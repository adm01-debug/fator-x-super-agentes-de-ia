-- ═══ ETAPA 5: Hybrid Search (BM25 + Semantic) ═══

-- Add tsvector column for BM25 full-text search
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Auto-populate tsvector on insert/update
CREATE OR REPLACE FUNCTION public.chunks_search_vector_trigger()
RETURNS TRIGGER AS $$
BEGIN
  NEW.search_vector := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_search_vector ON public.chunks;
CREATE TRIGGER trg_chunks_search_vector
  BEFORE INSERT OR UPDATE OF content ON public.chunks
  FOR EACH ROW EXECUTE FUNCTION public.chunks_search_vector_trigger();

-- Backfill existing chunks
UPDATE public.chunks SET search_vector = to_tsvector('portuguese', COALESCE(content, '')) WHERE search_vector IS NULL;

-- GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_search_vector ON public.chunks USING GIN (search_vector);

-- Hybrid Search function: combines BM25 (full-text) + semantic (pgvector) with RRF
CREATE OR REPLACE FUNCTION public.hybrid_search(
  query_text TEXT,
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  bm25_weight FLOAT DEFAULT 0.3,
  semantic_weight FLOAT DEFAULT 0.7,
  filter_kb_id UUID DEFAULT NULL
)
RETURNS TABLE (
  chunk_id UUID,
  content TEXT,
  document_id UUID,
  bm25_rank FLOAT,
  semantic_rank FLOAT,
  rrf_score FLOAT,
  metadata JSONB
) AS $$
DECLARE
  k CONSTANT INT := 60; -- RRF constant
  fetch_count INT := match_count * 5; -- Over-fetch for better fusion
BEGIN
  RETURN QUERY
  WITH
  -- BM25 full-text search
  bm25_results AS (
    SELECT c.id, c.content, c.document_id, c.metadata,
      ts_rank_cd(c.search_vector, plainto_tsquery('portuguese', query_text)) AS rank,
      ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.search_vector, plainto_tsquery('portuguese', query_text)) DESC) AS rn
    FROM public.chunks c
    JOIN public.documents d ON c.document_id = d.id
    JOIN public.collections col ON d.collection_id = col.id
    WHERE c.search_vector @@ plainto_tsquery('portuguese', query_text)
      AND c.embedding_status = 'done'
      AND (filter_kb_id IS NULL OR col.knowledge_base_id = filter_kb_id)
    ORDER BY rank DESC
    LIMIT fetch_count
  ),
  -- Semantic vector search
  semantic_results AS (
    SELECT c.id, c.content, c.document_id, c.metadata,
      1 - (c.embedding <=> query_embedding) AS rank,
      ROW_NUMBER() OVER (ORDER BY c.embedding <=> query_embedding) AS rn
    FROM public.chunks c
    JOIN public.documents d ON c.document_id = d.id
    JOIN public.collections col ON d.collection_id = col.id
    WHERE c.embedding IS NOT NULL
      AND c.embedding_status = 'done'
      AND (filter_kb_id IS NULL OR col.knowledge_base_id = filter_kb_id)
    ORDER BY c.embedding <=> query_embedding
    LIMIT fetch_count
  ),
  -- Reciprocal Rank Fusion
  combined AS (
    SELECT
      COALESCE(b.id, s.id) AS id,
      COALESCE(b.content, s.content) AS content,
      COALESCE(b.document_id, s.document_id) AS document_id,
      COALESCE(b.metadata, s.metadata) AS metadata,
      COALESCE(b.rank, 0) AS bm25_r,
      COALESCE(s.rank, 0) AS sem_r,
      bm25_weight * (1.0 / (k + COALESCE(b.rn, fetch_count))) +
      semantic_weight * (1.0 / (k + COALESCE(s.rn, fetch_count))) AS score
    FROM bm25_results b
    FULL OUTER JOIN semantic_results s ON b.id = s.id
  )
  SELECT c.id, c.content, c.document_id, c.bm25_r, c.sem_r, c.score, c.metadata
  FROM combined c
  ORDER BY c.score DESC
  LIMIT match_count;
END;
$$ LANGUAGE plpgsql;

-- ═══ ETAPA 7: Contextual Chunking ═══
ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS context_prefix TEXT;
ALTER TABLE public.knowledge_bases ADD COLUMN IF NOT EXISTS contextual_chunking_enabled BOOLEAN DEFAULT false;

-- ═══ ETAPA 9: PII Detection ═══
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS pii_detected JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS injection_detected BOOLEAN DEFAULT false;
ALTER TABLE public.workspaces ADD COLUMN IF NOT EXISTS pii_redaction_enabled BOOLEAN DEFAULT true;

-- ═══ ETAPA 11: LGPD Compliance ═══
CREATE TABLE IF NOT EXISTS public.consent_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL, -- 'ai_processing', 'data_storage', 'analytics'
  legal_basis TEXT NOT NULL, -- 'consent', 'legitimate_interest', 'contract', 'legal_obligation'
  granted BOOLEAN NOT NULL DEFAULT false,
  granted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  scope TEXT NOT NULL DEFAULT 'all', -- 'all', 'traces', 'sessions', 'memories'
  requested_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  items_deleted INT DEFAULT 0,
  error TEXT
);

-- ═══ ETAPA 12: Audit Trail Imutável ═══
-- Drop existing if needed, recreate as append-only
CREATE TABLE IF NOT EXISTS public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL, -- 'agent.created', 'secret.rotated', 'budget.exceeded', etc.
  resource_type TEXT, -- 'agent', 'workspace_secret', 'budget', 'prompt_version'
  resource_id TEXT,
  old_value JSONB,
  new_value JSONB,
  ip_address TEXT,
  prev_hash TEXT, -- hash chain for tamper detection
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Make audit_log append-only via RLS
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Audit log read only for workspace" ON public.audit_log;
CREATE POLICY "Audit log read only for workspace" ON public.audit_log FOR SELECT TO authenticated
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "Audit log insert for authenticated" ON public.audit_log;
CREATE POLICY "Audit log insert for authenticated" ON public.audit_log FOR INSERT TO authenticated
  WITH CHECK (true);
-- No UPDATE or DELETE policies = append-only

-- Auto-audit trigger for sensitive tables
CREATE OR REPLACE FUNCTION public.audit_trigger_fn()
RETURNS TRIGGER AS $$
DECLARE
  ws_id UUID;
BEGIN
  -- Try to get workspace_id from the row
  IF TG_OP = 'DELETE' THEN
    ws_id := COALESCE((OLD::jsonb)->>'workspace_id', NULL)::UUID;
  ELSE
    ws_id := COALESCE((NEW::jsonb)->>'workspace_id', NULL)::UUID;
  END IF;
  
  INSERT INTO public.audit_log (workspace_id, user_id, action, resource_type, resource_id, old_value, new_value)
  VALUES (
    ws_id, auth.uid(),
    TG_OP || '.' || TG_TABLE_NAME,
    TG_TABLE_NAME,
    CASE TG_OP WHEN 'DELETE' THEN (OLD::jsonb)->>'id' ELSE (NEW::jsonb)->>'id' END,
    CASE TG_OP WHEN 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
    CASE TG_OP WHEN 'DELETE' THEN NULL ELSE to_jsonb(NEW) END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach audit triggers to sensitive tables
DO $$ 
DECLARE
  tbl TEXT;
BEGIN
  FOR tbl IN SELECT unnest(ARRAY['agents', 'workspace_secrets', 'budgets', 'guardrail_policies', 'deploy_connections']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_audit_%s ON public.%I', tbl, tbl);
    EXECUTE format('CREATE TRIGGER trg_audit_%s AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.audit_trigger_fn()', tbl, tbl);
  END LOOP;
END $$;

-- ═══ ETAPA 13: LLM-as-Judge ═══
ALTER TABLE public.evaluation_runs ADD COLUMN IF NOT EXISTS judge_model TEXT DEFAULT 'claude-haiku-4-5-20251001';
ALTER TABLE public.evaluation_runs ADD COLUMN IF NOT EXISTS judge_scores JSONB DEFAULT '{}'::jsonb;

-- ═══ ETAPA 14: Hallucination Detection ═══
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS faithfulness_score FLOAT;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS unsupported_claims JSONB;

-- ═══ ETAPA 15: Latency Breakdown ═══
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS latency_breakdown JSONB; -- {retrieval_ms, guardrail_ms, llm_ms, total_ms, ttft_ms}
ALTER TABLE public.usage_records ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '{}'::jsonb; -- {feature, department, conversation_id}

-- ═══ ETAPA 18: Agent Versioning ═══
CREATE TABLE IF NOT EXISTS public.agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  version INT NOT NULL,
  config JSONB NOT NULL,
  system_prompt TEXT,
  model TEXT,
  created_by UUID REFERENCES auth.users(id),
  change_summary TEXT,
  environment TEXT DEFAULT 'development', -- 'development', 'staging', 'production'
  promoted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, version)
);

ALTER TABLE public.agent_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Agent versions readable by workspace" ON public.agent_versions FOR SELECT TO authenticated
  USING (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));
CREATE POLICY "Agent versions insertable by owner" ON public.agent_versions FOR INSERT TO authenticated
  WITH CHECK (agent_id IN (SELECT id FROM public.agents WHERE user_id = auth.uid()));

-- RLS for new tables
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Consent readable by user" ON public.consent_records FOR ALL TO authenticated USING (user_id = auth.uid());

ALTER TABLE public.data_deletion_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Deletion requests by user" ON public.data_deletion_requests FOR ALL TO authenticated USING (user_id = auth.uid());
