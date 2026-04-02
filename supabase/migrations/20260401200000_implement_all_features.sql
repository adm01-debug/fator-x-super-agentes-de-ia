-- ═══════════════════════════════════════════════════════════
-- FATOR X — Migration: Implementação de todas as features pendentes
-- Data: 2026-04-01
-- ═══════════════════════════════════════════════════════════

-- ═══ 1. MEMÓRIA — Tabelas de persistência ═══
CREATE TABLE IF NOT EXISTS public.agent_memories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  memory_type TEXT NOT NULL CHECK (memory_type IN ('short_term','episodic','semantic','procedural','user_profile','team','external')),
  content TEXT NOT NULL,
  source TEXT DEFAULT 'manual',
  metadata JSONB DEFAULT '{}',
  relevance_score NUMERIC DEFAULT 1.0,
  access_count INTEGER DEFAULT 0,
  last_accessed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agent_memories_agent ON public.agent_memories(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_memories_type ON public.agent_memories(memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memories_workspace ON public.agent_memories(workspace_id);

-- ═══ 2. PGVECTOR — Embeddings para RAG e Memória Semântica ═══
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.chunks ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

ALTER TABLE public.agent_memories ADD COLUMN IF NOT EXISTS embedding vector(1536);
CREATE INDEX IF NOT EXISTS idx_memories_embedding ON public.agent_memories USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Semantic search function for RAG
CREATE OR REPLACE FUNCTION public.match_chunks(
  query_embedding vector(1536),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7,
  filter_kb_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  document_id UUID,
  content TEXT,
  chunk_index INT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.id,
    c.document_id,
    c.content,
    c.chunk_index,
    c.metadata,
    1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.chunks c
  JOIN public.documents d ON d.id = c.document_id
  JOIN public.collections col ON col.id = d.collection_id
  WHERE c.embedding IS NOT NULL
    AND c.embedding_status = 'done'
    AND (filter_kb_id IS NULL OR col.knowledge_base_id = filter_kb_id)
    AND 1 - (c.embedding <=> query_embedding) > match_threshold
  ORDER BY c.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Semantic search for memories
CREATE OR REPLACE FUNCTION public.match_memories(
  query_embedding vector(1536),
  p_agent_id UUID,
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.6
)
RETURNS TABLE (
  id UUID,
  memory_type TEXT,
  content TEXT,
  source TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.memory_type,
    m.content,
    m.source,
    1 - (m.embedding <=> query_embedding) AS similarity
  FROM public.agent_memories m
  WHERE m.agent_id = p_agent_id
    AND m.embedding IS NOT NULL
    AND (m.expires_at IS NULL OR m.expires_at > now())
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- ═══ 3. COST MODEL — Tabela de preços por modelo ═══
CREATE TABLE IF NOT EXISTS public.model_pricing (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  model_pattern TEXT NOT NULL UNIQUE,
  input_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  output_cost_per_1k NUMERIC NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.model_pricing (model_pattern, input_cost_per_1k, output_cost_per_1k) VALUES
  ('claude-opus-4', 0.015, 0.075),
  ('claude-sonnet-4', 0.003, 0.015),
  ('claude-haiku-4', 0.0008, 0.004),
  ('gpt-4o', 0.005, 0.015),
  ('gpt-4o-mini', 0.00015, 0.0006),
  ('gemini-2.5-pro', 0.00125, 0.005),
  ('gemini-2.5-flash', 0.000075, 0.0003),
  ('llama-4', 0.0002, 0.0008)
ON CONFLICT (model_pattern) DO NOTHING;

-- ═══ 4. WORKFLOW RUNS — Execução real de workflows ═══
CREATE TABLE IF NOT EXISTS public.workflow_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES public.workflows(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'running' CHECK (status IN ('running','completed','failed','cancelled','timeout')),
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  error TEXT,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  total_tokens INTEGER DEFAULT 0,
  total_cost_usd NUMERIC DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.workflow_step_runs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_run_id UUID REFERENCES public.workflow_runs(id) ON DELETE CASCADE,
  workflow_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  step_order INTEGER NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','running','completed','failed','skipped')),
  input JSONB DEFAULT '{}',
  output JSONB DEFAULT '{}',
  error TEXT,
  tokens_used INTEGER DEFAULT 0,
  cost_usd NUMERIC DEFAULT 0,
  latency_ms INTEGER DEFAULT 0,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

-- ═══ 5. DEPLOY CHANNEL CONNECTIONS — Estado real dos canais ═══
CREATE TABLE IF NOT EXISTS public.deploy_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('api','whatsapp','web_chat','slack','email','bitrix24','telegram','discord')),
  status TEXT DEFAULT 'inactive' CHECK (status IN ('active','inactive','error','configuring')),
  config JSONB DEFAULT '{}',
  webhook_url TEXT,
  last_message_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id, channel)
);

-- ═══ 6. ALERT RULES — Regras de alerta automáticas ═══
CREATE TABLE IF NOT EXISTS public.alert_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  metric TEXT NOT NULL,
  operator TEXT NOT NULL CHECK (operator IN ('>','<','>=','<=','==')),
  threshold NUMERIC NOT NULL,
  severity TEXT DEFAULT 'warning' CHECK (severity IN ('info','warning','critical')),
  cooldown_minutes INTEGER DEFAULT 60,
  is_enabled BOOLEAN DEFAULT true,
  last_triggered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ 7. PROMPT A/B TESTS ═══
CREATE TABLE IF NOT EXISTS public.prompt_ab_tests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID REFERENCES public.agents(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  variant_a_prompt_id UUID REFERENCES public.prompt_versions(id),
  variant_b_prompt_id UUID REFERENCES public.prompt_versions(id),
  traffic_split NUMERIC DEFAULT 0.5,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','running','completed','cancelled')),
  winner TEXT,
  metrics JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ═══ 8. UPDATE agent_traces — add missing columns ═══
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS user_input TEXT;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS assistant_output TEXT;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS model TEXT;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS cost_usd NUMERIC DEFAULT 0;
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS guardrails_triggered JSONB DEFAULT '[]';
ALTER TABLE public.agent_traces ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- ═══ 9. FUNCTION — Auto-update budget current_usd ═══
CREATE OR REPLACE FUNCTION public.update_budget_on_usage()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.budgets
  SET current_usd = current_usd + NEW.cost_usd,
      updated_at = now()
  WHERE workspace_id = NEW.workspace_id
    AND is_active = true
    AND period = 'monthly';
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_usage_update_budget ON public.usage_records;
CREATE TRIGGER trg_usage_update_budget
  AFTER INSERT ON public.usage_records
  FOR EACH ROW EXECUTE FUNCTION public.update_budget_on_usage();

-- ═══ 10. FUNCTION — Auto-create alert on budget threshold ═══
CREATE OR REPLACE FUNCTION public.check_budget_alert()
RETURNS TRIGGER AS $$
DECLARE
  budget_rec RECORD;
BEGIN
  FOR budget_rec IN
    SELECT * FROM public.budgets
    WHERE workspace_id = NEW.workspace_id
      AND is_active = true
      AND current_usd >= (limit_usd * alert_threshold)
  LOOP
    INSERT INTO public.alerts (workspace_id, severity, title, message)
    VALUES (
      NEW.workspace_id,
      CASE WHEN budget_rec.current_usd >= budget_rec.limit_usd THEN 'critical' ELSE 'warning' END,
      CASE WHEN budget_rec.current_usd >= budget_rec.limit_usd
        THEN 'Budget "' || budget_rec.name || '" estourado!'
        ELSE 'Budget "' || budget_rec.name || '" atingiu ' || ROUND((budget_rec.current_usd / budget_rec.limit_usd * 100)::numeric, 1) || '%'
      END,
      'Gasto atual: $' || ROUND(budget_rec.current_usd::numeric, 4) || ' / Limite: $' || ROUND(budget_rec.limit_usd::numeric, 2)
    )
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_budget_alert ON public.budgets;
CREATE TRIGGER trg_budget_alert
  AFTER UPDATE OF current_usd ON public.budgets
  FOR EACH ROW EXECUTE FUNCTION public.check_budget_alert();

-- ═══ RLS for all new tables ═══
ALTER TABLE public.agent_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deploy_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prompt_ab_tests ENABLE ROW LEVEL SECURITY;

-- model_pricing is read-only for all authenticated users
CREATE POLICY "pricing_read" ON public.model_pricing FOR SELECT TO authenticated USING (true);

-- workspace-scoped policies
CREATE POLICY "memories_all" ON public.agent_memories FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "workflow_runs_all" ON public.workflow_runs FOR ALL TO authenticated
  USING (workflow_id IN (SELECT w.id FROM public.workflows w WHERE w.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())))
  WITH CHECK (workflow_id IN (SELECT w.id FROM public.workflows w WHERE w.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid())));

CREATE POLICY "step_runs_all" ON public.workflow_step_runs FOR ALL TO authenticated
  USING (workflow_run_id IN (SELECT wr.id FROM public.workflow_runs wr WHERE wr.workflow_id IN (SELECT w.id FROM public.workflows w WHERE w.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))))
  WITH CHECK (workflow_run_id IN (SELECT wr.id FROM public.workflow_runs wr WHERE wr.workflow_id IN (SELECT w.id FROM public.workflows w WHERE w.workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))));

CREATE POLICY "deploy_connections_all" ON public.deploy_connections FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "alert_rules_all" ON public.alert_rules FOR ALL TO authenticated
  USING (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()))
  WITH CHECK (workspace_id IN (SELECT wm.workspace_id FROM public.workspace_members wm WHERE wm.user_id = auth.uid()));

CREATE POLICY "ab_tests_all" ON public.prompt_ab_tests FOR ALL TO authenticated
  USING (agent_id IN (SELECT a.id FROM public.agents a WHERE a.user_id = auth.uid()))
  WITH CHECK (agent_id IN (SELECT a.id FROM public.agents a WHERE a.user_id = auth.uid()));
