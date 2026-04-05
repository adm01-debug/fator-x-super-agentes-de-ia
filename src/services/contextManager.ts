/**
 * Context Manager — Intelligent context window management, RAGAS metrics,
 * cost attribution, streaming config, and prompt compression.
 */
import * as llm from './llmService';
import * as traceService from './traceService';
import { logger } from '@/lib/logger';

// ═══ CONTEXT WINDOW MANAGEMENT ═══

export interface ContextBudget {
  maxTokens: number;
  systemPromptTokens: number;
  memoryTokens: number;
  ragContextTokens: number;
  conversationTokens: number;
  reservedForOutput: number;
}

/** Estimate token count (rough: 1 token ≈ 4 chars for English, 3 chars for Portuguese) */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5);
}

/** Calculate optimal context budget for a given model's context window. */
export function calculateBudget(modelContextWindow: number, config?: Partial<ContextBudget>): ContextBudget {
  const maxTokens = modelContextWindow;
  const reservedForOutput = config?.reservedForOutput ?? Math.min(4096, Math.floor(maxTokens * 0.15));
  const available = maxTokens - reservedForOutput;

  return {
    maxTokens,
    systemPromptTokens: config?.systemPromptTokens ?? Math.floor(available * 0.15),
    memoryTokens: config?.memoryTokens ?? Math.floor(available * 0.10),
    ragContextTokens: config?.ragContextTokens ?? Math.floor(available * 0.40),
    conversationTokens: config?.conversationTokens ?? Math.floor(available * 0.35),
    reservedForOutput,
  };
}

/** Trim conversation history to fit within token budget. Keeps system + last N turns. */
export function trimConversation(
  messages: llm.LLMMessage[],
  maxTokens: number
): llm.LLMMessage[] {
  const system = messages.filter(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system');

  let totalTokens = system.reduce((s, m) => s + estimateTokens(m.content), 0);
  const trimmed: llm.LLMMessage[] = [];

  // Keep most recent messages first
  for (let i = conversation.length - 1; i >= 0; i--) {
    const tokens = estimateTokens(conversation[i].content);
    if (totalTokens + tokens > maxTokens) break;
    totalTokens += tokens;
    trimmed.unshift(conversation[i]);
  }

  return [...system, ...trimmed];
}

/** Compress conversation by summarizing older turns. */
export async function compressConversation(
  messages: llm.LLMMessage[],
  keepLast: number = 6
): Promise<llm.LLMMessage[]> {
  if (messages.length <= keepLast + 1) return messages; // +1 for system

  const system = messages.filter(m => m.role === 'system');
  const conversation = messages.filter(m => m.role !== 'system');

  if (conversation.length <= keepLast) return messages;

  const oldMessages = conversation.slice(0, -keepLast);
  const recentMessages = conversation.slice(-keepLast);

  if (!llm.isLLMConfigured()) {
    // Fallback: just keep recent
    return [...system, ...recentMessages];
  }

  const summaryResp = await llm.callModel('anthropic/claude-sonnet-4', [
    { role: 'system', content: 'Summarize this conversation in 2-3 concise sentences, preserving key facts and decisions.' },
    { role: 'user', content: oldMessages.map(m => `${m.role}: ${m.content}`).join('\n').slice(0, 3000) },
  ], { temperature: 0.2, maxTokens: 200 });

  return [
    ...system,
    { role: 'assistant' as const, content: `[Resumo da conversa anterior: ${summaryResp.content}]` },
    ...recentMessages,
  ];
}

// ═══ RAGAS METRICS ═══

export interface RAGASMetrics {
  faithfulness: number; // 0-100: claims supported by context
  contextPrecision: number; // 0-100: relevant chunks / total chunks
  contextRecall: number; // 0-100: relevant facts covered
  answerRelevancy: number; // 0-100: answer addresses the question
  overall: number;
}

/** Calculate RAGAS-inspired metrics for a RAG response. */
export function calculateRAGAS(
  query: string,
  answer: string,
  contextChunks: string[],
  expectedAnswer?: string
): RAGASMetrics {
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 3);
  const answerTerms = answer.toLowerCase().split(/\s+/).filter(t => t.length > 3);

  // Context Precision: how many chunks are relevant to the query
  const relevantChunks = contextChunks.filter(chunk => {
    const chunkLower = chunk.toLowerCase();
    return queryTerms.filter(t => chunkLower.includes(t)).length >= Math.max(1, queryTerms.length * 0.3);
  });
  const contextPrecision = contextChunks.length > 0 ? Math.round(relevantChunks.length / contextChunks.length * 100) : 0;

  // Context Recall: how many query terms are covered by context
  const coveredTerms = queryTerms.filter(t => contextChunks.some(c => c.toLowerCase().includes(t)));
  const contextRecall = queryTerms.length > 0 ? Math.round(coveredTerms.length / queryTerms.length * 100) : 0;

  // Answer Relevancy: how well the answer addresses the query
  const answerCoversQuery = queryTerms.filter(t => answer.toLowerCase().includes(t));
  const answerRelevancy = queryTerms.length > 0 ? Math.round(answerCoversQuery.length / queryTerms.length * 100) : 0;

  // Faithfulness: how many answer claims are supported by context
  const answerSentences = answer.split(/[.!?]+/).filter(s => s.trim().length > 20);
  const supportedSentences = answerSentences.filter(sentence => {
    const sentenceTerms = sentence.toLowerCase().split(/\s+/).filter(t => t.length > 3);
    return contextChunks.some(chunk => {
      const chunkLower = chunk.toLowerCase();
      return sentenceTerms.filter(t => chunkLower.includes(t)).length >= Math.max(1, sentenceTerms.length * 0.3);
    });
  });
  const faithfulness = answerSentences.length > 0 ? Math.round(supportedSentences.length / answerSentences.length * 100) : 100;

  const overall = Math.round((faithfulness + contextPrecision + contextRecall + answerRelevancy) / 4);

  return { faithfulness, contextPrecision, contextRecall, answerRelevancy, overall };
}

// ═══ COST ATTRIBUTION ═══

export interface CostAttribution {
  userId: string;
  agentId: string;
  feature: string;
  conversationId: string;
  model: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  timestamp: string;
}

const costRecords: CostAttribution[] = [];

export function recordCost(attribution: Omit<CostAttribution, 'timestamp'>): void {
  costRecords.unshift({ ...attribution, timestamp: new Date().toISOString() });
  if (costRecords.length > 5000) costRecords.length = 5000;
}

export function getCostByUser(days = 30): Record<string, number> {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const costs: Record<string, number> = {};
  costRecords.filter(r => new Date(r.timestamp) >= cutoff).forEach(r => {
    costs[r.userId] = (costs[r.userId] ?? 0) + r.costUsd;
  });
  return costs;
}

export function getCostByFeature(days = 30): Record<string, number> {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const costs: Record<string, number> = {};
  costRecords.filter(r => new Date(r.timestamp) >= cutoff).forEach(r => {
    costs[r.feature] = (costs[r.feature] ?? 0) + r.costUsd;
  });
  return costs;
}

export function getCostByConversation(days = 30): Record<string, number> {
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - days);
  const costs: Record<string, number> = {};
  costRecords.filter(r => new Date(r.timestamp) >= cutoff).forEach(r => {
    costs[r.conversationId] = (costs[r.conversationId] ?? 0) + r.costUsd;
  });
  return costs;
}

// ═══ STREAMING CONFIG ═══

export interface StreamingConfig {
  enabled: boolean;
  protocol: 'sse' | 'websocket' | 'hybrid';
  chunkSize: number; // Tokens per chunk
  flushInterval: number; // ms between flushes
  heartbeatInterval: number; // ms between keepalive pings
  maxDuration: number; // Max stream duration in ms
  backpressure: boolean;
}

export const DEFAULT_STREAMING_CONFIG: StreamingConfig = {
  enabled: true,
  protocol: 'sse',
  chunkSize: 1,
  flushInterval: 50,
  heartbeatInterval: 15000,
  maxDuration: 120000,
  backpressure: true,
};

/** Get optimal streaming config based on use case. */
export function getStreamingConfig(useCase: 'chat' | 'council' | 'workflow' | 'batch'): StreamingConfig {
  switch (useCase) {
    case 'chat': return { ...DEFAULT_STREAMING_CONFIG, protocol: 'sse' };
    case 'council': return { ...DEFAULT_STREAMING_CONFIG, protocol: 'hybrid', chunkSize: 10 };
    case 'workflow': return { ...DEFAULT_STREAMING_CONFIG, protocol: 'websocket', heartbeatInterval: 5000 };
    case 'batch': return { ...DEFAULT_STREAMING_CONFIG, enabled: false };
    default: {
      const _exhaustive: never = useCase;
      logger.error(`Unknown streaming use case: ${_exhaustive}`, new Error(`Unhandled streaming use case: ${_exhaustive}`), 'contextManager');
      return { ...DEFAULT_STREAMING_CONFIG };
    }
  }
}
