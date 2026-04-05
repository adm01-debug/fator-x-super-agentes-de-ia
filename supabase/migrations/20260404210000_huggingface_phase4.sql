-- ═══════════════════════════════════════════════════════════
-- FATOR X — Migration: HuggingFace Phase 4 (Fine-tuning + Workflow upgrades)
-- Data: 2026-04-04
-- ═══════════════════════════════════════════════════════════

-- ═══ 1. Fine-tuning Jobs — Track AutoTrain training jobs ═══
CREATE TABLE IF NOT EXISTS public.finetune_jobs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  
  -- HuggingFace info
  hf_repo_id TEXT NOT NULL,
  hf_model_url TEXT,
  base_model TEXT NOT NULL,
  
  -- Training config
  task TEXT NOT NULL CHECK (task IN ('text-generation', 'text-classification', 'embedding', 'reranking')),
  config JSONB DEFAULT '{}',
  
  -- Dataset info
  dataset_size INTEGER DEFAULT 0,
  dataset_format TEXT DEFAULT 'alpaca',
  
  -- Status tracking
  status TEXT DEFAULT 'preparing' CHECK (status IN ('preparing', 'uploading', 'training', 'completed', 'failed', 'cancelled')),
  error TEXT,
  
  -- Result
  result_model_id TEXT, -- huggingface/user/model-name for use in LLM Gateway
  metrics JSONB DEFAULT '{}', -- training metrics (loss, eval scores, etc.)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_finetune_jobs_workspace ON public.finetune_jobs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_finetune_jobs_agent ON public.finetune_jobs(agent_id);
CREATE INDEX IF NOT EXISTS idx_finetune_jobs_status ON public.finetune_jobs(status);

-- RLS
ALTER TABLE public.finetune_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view finetune jobs in their workspace" ON public.finetune_jobs
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can create finetune jobs in their workspace" ON public.finetune_jobs
  FOR INSERT WITH CHECK (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can update finetune jobs they created" ON public.finetune_jobs
  FOR UPDATE USING (user_id = auth.uid());

-- ═══ 2. HF Integration Config — Store per-workspace HF settings ═══
CREATE TABLE IF NOT EXISTS public.hf_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE UNIQUE,
  
  -- Feature toggles (override env vars per workspace)
  enable_ml_injection BOOLEAN DEFAULT true,
  enable_hf_reranker BOOLEAN DEFAULT true,
  enable_hf_embeddings BOOLEAN DEFAULT true,
  enable_auto_classify BOOLEAN DEFAULT true,
  
  -- Self-hosted TEI endpoints (optional)
  tei_embeddings_endpoint TEXT,
  tei_rerank_endpoint TEXT,
  
  -- Preferred models (override defaults)
  preferred_embedding_model TEXT DEFAULT 'BAAI/bge-m3',
  preferred_reranker_model TEXT DEFAULT 'BAAI/bge-reranker-v2-m3',
  preferred_injection_model TEXT DEFAULT 'protectai/deberta-v3-base-prompt-injection-v2',
  preferred_classify_model TEXT DEFAULT 'joeddav/xlm-roberta-large-xnli',
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.hf_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view HF config for their workspace" ON public.hf_config
  FOR SELECT USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Admins can manage HF config" ON public.hf_config
  FOR ALL USING (
    workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid() AND role = 'admin')
  );
