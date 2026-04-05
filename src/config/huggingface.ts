import { logger } from '@/lib/logger';
/**
 * HuggingFace Integration Configuration — Fator X
 * Central config for all 26 HF integrations.
 */

// ═══ BASE URLS ═══
export const HF_ROUTER_URL = 'https://router.huggingface.co';
export const HF_INFERENCE_URL = `${HF_ROUTER_URL}/hf-inference/models`;
export const HF_CHAT_URL = `${HF_ROUTER_URL}/v1/chat/completions`;

// ═══ GUARDRAILS ═══
export const HF_MODELS_GUARDRAILS = {
  injection: { id: 'protectai/deberta-v3-base-prompt-injection-v2', timeout: 3000, threshold: 0.85 },
  toxicity: { id: 'unitary/toxic-bert', timeout: 3000, threshold: 0.85 },
  nsfw_image: { id: 'Falconsai/nsfw_image_detection', timeout: 5000, threshold: 0.5 },
} as const;

// ═══ RAG ═══
export const HF_MODELS_RAG = {
  embeddings: { id: 'BAAI/bge-m3', dim: 1024, timeout: 5000 },
  reranker: { id: 'BAAI/bge-reranker-v2-m3', timeout: 5000 },
  qa_extractive: { id: 'deepset/roberta-base-squad2', timeout: 5000 },
} as const;

// ═══ CLASSIFICATION ═══
export const HF_MODELS_CLASSIFICATION = {
  zero_shot: { id: 'joeddav/xlm-roberta-large-xnli', timeout: 5000 },
  sentiment: { id: 'cardiffnlp/twitter-roberta-base-sentiment-latest', timeout: 3000 },
  language: { id: 'papluca/xlm-roberta-base-language-detection', timeout: 2000 },
  image: { id: 'google/vit-base-patch16-224', timeout: 5000 },
} as const;

// ═══ NLP ═══
export const HF_MODELS_NLP = {
  ner: { id: 'dslim/bert-base-NER', timeout: 3000 },
  translation: { id: 'facebook/nllb-200-distilled-600M', timeout: 10000 },
  summarization: { id: 'facebook/bart-large-cnn', timeout: 10000 },
} as const;

// ═══ AUDIO ═══
export const HF_MODELS_AUDIO = {
  stt: { id: 'openai/whisper-large-v3-turbo', timeout: 30000 },
  tts_pt: { id: 'facebook/mms-tts-por', timeout: 15000 },
  tts_en: { id: 'facebook/mms-tts-eng', timeout: 15000 },
  tts_es: { id: 'facebook/mms-tts-spa', timeout: 15000 },
} as const;

// ═══ VISION ═══
export const HF_MODELS_VISION = {
  ocr: { id: 'ibm-granite/granite-vision-3.3-2b', timeout: 30000 },
  vdu: { id: 'ibm-granite/granite-vision-3.3-2b', timeout: 30000 },
  clip: { id: 'openai/clip-vit-base-patch32', timeout: 5000 },
} as const;

// ═══ GENERATION ═══
export const HF_MODELS_GENERATION = {
  image: { id: 'stabilityai/stable-diffusion-xl-base-1.0', timeout: 60000 },
} as const;

// ═══ LLM (via Inference Providers) ═══
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

// ═══ WORKFLOW TOOL TYPES ═══
export const WORKFLOW_TOOL_TYPES = [
  'hf_inference', 'webhook', 'edge_function',
  'translation', 'qa_extractive', 'image_generation',
] as const;

// ═══ ALL EDGE FUNCTIONS WITH HF ═══
export const HF_EDGE_FUNCTIONS = [
  'llm-gateway', 'rag-ingest', 'rag-rerank', 'cerebro-brain',
  'eval-judge', 'datahub-query', 'workflow-engine-v2', 'hf-autotrain',
  'audio-transcribe', 'doc-ocr', 'image-analysis', 'text-to-speech',
] as const;

// ═══ ENV VARS ═══
export const HF_ENV_VARS = {
  required: ['HF_API_TOKEN'],
  toggles: [
    'ENABLE_ML_INJECTION_CHECK', 'ENABLE_HF_RERANKER',
    'ENABLE_HF_EMBEDDINGS', 'ENABLE_AUTO_CLASSIFY',
    'ENABLE_TOXICITY_CHECK', 'ENABLE_LANGUAGE_DETECTION',
  ],
  optional: ['HF_TEI_ENDPOINT', 'HF_TEI_RERANK_ENDPOINT'],
} as const;

// ═══ TEI SELF-HOSTED ═══
export const TEI_DOCKER_COMMANDS = {
  embeddings: `docker run --gpus all -p 8080:80 ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 --model-id BAAI/bge-m3`,
  reranker: `docker run --gpus all -p 8081:80 ghcr.io/huggingface/text-embeddings-inference:cuda-1.9 --model-id BAAI/bge-reranker-v2-m3`,
} as const;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getDenoEnv = (key: string): string | null => {
  try {
    if (typeof globalThis !== 'undefined' && 'Deno' in globalThis) {
      return (globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno.env.get(key) ?? null;
    }
  } catch (err) { logger.error("Operation failed:", err); /* browser environment */ }
  return null;
};

export function getEmbeddingsUrl(hfToken: string): { url: string; headers: Record<string, string> } {
  const teiEndpoint = getDenoEnv('HF_TEI_ENDPOINT');
  if (teiEndpoint) return { url: `${teiEndpoint}/embed`, headers: { 'Content-Type': 'application/json' } };
  return { url: `${HF_INFERENCE_URL}/${HF_MODELS_RAG.embeddings.id}`, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` } };
}

export function getRerankerUrl(hfToken: string): { url: string; headers: Record<string, string> } {
  const teiEndpoint = getDenoEnv('HF_TEI_RERANK_ENDPOINT');
  if (teiEndpoint) return { url: `${teiEndpoint}/rerank`, headers: { 'Content-Type': 'application/json' } };
  return { url: `${HF_INFERENCE_URL}/${HF_MODELS_RAG.reranker.id}`, headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` } };
}
