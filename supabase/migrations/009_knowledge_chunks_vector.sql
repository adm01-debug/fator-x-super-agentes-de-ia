-- Enable pgvector extension (idempotent)
CREATE EXTENSION IF NOT EXISTS vector;

-- Knowledge base chunks with pgvector embeddings
CREATE TABLE IF NOT EXISTS public.knowledge_base_chunks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kb_id UUID REFERENCES public.knowledge_bases(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB DEFAULT '{}',
  workspace_id UUID REFERENCES public.workspaces(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kb_chunks_embedding ON public.knowledge_base_chunks USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_kb_chunks_kb ON public.knowledge_base_chunks(kb_id);

ALTER TABLE public.knowledge_base_chunks ENABLE ROW LEVEL SECURITY;

-- RLS policy: workspace members can access chunks in their workspace
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE policyname = 'kb_chunks_workspace' AND tablename = 'knowledge_base_chunks'
  ) THEN
    CREATE POLICY "kb_chunks_workspace" ON public.knowledge_base_chunks FOR ALL USING (
      workspace_id IN (SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid())
    );
  END IF;
END
$$;
