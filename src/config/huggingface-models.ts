export interface HFModel {
  id: string;
  provider: string;
  tier: 'nano' | 'fast' | 'premium' | 'flagship' | 'embedding' | 'reranker';
  inputCostPer1M: number;
  outputCostPer1M: number;
  contextWindow: number;
  capabilities: string[];
  description: string;
}

export const HF_MODELS_2026: HFModel[] = [
  { id: 'qwen3.5-397b-a17b', provider: 'openrouter', tier: 'flagship', inputCostPer1M: 0.15, outputCostPer1M: 0.60, contextWindow: 262144, capabilities: ['reasoning','coding','vision','agentic'], description: 'Qwen3.5 397B MoE — Best open-source model 2026' },
  { id: 'glm-5', provider: 'openrouter', tier: 'flagship', inputCostPer1M: 0.10, outputCostPer1M: 0.40, contextWindow: 128000, capabilities: ['reasoning','coding','agentic'], description: 'GLM-5 744B — Zhipu flagship' },
  { id: 'claude-sonnet-4-20250514', provider: 'anthropic', tier: 'flagship', inputCostPer1M: 3.00, outputCostPer1M: 15.00, contextWindow: 200000, capabilities: ['reasoning','coding','vision','agentic'], description: 'Claude Sonnet 4 — Highest quality' },
  { id: 'nemotron-3-nano-30b-a3b', provider: 'openrouter', tier: 'fast', inputCostPer1M: 0.01, outputCostPer1M: 0.03, contextWindow: 1000000, capabilities: ['reasoning','agentic','tool_use'], description: 'Nemotron Nano — 1M context, ultra-cheap' },
  { id: 'glm-4.7-flash', provider: 'openrouter', tier: 'fast', inputCostPer1M: 0.01, outputCostPer1M: 0.04, contextWindow: 128000, capabilities: ['reasoning','coding','agentic'], description: 'GLM-4.7 Flash — Fast coding' },
  { id: 'claude-haiku-4-5-20251001', provider: 'anthropic', tier: 'fast', inputCostPer1M: 0.80, outputCostPer1M: 4.00, contextWindow: 200000, capabilities: ['reasoning','coding','agentic'], description: 'Claude Haiku 4.5 — Fast Anthropic' },
  { id: 'qwen3-30b-a3b', provider: 'openrouter', tier: 'premium', inputCostPer1M: 0.03, outputCostPer1M: 0.12, contextWindow: 262144, capabilities: ['reasoning','coding','agentic'], description: 'Qwen3 30B MoE — Great price/performance' },
  { id: 'youtu-llm-1.96b', provider: 'huggingface', tier: 'nano', inputCostPer1M: 0.005, outputCostPer1M: 0.01, contextWindow: 128000, capabilities: ['agentic','routing'], description: 'Youtu 1.96B — Ultra-cheap for routing' },
  { id: 'qwen3-embedding-8b', provider: 'huggingface', tier: 'embedding', inputCostPer1M: 0.02, outputCostPer1M: 0, contextWindow: 32768, capabilities: ['embedding','retrieval'], description: 'Qwen3-Embedding — MTEB #1 worldwide' },
  { id: 'bge-m3', provider: 'huggingface', tier: 'embedding', inputCostPer1M: 0.01, outputCostPer1M: 0, contextWindow: 8192, capabilities: ['embedding','retrieval','hybrid'], description: 'BGE-M3 — Dense+sparse+colbert' },
  { id: 'jina-embeddings-v3', provider: 'huggingface', tier: 'embedding', inputCostPer1M: 0.02, outputCostPer1M: 0, contextWindow: 8192, capabilities: ['embedding','retrieval'], description: 'Jina v3 — Task-specific embedding' },
  { id: 'qwen3-reranker-8b', provider: 'huggingface', tier: 'reranker', inputCostPer1M: 0.03, outputCostPer1M: 0, contextWindow: 32768, capabilities: ['reranking'], description: 'Qwen3-Reranker — MTEB reranking #1' },
  { id: 'bge-reranker-v2-m3', provider: 'huggingface', tier: 'reranker', inputCostPer1M: 0.01, outputCostPer1M: 0, contextWindow: 8192, capabilities: ['reranking','multilingual'], description: 'BGE Reranker v2 — Multilingual reranking' },
];

export const getModelsByTier = (tier: HFModel['tier']) => HF_MODELS_2026.filter(m => m.tier === tier);
export const getModelById = (id: string) => HF_MODELS_2026.find(m => m.id === id);
export const getCheapestModel = (capability: string) =>
  HF_MODELS_2026.filter(m => m.capabilities.includes(capability)).sort((a, b) => a.inputCostPer1M - b.inputCostPer1M)[0];
