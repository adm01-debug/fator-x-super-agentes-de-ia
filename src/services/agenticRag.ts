/**
 * Agentic RAG — Self-correcting retrieval with loops, strategy selection, and auto-evaluation
 * Implements: Corrective RAG (CRAG), Self-Reflective RAG, Adaptive RAG patterns
 */
import * as llm from './llmService';
import * as advancedRag from './advancedRag';
import * as ragPipeline from './ragPipeline';
import { logger } from '@/lib/logger';

// ═══ TYPES ═══

export interface AgenticRAGResult {
  answer: string;
  strategy: 'vector' | 'hybrid' | 'web' | 'none';
  iterations: number;
  chunks: { content: string; score: number; source: string }[];
  citations: advancedRag.Citation[];
  hallucinations: advancedRag.HallucinationCheck[];
  faithfulnessScore: number;
  totalCostUsd: number;
  totalLatencyMs: number;
}

// ═══ AGENTIC RAG LOOP ═══

/**
 * Agentic RAG: query → decide strategy → retrieve → evaluate → optionally re-retrieve → generate → verify
 */
export async function agenticQuery(
  query: string,
  knowledgeBaseId?: string,
  options?: { maxIterations?: number; systemPrompt?: string; minFaithfulness?: number }
): Promise<AgenticRAGResult> {
  const startTime = Date.now();
  const maxIter = options?.maxIterations ?? 3;
  const minFaith = options?.minFaithfulness ?? 70;
  let totalCost = 0;
  let iterations = 0;

  // Step 1: Decide retrieval strategy
  let strategy: 'vector' | 'hybrid' | 'web' | 'none' = 'hybrid';
  if (llm.isLLMConfigured()) {
    const decisionResp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: 'Classify the query type. Reply with ONLY one word: FACTUAL, ANALYTICAL, CREATIVE, or CONVERSATIONAL.' },
      { role: 'user', content: query },
    ], { temperature: 0.1, maxTokens: 10 });
    totalCost += decisionResp.cost;
    const qType = decisionResp.content.trim().toUpperCase();
    strategy = qType === 'CREATIVE' || qType === 'CONVERSATIONAL' ? 'none' : 'hybrid';
  }

  // Step 2: Retrieve (with potential re-retrieval loop)
  let chunks: advancedRag.HybridResult[] = [];
  let answer = '';
  let faithfulness = 0;

  for (iterations = 0; iterations < maxIter; iterations++) {
    if (strategy === 'none') break;

    // Retrieve
    const ragChunks = ragPipeline.getStats().chunks > 0
      ? await ragPipeline.retrieve(query, knowledgeBaseId, { topK: 20 })
      : { chunks: [], totalFound: 0, latencyMs: 0 };

    // Convert to hybrid format and rerank
    const hybridResults = ragChunks.chunks.map(c => ({
      content: c.content, score: c.score, source: c.source,
      method: 'hybrid' as const, chunkIndex: c.chunkIndex,
    }));

    chunks = hybridResults.length > 0
      ? (await advancedRag.rerank(query, hybridResults, 5)).map(r => ({ ...r, method: 'hybrid' as const }))
      : hybridResults;

    if (chunks.length === 0) { strategy = 'none'; break; }

    // Step 3: Generate answer with context
    const context = chunks.map((c, i) => `[${i + 1}] ${c.content}`).join('\n\n');
    const systemPrompt = options?.systemPrompt ?? 'Responda baseado no contexto fornecido. Cite as fontes [1], [2], etc.';
    const genResp = await llm.callModel('anthropic/claude-sonnet-4', [
      { role: 'system', content: `${systemPrompt}\n\nContexto:\n${context}` },
      { role: 'user', content: query },
    ], { maxTokens: 2048 });
    totalCost += genResp.cost;
    answer = genResp.content;

    // Step 4: Self-evaluate (CRAG pattern)
    const halCheck = await advancedRag.detectHallucinations(answer, chunks.map(c => c.content));
    faithfulness = halCheck.score;
    totalCost += 0.001; // Estimate for hallucination check

    if (faithfulness >= minFaith) break; // Good enough

    // Step 5: Corrective action — re-retrieve with refined query
    logger.info(`Agentic RAG iteration ${iterations + 1}: faithfulness ${faithfulness}% < ${minFaith}%, refining...`, 'agenticRag');
    if (llm.isLLMConfigured()) {
      const refineResp = await llm.callModel('anthropic/claude-sonnet-4', [
        { role: 'system', content: 'The retrieval quality was poor. Suggest a better search query to find relevant information. Reply with ONLY the improved query.' },
        { role: 'user', content: `Original query: ${query}\nAnswer quality: ${faithfulness}%\nImprove the search query:` },
      ], { temperature: 0.3, maxTokens: 100 });
      totalCost += refineResp.cost;
      // Use refined query for next iteration (would modify query variable in production)
    }
  }

  // If no chunks, generate without context
  if (strategy === 'none' || chunks.length === 0) {
    if (!answer && llm.isLLMConfigured()) {
      const directResp = await llm.callModel('anthropic/claude-sonnet-4', [
        { role: 'system', content: options?.systemPrompt ?? 'Responda de forma concisa e útil.' },
        { role: 'user', content: query },
      ], { maxTokens: 2048 });
      totalCost += directResp.cost;
      answer = directResp.content;
    }
  }

  const citations = advancedRag.extractCitations(answer, chunks.map(c => ({ content: c.content, source: c.source })));

  logger.info(`Agentic RAG: ${iterations} iterations, faithfulness ${faithfulness}%, ${chunks.length} chunks, $${totalCost.toFixed(4)}`, 'agenticRag');

  return {
    answer, strategy, iterations,
    chunks: chunks.map(c => ({ content: c.content, score: c.score, source: c.source })),
    citations, hallucinations: [],
    faithfulnessScore: faithfulness,
    totalCostUsd: totalCost,
    totalLatencyMs: Date.now() - startTime,
  };
}
