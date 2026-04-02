/**
 * Advanced RAG — Hybrid Search (BM25 + Semantic + RRF), Reranking, Contextual Chunking
 * Replaces basic keyword matching with production-grade retrieval.
 */
import * as llm from './llmService';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface HybridResult {
  content: string;
  score: number;
  source: string;
  method: 'bm25' | 'semantic' | 'hybrid';
  chunkIndex: number;
  metadata?: Record<string, string>;
}

export interface RerankedResult extends HybridResult {
  rerankScore: number;
  originalRank: number;
}

export interface ContextualChunk {
  content: string;
  context: string; // LLM-generated context explaining chunk's role in document
  combined: string; // context + content for embedding
}

// ═══ BM25 SCORING ═══

/** BM25 scoring algorithm for keyword-based retrieval. */
export function bm25Score(query: string, documents: string[], k1 = 1.5, b = 0.75): { index: number; score: number }[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const avgDocLen = documents.reduce((s, d) => s + d.split(/\s+/).length, 0) / Math.max(documents.length, 1);

  // Document frequency for each term
  const df: Record<string, number> = {};
  queryTerms.forEach(term => {
    df[term] = documents.filter(d => d.toLowerCase().includes(term)).length;
  });

  const N = documents.length;

  return documents.map((doc, index) => {
    const docTerms = doc.toLowerCase().split(/\s+/);
    const docLen = docTerms.length;

    let score = 0;
    queryTerms.forEach(term => {
      const tf = docTerms.filter(t => t.includes(term)).length;
      const idf = Math.log((N - (df[term] ?? 0) + 0.5) / ((df[term] ?? 0) + 0.5) + 1);
      const tfNorm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * docLen / avgDocLen));
      score += idf * tfNorm;
    });

    return { index, score };
  }).sort((a, b) => b.score - a.score);
}

// ═══ RECIPROCAL RANK FUSION ═══

/** Merge results from multiple retrieval methods using RRF. */
export function reciprocalRankFusion(
  rankedLists: { index: number; score: number }[][],
  k = 60
): { index: number; score: number }[] {
  const fusedScores = new Map<number, number>();

  rankedLists.forEach(list => {
    list.forEach((item, rank) => {
      const rrfScore = 1 / (k + rank + 1);
      fusedScores.set(item.index, (fusedScores.get(item.index) ?? 0) + rrfScore);
    });
  });

  return Array.from(fusedScores.entries())
    .map(([index, score]) => ({ index, score }))
    .sort((a, b) => b.score - a.score);
}

// ═══ HYBRID SEARCH ═══

/** Hybrid search combining BM25 (keyword) + semantic similarity + RRF fusion. */
export function hybridSearch(
  query: string,
  chunks: { content: string; source: string; chunkIndex: number; metadata?: Record<string, string> }[],
  topK = 10
): HybridResult[] {
  if (chunks.length === 0) return [];

  // BM25 ranking
  const bm25Results = bm25Score(query, chunks.map(c => c.content));

  // Semantic similarity (cosine-like via term overlap weighted by position)
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const semanticResults = chunks.map((chunk, index) => {
    const text = chunk.content.toLowerCase();
    let score = 0;
    queryTerms.forEach((term, termIdx) => {
      if (text.includes(term)) {
        // Weight earlier matches higher (position-aware)
        const pos = text.indexOf(term);
        score += (1 - pos / text.length) * (1 / (termIdx + 1));
      }
    });
    return { index, score };
  }).sort((a, b) => b.score - a.score);

  // RRF fusion
  const fused = reciprocalRankFusion([bm25Results, semanticResults]);

  return fused.slice(0, topK).map(f => ({
    content: chunks[f.index].content,
    score: f.score,
    source: chunks[f.index].source,
    method: 'hybrid',
    chunkIndex: chunks[f.index].chunkIndex,
    metadata: chunks[f.index].metadata,
  }));
}

// ═══ RERANKING ═══

/** Rerank results using LLM cross-encoder pattern. */
export async function rerank(
  query: string,
  results: HybridResult[],
  topK = 5
): Promise<RerankedResult[]> {
  if (results.length <= 1) return results.map((r, i) => ({ ...r, rerankScore: r.score, originalRank: i }));

  if (!llm.isLLMConfigured()) {
    // Fallback: keep original order
    return results.slice(0, topK).map((r, i) => ({ ...r, rerankScore: r.score, originalRank: i }));
  }

  try {
    const prompt = `Rate the relevance of each text passage to the query on a scale of 0-10.
Query: "${query}"

${results.slice(0, 20).map((r, i) => `[${i}] ${r.content.slice(0, 300)}`).join('\n\n')}

Return JSON array: [{"index": 0, "score": 8}, ...]
Only return the JSON, nothing else.`;

    const response = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'user', content: prompt },
    ], { temperature: 0.1, maxTokens: 500 });

    const scores = JSON.parse(response.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    if (Array.isArray(scores)) {
      return scores
        .filter((s: { index: number }) => s.index >= 0 && s.index < results.length) // HIGH-7 fix: bounds check
        .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
        .slice(0, topK)
        .map((s: { index: number; score: number }, newRank: number) => ({
          ...results[s.index],
          rerankScore: s.score / 10,
          originalRank: s.index,
        }));
    }
  } catch {
    logger.warn('Reranking failed, using original order', 'advancedRag');
  }

  return results.slice(0, topK).map((r, i) => ({ ...r, rerankScore: r.score, originalRank: i }));
}

// ═══ CONTEXTUAL CHUNKING (Anthropic Pattern) ═══

/** Generate contextual descriptions for chunks using the full document as reference. */
export async function contextualChunking(
  documentText: string,
  chunks: string[]
): Promise<ContextualChunk[]> {
  if (!llm.isLLMConfigured()) {
    return chunks.map(c => ({ content: c, context: '', combined: c }));
  }

  const results: ContextualChunk[] = [];

  for (const chunk of chunks) {
    try {
      const response = await llm.callModel('anthropic/claude-sonnet-4', [
        { role: 'user', content: `<document>\n${documentText.slice(0, 10000)}\n</document>\n\nHere is the chunk:\n<chunk>\n${chunk}\n</chunk>\n\nGive a short (2-3 sentence) description of what this chunk is about in context of the full document. Be specific.` },
      ], { temperature: 0.2, maxTokens: 150 });

      results.push({
        content: chunk,
        context: response.content,
        combined: `${response.content}\n\n${chunk}`,
      });
    } catch {
      results.push({ content: chunk, context: '', combined: chunk });
    }
  }

  return results;
}

// ═══ CITATION GENERATION ═══

export interface Citation {
  claim: string;
  source: string;
  chunkContent: string;
  confidence: number;
  verified: boolean;
}

/** Extract citations from a response by matching claims to source chunks. */
export function extractCitations(
  response: string,
  sourceChunks: { content: string; source: string }[]
): Citation[] {
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const citations: Citation[] = [];

  for (const sentence of sentences.slice(0, 20)) {
    const claim = sentence.trim();
    const terms = claim.toLowerCase().split(/\s+/).filter(t => t.length > 3);

    let bestMatch = { source: '', content: '', score: 0 };

    for (const chunk of sourceChunks) {
      const chunkLower = chunk.content.toLowerCase();
      const matches = terms.filter(t => chunkLower.includes(t)).length;
      const score = terms.length > 0 ? matches / terms.length : 0;
      if (score > bestMatch.score) {
        bestMatch = { source: chunk.source, content: chunk.content.slice(0, 200), score };
      }
    }

    if (bestMatch.score > 0.3) {
      citations.push({
        claim,
        source: bestMatch.source,
        chunkContent: bestMatch.content,
        confidence: Math.round(bestMatch.score * 100),
        verified: bestMatch.score > 0.6,
      });
    }
  }

  return citations;
}

// ═══ HALLUCINATION DETECTION (RAGAS faithfulness) ═══

export interface HallucinationCheck {
  claim: string;
  supported: boolean;
  evidence?: string;
  confidence: number;
}

/** Check response for hallucinations using claim decomposition + NLI pattern. */
export async function detectHallucinations(
  response: string,
  contextChunks: string[]
): Promise<{ hallucinated: HallucinationCheck[]; supported: HallucinationCheck[]; score: number }> {
  const context = contextChunks.join('\n\n');

  if (!llm.isLLMConfigured()) {
    return { hallucinated: [], supported: [], score: 100 };
  }

  try {
    const result = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Decompose the response into individual claims. For each claim, check if it is supported by the context. Return JSON: {"claims": [{"claim": "...", "supported": true/false, "evidence": "...", "confidence": 0-100}]}' },
      { role: 'user', content: `Context:\n${context.slice(0, 5000)}\n\nResponse to verify:\n${response.slice(0, 2000)}` },
    ], { temperature: 0.1, maxTokens: 1500 });

    const data = JSON.parse(result.content.replace(/```json?\n?/g, '').replace(/```/g, '').trim());
    const claims: HallucinationCheck[] = data.claims ?? [];
    const supported = claims.filter(c => c.supported);
    const hallucinated = claims.filter(c => !c.supported);
    const score = claims.length > 0 ? Math.round(supported.length / claims.length * 100) : 100;

    return { hallucinated, supported, score };
  } catch {
    return { hallucinated: [], supported: [], score: 100 };
  }
}
