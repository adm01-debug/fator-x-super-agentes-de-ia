-- ═══════════════════════════════════════════════════════════════
-- Nexus Agents Studio — RAG Hybrid Search Infrastructure
-- ETAPA 13: Vector + BM25 + Graph with RRF fusion
-- Reference: RAGFlow, Microsoft GraphRAG, LightRAG
-- ═══════════════════════════════════════════════════════════════

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Add parent-child chunking support
ALTER TABLE public.chunks
  ADD COLUMN IF NOT EXISTS parent_chunk_id UUID REFERENCES public.chunks(id),
  ADD COLUMN IF NOT EXISTS chunk_level TEXT DEFAULT 'child',  -- 'parent' or 'child'
  ADD COLUMN IF NOT EXISTS token_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS embedding vector(1024),
  ADD COLUMN IF NOT EXISTS bm25_tsvector tsvector;

-- Create GIN index for BM25 full-text search
CREATE INDEX IF NOT EXISTS idx_chunks_bm25 ON public.chunks USING GIN(bm25_tsvector);

-- Create HNSW index for vector search (pgvector)
CREATE INDEX IF NOT EXISTS idx_chunks_embedding ON public.chunks
  USING hnsw(embedding vector_cosine_ops) WITH (m = 16, ef_construction = 200);

-- Index for parent-child relationships
CREATE INDEX IF NOT EXISTS idx_chunks_parent ON public.chunks(parent_chunk_id);
CREATE INDEX IF NOT EXISTS idx_chunks_level ON public.chunks(chunk_level);

-- Auto-generate tsvector on insert/update
CREATE OR REPLACE FUNCTION public.chunks_update_bm25()
RETURNS TRIGGER AS $$
BEGIN
  NEW.bm25_tsvector := to_tsvector('portuguese', COALESCE(NEW.content, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chunks_bm25 ON public.chunks;
CREATE TRIGGER trg_chunks_bm25
  BEFORE INSERT OR UPDATE OF content ON public.chunks
  FOR EACH ROW EXECUTE FUNCTION public.chunks_update_bm25();

-- Hybrid search function with RRF (Reciprocal Rank Fusion)
CREATE OR REPLACE FUNCTION public.hybrid_search(
  p_query_embedding vector(1024),
  p_query_text TEXT,
  p_collection_ids UUID[] DEFAULT NULL,
  p_top_k INTEGER DEFAULT 10,
  p_rrf_k INTEGER DEFAULT 60
) RETURNS TABLE(
  chunk_id UUID,
  content TEXT,
  document_id UUID,
  collection_id UUID,
  parent_chunk_id UUID,
  vector_score FLOAT,
  bm25_score FLOAT,
  rrf_score FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  WITH
  -- Vector search (semantic)
  vector_results AS (
    SELECT c.id, c.content, c.document_id, c.collection_id, c.parent_chunk_id, c.metadata,
           1 - (c.embedding <=> p_query_embedding) AS score,
           ROW_NUMBER() OVER (ORDER BY c.embedding <=> p_query_embedding) AS rank
    FROM public.chunks c
    WHERE c.embedding IS NOT NULL
      AND c.chunk_level = 'child'
      AND (p_collection_ids IS NULL OR c.collection_id = ANY(p_collection_ids))
    ORDER BY c.embedding <=> p_query_embedding
    LIMIT p_top_k * 3
  ),
  -- BM25 search (keyword)
  bm25_results AS (
    SELECT c.id, c.content, c.document_id, c.collection_id, c.parent_chunk_id, c.metadata,
           ts_rank_cd(c.bm25_tsvector, plainto_tsquery('portuguese', p_query_text)) AS score,
           ROW_NUMBER() OVER (ORDER BY ts_rank_cd(c.bm25_tsvector, plainto_tsquery('portuguese', p_query_text)) DESC) AS rank
    FROM public.chunks c
    WHERE c.bm25_tsvector @@ plainto_tsquery('portuguese', p_query_text)
      AND c.chunk_level = 'child'
      AND (p_collection_ids IS NULL OR c.collection_id = ANY(p_collection_ids))
    ORDER BY score DESC
    LIMIT p_top_k * 3
  ),
  -- RRF fusion
  fused AS (
    SELECT
      COALESCE(v.id, b.id) AS id,
      COALESCE(v.content, b.content) AS content,
      COALESCE(v.document_id, b.document_id) AS document_id,
      COALESCE(v.collection_id, b.collection_id) AS collection_id,
      COALESCE(v.parent_chunk_id, b.parent_chunk_id) AS parent_chunk_id,
      COALESCE(v.metadata, b.metadata) AS metadata,
      COALESCE(v.score, 0) AS v_score,
      COALESCE(b.score, 0) AS b_score,
      COALESCE(1.0 / (p_rrf_k + v.rank), 0) + COALESCE(1.0 / (p_rrf_k + b.rank), 0) AS rrf
    FROM vector_results v
    FULL OUTER JOIN bm25_results b ON v.id = b.id
  )
  SELECT
    f.id AS chunk_id,
    f.content,
    f.document_id,
    f.collection_id,
    f.parent_chunk_id,
    f.v_score AS vector_score,
    f.b_score AS bm25_score,
    f.rrf AS rrf_score,
    f.metadata
  FROM fused f
  ORDER BY f.rrf DESC
  LIMIT p_top_k;
END;
$$ LANGUAGE plpgsql;
