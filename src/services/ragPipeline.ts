/**
 * RAG Pipeline Service — Document ingestion, chunking, embedding, retrieval
 * Connects KnowledgePage UI to actual document processing.
 * Persists chunks to Supabase knowledge_base_chunks with pgvector embeddings.
 */
import { logger } from '@/lib/logger';
import * as llm from './llmService';
import { supabase } from '@/integrations/supabase/client';
import { generateEmbedding, cosineSimilarity } from './vectorSearch';

// ═══ TYPES ═══

export interface RagDocument {
  id: string;
  filename: string;
  content: string;
  mimeType: string;
  sizeBytes: number;
  ingestedAt: string;
}

export interface RagChunk {
  id: string;
  documentId: string;
  content: string;
  index: number;
  tokenCount: number;
  metadata: Record<string, string>;
}

export interface RagConfig {
  chunkSize: number;
  chunkOverlap: number;
  embeddingModel: string;
  vectorDb: string;
  topK: number;
  similarityThreshold: number;
  rerankerEnabled: boolean;
}

export interface RetrievalResult {
  chunks: { content: string; score: number; source: string; chunkIndex: number }[];
  totalFound: number;
  latencyMs: number;
}

const DEFAULT_CONFIG: RagConfig = {
  chunkSize: 512,
  chunkOverlap: 50,
  embeddingModel: 'text-embedding-3-small',
  vectorDb: 'pgvector',
  topK: 5,
  similarityThreshold: 0.7,
  rerankerEnabled: false,
};

// ═══ IN-MEMORY STORE ═══

const documents: RagDocument[] = [];
const chunks: RagChunk[] = [];
const MAX_DOCUMENTS = 200;
const MAX_CHUNKS = 5000;

// ═══ DOCUMENT PARSING ═══

/** Parse text content from a File object. */
export async function parseDocument(file: File): Promise<{ content: string; error?: string }> {
  try {
    if (file.type === 'text/plain' || file.type === 'text/markdown' || file.type === 'text/csv') {
      return { content: await file.text() };
    }
    if (file.type === 'application/json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      return { content: typeof parsed === 'string' ? parsed : JSON.stringify(parsed, null, 2) };
    }
    if (file.type === 'application/pdf') {
      // PDF: extract text content (basic approach — for real use, use pdf.js or server-side)
      const text = await file.text();
      // Try to extract readable text from PDF binary
      const readable = text.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      if (readable.length > 100) return { content: readable };
      return { content: `[PDF: ${file.name}] — Parsing requer processamento server-side para extração completa de texto.` };
    }
    // Fallback: read as text
    return { content: await file.text() };
  } catch (err) {
    return { content: '', error: err instanceof Error ? err.message : 'Erro ao processar arquivo' };
  }
}

// ═══ CHUNKING ═══

/** Split text into chunks with overlap. */
export function chunkText(text: string, config: Partial<RagConfig> = {}): RagChunk[] {
  // BUG 7 fix: sanitize chunk params to prevent infinite loop
  let chunkSize = Math.max(config.chunkSize ?? DEFAULT_CONFIG.chunkSize, 100);
  let overlap = config.chunkOverlap ?? DEFAULT_CONFIG.chunkOverlap;
  if (overlap >= chunkSize) overlap = Math.floor(chunkSize * 0.2); // Cap at 20%

  // Split by paragraphs first, then by sentences, then by fixed size
  const paragraphs = text.split(/\n\n+/).filter(p => p.trim().length > 0);
  const result: RagChunk[] = [];
  let currentChunk = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (currentChunk.length + para.length > chunkSize && currentChunk.length > 0) {
      result.push({
        id: `chunk-${Date.now()}-${chunkIndex}`,
        documentId: '',
        content: currentChunk.trim(),
        index: chunkIndex,
        tokenCount: Math.ceil(currentChunk.trim().split(/\s+/).length * 1.3),
        metadata: {},
      });
      chunkIndex++;
      // Overlap: keep last N chars
      const overlapChars = Math.floor(currentChunk.length * (overlap / 100));
      currentChunk = currentChunk.slice(-overlapChars) + '\n\n' + para;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + para;
    }
  }

  // Last chunk
  if (currentChunk.trim().length > 0) {
    result.push({
      id: `chunk-${Date.now()}-${chunkIndex}`,
      documentId: '',
      content: currentChunk.trim(),
      index: chunkIndex,
      tokenCount: Math.ceil(currentChunk.trim().split(/\s+/).length * 1.3),
      metadata: {},
    });
  }

  return result;
}

// ═══ INGESTION PIPELINE ═══

/** Full ingestion: parse → chunk → store. Returns chunk count. */
export async function ingestDocument(
  file: File,
  knowledgeBaseId: string,
  config: Partial<RagConfig> = {},
  onProgress?: (stage: string) => void
): Promise<{ documentId: string; chunks: number; error?: string }> {
  const startTime = Date.now();

  // Stage 1: Parse
  onProgress?.('📄 Parsing document...');
  const { content, error } = await parseDocument(file);
  if (error || !content) return { documentId: '', chunks: 0, error: error ?? 'Empty content' };

  // Stage 2: Create document record
  const doc: RagDocument = {
    id: `doc-${Date.now()}`,
    filename: file.name,
    content,
    mimeType: file.type,
    sizeBytes: file.size,
    ingestedAt: new Date().toISOString(),
  };
  documents.push(doc);
  if (documents.length > MAX_DOCUMENTS) documents.shift();

  // Stage 3: Chunk
  onProgress?.('✂️ Chunking text...');
  const docChunks = chunkText(content, config);
  docChunks.forEach(c => {
    c.documentId = doc.id;
    c.metadata = { knowledgeBaseId, filename: file.name };
  });

  // Stage 4: Store chunks (in-memory + Supabase persistence)
  onProgress?.(`💾 Storing ${docChunks.length} chunks...`);
  chunks.push(...docChunks);
  if (chunks.length > MAX_CHUNKS) chunks.splice(0, chunks.length - MAX_CHUNKS);

  // Stage 5: Persist to Supabase with embeddings (best-effort, non-blocking)
  onProgress?.(`🔢 Generating embeddings for ${docChunks.length} chunks...`);
  const persistErrors: string[] = [];
  for (const chunk of docChunks) {
    try {
      const { embedding } = await generateEmbedding(chunk.content);
      const { error } = await supabase
        .from('knowledge_base_chunks')
        .insert({
          kb_id: knowledgeBaseId,
          content: chunk.content,
          embedding: `[${embedding.join(',')}]`,
          metadata: { filename: file.name, chunkIndex: String(chunk.index), documentId: doc.id },
        });
      if (error) {
        persistErrors.push(error.message);
      }
    } catch (err) {
      persistErrors.push(err instanceof Error ? err.message : 'Unknown');
    }
  }

  if (persistErrors.length > 0) {
    logger.warn(`RAG persist: ${persistErrors.length}/${docChunks.length} chunks failed (table may not exist yet): ${persistErrors[0]}`, 'ragPipeline');
  } else {
    logger.info(`RAG persist: ${docChunks.length} chunks saved to Supabase`, 'ragPipeline');
  }

  const duration = Date.now() - startTime;
  logger.info(`RAG ingest: ${file.name} → ${docChunks.length} chunks (${duration}ms)`, 'ragPipeline');

  return { documentId: doc.id, chunks: docChunks.length };
}

// ═══ RETRIEVAL ═══

/** Retrieve relevant chunks for a query. Uses keyword matching + vector similarity + optional LLM reranking. */
export async function retrieve(
  query: string,
  knowledgeBaseId?: string,
  config: Partial<RagConfig> = {}
): Promise<RetrievalResult> {
  const startTime = Date.now();
  const topK = config.topK ?? DEFAULT_CONFIG.topK;
  const threshold = config.similarityThreshold ?? DEFAULT_CONFIG.similarityThreshold;

  // --- Strategy 1: Supabase persisted chunks with vector similarity ---
  try {
    const queryEmbedding = await generateEmbedding(query);
    let dbQuery = supabase
      .from('knowledge_base_chunks')
      .select('id, content, metadata, embedding');
    if (knowledgeBaseId) {
      dbQuery = dbQuery.eq('kb_id', knowledgeBaseId);
    }
    const { data: dbChunks, error } = await dbQuery.limit(topK * 5);

    if (!error && dbChunks && dbChunks.length > 0) {
      // Score by cosine similarity against query embedding
      const vectorScored = dbChunks
        .map((row: { id: string; content: string; metadata: Record<string, string> | null; embedding: string | number[] | null }) => {
          let sim = 0;
          if (row.embedding) {
            const embArr = typeof row.embedding === 'string'
              ? JSON.parse(row.embedding.replace(/^\[/, '[').replace(/\]$/, ']'))
              : row.embedding;
            sim = cosineSimilarity(queryEmbedding.embedding, embArr);
          }
          return { content: row.content, score: sim, source: (row.metadata as Record<string, string>)?.filename ?? 'supabase', chunkIndex: 0 };
        })
        .filter((s: { score: number }) => s.score >= threshold * 0.5)
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, topK);

      if (vectorScored.length > 0) {
        logger.info(`RAG retrieve (Supabase vector): ${vectorScored.length} results`, 'ragPipeline');
        return { chunks: vectorScored, totalFound: vectorScored.length, latencyMs: Date.now() - startTime };
      }
    }
  } catch (err) {
    logger.debug(`Supabase chunk retrieval failed (table may not exist): ${err instanceof Error ? err.message : ''}`, 'ragPipeline');
  }

  // --- Strategy 2: In-memory chunks with keyword scoring (fallback) ---
  let candidates = knowledgeBaseId
    ? chunks.filter(c => c.metadata.knowledgeBaseId === knowledgeBaseId)
    : chunks;

  if (candidates.length === 0) {
    return { chunks: [], totalFound: 0, latencyMs: Date.now() - startTime };
  }

  // Score by keyword overlap (BM25-like)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scored = candidates.map(chunk => {
    const text = chunk.content.toLowerCase();
    const matches = queryTerms.filter(t => text.includes(t)).length;
    const score = queryTerms.length > 0 ? matches / queryTerms.length : 0;
    return { chunk, score };
  })
    .filter(s => s.score >= threshold * 0.5) // Looser threshold for keyword matching
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  // Optional: LLM reranking
  if (config.rerankerEnabled && llm.isLLMConfigured() && scored.length > 1) {
    const reranked = await rerankWithLLM(query, scored.map(s => s.chunk.content));
    const result: RetrievalResult = {
      chunks: reranked.map((idx, rank) => ({
        content: scored[idx]?.chunk.content ?? '',
        score: 1 - rank * 0.1,
        source: scored[idx]?.chunk.metadata.filename ?? 'unknown',
        chunkIndex: scored[idx]?.chunk.index ?? 0,
      })),
      totalFound: scored.length,
      latencyMs: Date.now() - startTime,
    };
    return result;
  }

  return {
    chunks: scored.map(s => ({
      content: s.chunk.content,
      score: s.score,
      source: s.chunk.metadata.filename ?? 'unknown',
      chunkIndex: s.chunk.index,
    })),
    totalFound: scored.length,
    latencyMs: Date.now() - startTime,
  };
}

/** RAG-augmented LLM call: retrieve context → build prompt → call model. */
export async function ragQuery(
  query: string,
  agentPrompt: string,
  knowledgeBaseId?: string,
  config: Partial<RagConfig> = {}
): Promise<{ answer: string; sources: string[]; chunks: number; latencyMs: number; cost: number }> {
  const startTime = Date.now();

  // Step 1: Retrieve
  const retrieval = await retrieve(query, knowledgeBaseId, config);

  // Step 2: Build augmented prompt
  const context = retrieval.chunks.map((c, i) =>
    `[Fonte ${i + 1}: ${c.source}]\n${c.content}`
  ).join('\n\n---\n\n');

  const augmentedPrompt = `${agentPrompt}\n\n## Contexto Recuperado (RAG)\nUse as informações abaixo para responder. Cite as fontes quando possível.\n\n${context}`;

  // Step 3: Call LLM
  const response = await llm.callModel('anthropic/claude-sonnet-4', [
    { role: 'system', content: augmentedPrompt },
    { role: 'user', content: query },
  ], { maxTokens: 2048 });

  return {
    answer: response.content,
    sources: retrieval.chunks.map(c => c.source),
    chunks: retrieval.totalFound,
    latencyMs: Date.now() - startTime,
    cost: response.cost,
  };
}

// ═══ STATS ═══

export function getStats(): { documents: number; chunks: number; totalTokens: number } {
  return {
    documents: documents.length,
    chunks: chunks.length,
    totalTokens: chunks.reduce((s, c) => s + c.tokenCount, 0),
  };
}

// ═══ HELPERS ═══

async function rerankWithLLM(query: string, texts: string[]): Promise<number[]> {
  try {
    const response = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Rerank the following texts by relevance to the query. Return JSON array of indices (0-based) from most to least relevant.' },
      { role: 'user', content: `Query: ${query}\n\nTexts:\n${texts.map((t, i) => `[${i}] ${t.slice(0, 200)}`).join('\n')}` },
    ], { temperature: 0.1, maxTokens: 100 });

    const parsed = JSON.parse(response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Fallback: original order
  }
  return texts.map((_, i) => i);
}
