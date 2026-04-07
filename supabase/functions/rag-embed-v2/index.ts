/**
 * ═══════════════════════════════════════════════════════════════
 * Nexus Agents Studio — RAG Embed v2
 * ═══════════════════════════════════════════════════════════════
 * Multi-provider text embedding with HuggingFace, OpenAI fallback,
 * and a deterministic local fallback for development.
 *
 * Providers (in order of preference):
 *  1. HuggingFace Inference API (if HUGGINGFACE_API_KEY set)
 *     - qwen3-embedding-8b → Qwen/Qwen3-Embedding-8B
 *     - bge-m3              → BAAI/bge-m3
 *  2. OpenAI text-embedding-3-large (if OPENAI_API_KEY set)
 *  3. Deterministic hash-based fallback (dev/offline)
 *
 * Used by: src/services/ragPipelineService.ts
 * ═══════════════════════════════════════════════════════════════
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

// ═══ Input Schema ═══
const EmbedInput = z.object({
  texts: z.array(z.string().min(1).max(8000)).min(1).max(100),
  provider: z.string().default('qwen3-embedding-8b'),
  dimension: z.number().int().positive().max(4096).default(1024),
  task: z.enum(['retrieval.passage', 'retrieval.query', 'classification', 'clustering']).default('retrieval.passage'),
});

// ═══ Provider Map ═══
const HF_MODEL_MAP: Record<string, string> = {
  'qwen3-embedding-8b': 'Qwen/Qwen3-Embedding-8B',
  'bge-m3': 'BAAI/bge-m3',
  'bge-large-en': 'BAAI/bge-large-en-v1.5',
  'multilingual-e5': 'intfloat/multilingual-e5-large',
};

// ═══ HF Embedding ═══
async function embedWithHF(texts: string[], model: string, hfKey: string): Promise<number[][] | null> {
  try {
    const url = `https://api-inference.huggingface.co/pipeline/feature-extraction/${model}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ inputs: texts, options: { wait_for_model: true } }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    // HF returns array<array<number>> for batched, array<number> for single
    if (Array.isArray(data) && Array.isArray(data[0])) {
      return data as number[][];
    }
    if (Array.isArray(data) && typeof data[0] === 'number') {
      return [data as number[]];
    }
    return null;
  } catch {
    return null;
  }
}

// ═══ OpenAI Embedding ═══
async function embedWithOpenAI(texts: string[], openaiKey: string, dimension: number): Promise<number[][] | null> {
  try {
    const resp = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: texts,
        dimensions: dimension,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.data as Array<{ embedding: number[] }>).map(d => d.embedding);
  } catch {
    return null;
  }
}

// ═══ Deterministic Fallback (dev only) ═══
// Hash-based random projection — produces stable but meaningless vectors.
// Allows tests to run without API keys.
function hashEmbed(text: string, dim: number): number[] {
  const vec = new Array(dim).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const idx = (code * 2654435761) % dim;
    vec[idx < 0 ? idx + dim : idx] += Math.sin(code + i) / Math.sqrt(text.length);
  }
  // L2 normalize
  let norm = 0;
  for (const v of vec) norm += v * v;
  norm = Math.sqrt(norm) || 1;
  return vec.map(v => v / norm);
}

// ═══ Server ═══
serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user, supabase } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, EmbedInput);
    if (parsed.error) return parsed.error;
    const { texts, provider, dimension } = parsed.data;

    // Look up workspace secrets
    const { data: members } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1);
    const wsId = members?.[0]?.workspace_id;

    let hfKey: string | undefined;
    let openaiKey: string | undefined;
    if (wsId) {
      const { data: secrets } = await supabase
        .from('workspace_secrets')
        .select('key_name, key_value')
        .eq('workspace_id', wsId)
        .in('key_name', ['huggingface_api_key', 'openai_api_key']);
      for (const s of secrets ?? []) {
        if (s.key_name === 'huggingface_api_key') hfKey = s.key_value;
        if (s.key_name === 'openai_api_key') openaiKey = s.key_value;
      }
    }

    // Fallback to env vars
    hfKey ??= Deno.env.get('HUGGINGFACE_API_KEY') ?? undefined;
    openaiKey ??= Deno.env.get('OPENAI_API_KEY') ?? undefined;

    let embeddings: number[][] | null = null;
    let usedProvider = 'fallback_hash';

    // Try HF first
    if (hfKey && HF_MODEL_MAP[provider]) {
      embeddings = await embedWithHF(texts, HF_MODEL_MAP[provider], hfKey);
      if (embeddings) usedProvider = `hf:${HF_MODEL_MAP[provider]}`;
    }

    // Try OpenAI
    if (!embeddings && openaiKey) {
      embeddings = await embedWithOpenAI(texts, openaiKey, dimension);
      if (embeddings) usedProvider = 'openai:text-embedding-3-large';
    }

    // Deterministic fallback
    if (!embeddings) {
      embeddings = texts.map(t => hashEmbed(t, dimension));
      usedProvider = 'fallback_hash';
    }

    return jsonResponse(req, {
      embeddings,
      provider_used: usedProvider,
      dimension: embeddings[0]?.length ?? dimension,
      count: embeddings.length,
      version: 'rag-embed-v2.0',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return errorResponse(req, message, 500);
  }
});
