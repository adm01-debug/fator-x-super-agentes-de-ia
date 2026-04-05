/**
 * HuggingFace Integration Configuration
 * Central config for all HF models, endpoints, and feature flags used across Fator X.
 *
 * ENV VARS:
 *   HF_API_TOKEN              — HuggingFace API token (required)
 *   HF_TEI_ENDPOINT           — Custom TEI endpoint for self-hosted embeddings (optional)
 *   HF_TEI_RERANK_ENDPOINT    — Custom TEI endpoint for self-hosted reranking (optional)
 *   ENABLE_ML_INJECTION_CHECK — Toggle ML injection detection (default: true)
 *   ENABLE_HF_RERANKER        — Toggle HF reranker (default: true)
 *   ENABLE_HF_EMBEDDINGS      — Toggle HF embeddings (default: true)
 *   ENABLE_AUTO_CLASSIFY       — Toggle auto-classification of traces (default: true)
 */

// ═══ BASE URLS ═══
export const HF_ROUTER_URL = 'https://router.huggingface.co';
export const HF_INFERENCE_URL = `${HF_ROUTER_URL}/hf-inference/models`;
export const HF_CHAT_URL = `${HF_ROUTER_URL}/v1/chat/completions`;

// ═══ MODELS — Guardrails ═══
export const HF_MODEL_INJECTION_DETECTION = 'protectai/deberta-v3-base-prompt-injection-v2';
export const HF_MODEL_INJECTION_TIMEOUT_MS = 3000;
export const HF_MODEL_INJECTION_THRESHOLD = 0.85;

// ═══ MODELS — RAG ═══
export const HF_MODEL_EMBEDDINGS = 'BAAI/bge-m3';
export const HF_MODEL_EMBEDDINGS_DIM = 1024;
export const HF_MODEL_RERANKER = 'BAAI/bge-reranker-v2-m3';
export const HF_MODEL_RERANKER_TIMEOUT_MS = 5000;

// ═══ MODELS — Classification ═══
export const HF_MODEL_ZERO_SHOT = 'joeddav/xlm-roberta-large-xnli';
export const HF_MODEL_SENTIMENT = 'cardiffnlp/twitter-roberta-base-sentiment-latest';
export const HF_MODEL_NER = 'dslim/bert-base-NER';

// ═══ MODELS — LLM (available via HF Inference Providers) ═══
export const HF_LLM_MODELS = [
  { id: 'meta-llama/Llama-4-Scout-17B-16E-Instruct', label: 'Llama 4 Scout 17B', params: '17B MoE' },
  { id: 'Qwen/Qwen3-30B-A3B', label: 'Qwen3 30B', params: '30B MoE' },
  { id: 'mistralai/Mistral-Small-24B-Instruct-2501', label: 'Mistral Small 24B', params: '24B' },
  { id: 'google/gemma-3-12b-it', label: 'Gemma 3 12B', params: '12B' },
  { id: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek V3', params: '671B MoE' },
] as const;

// ═══ AUTO-CLASSIFY CATEGORIES ═══
export const AUTO_CLASSIFY_CATEGORIES = [
  'comercial', 'suporte', 'produto', 'financeiro',
  'logística', 'rh', 'técnico', 'criativo',
] as const;

// ═══ PRICING (per 1K tokens) ═══
export const HF_MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'llama-4': { input: 0.00017, output: 0.0004 },
  'qwen3': { input: 0.00015, output: 0.0003 },
  'mistral-small': { input: 0.0001, output: 0.0003 },
  'gemma-3': { input: 0.00005, output: 0.00015 },
  'deepseek-v3': { input: 0.0003, output: 0.0009 },
  'deepseek-r1': { input: 0.0005, output: 0.002 },
};

// ═══ TEI SELF-HOSTED CONFIG ═══
export interface TEIConfig {
  embeddings_endpoint: string | null;
  rerank_endpoint: string | null;
}

/**
 * Get TEI endpoints — uses self-hosted if configured, otherwise HF cloud.
 */
export function getTEIConfig(): TEIConfig {
  return {
    embeddings_endpoint: null, // Set HF_TEI_ENDPOINT env var for self-hosted
    rerank_endpoint: null,     // Set HF_TEI_RERANK_ENDPOINT env var for self-hosted
  };
}

/**
 * Build embedding endpoint URL.
 * Priority: 1) Self-hosted TEI, 2) HF Inference API
 */
export function getEmbeddingsUrl(hfToken: string): { url: string; headers: Record<string, string> } {
  const teiEndpoint = typeof Deno !== 'undefined' ? Deno.env.get('HF_TEI_ENDPOINT') : null;
  if (teiEndpoint) {
    return {
      url: `${teiEndpoint}/embed`,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  return {
    url: `${HF_INFERENCE_URL}/${HF_MODEL_EMBEDDINGS}`,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
  };
}

/**
 * Build reranker endpoint URL.
 * Priority: 1) Self-hosted TEI, 2) HF Inference API
 */
export function getRerankerUrl(hfToken: string): { url: string; headers: Record<string, string> } {
  const teiEndpoint = typeof Deno !== 'undefined' ? Deno.env.get('HF_TEI_RERANK_ENDPOINT') : null;
  if (teiEndpoint) {
    return {
      url: `${teiEndpoint}/rerank`,
      headers: { 'Content-Type': 'application/json' },
    };
  }
  return {
    url: `${HF_INFERENCE_URL}/${HF_MODEL_RERANKER}`,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
  };
}

// ═══ DOCKER COMMANDS FOR SELF-HOSTED TEI ═══
export const TEI_DOCKER_COMMANDS = {
  embeddings: `docker run --gpus all -p 8080:80 -v tei-data:/data \\
  ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \\
  --model-id ${HF_MODEL_EMBEDDINGS}`,

  reranker: `docker run --gpus all -p 8081:80 -v tei-data:/data \\
  ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 \\
  --model-id ${HF_MODEL_RERANKER}`,
} as const;
