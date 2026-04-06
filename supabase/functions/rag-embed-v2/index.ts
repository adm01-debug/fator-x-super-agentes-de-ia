import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

const HF_API_KEY = Deno.env.get("HUGGINGFACE_API_KEY") || Deno.env.get("HF_API_TOKEN") || "";
const VERSION = "v1.0";

const PROVIDERS: Record<string, string> = {
  "qwen3-embedding-8b": "https://router.huggingface.co/hf-inference/models/Qwen/Qwen3-Embedding-8B",
  "bge-m3": "https://router.huggingface.co/hf-inference/models/BAAI/bge-m3",
  "jina-embeddings-v3": "https://router.huggingface.co/hf-inference/models/jinaai/jina-embeddings-v3",
};

async function getEmbeddings(texts: string[], provider: string, dimension: number, task: string): Promise<number[][]> {
  const endpoint = PROVIDERS[provider] || PROVIDERS["qwen3-embedding-8b"];

  if (!HF_API_KEY) {
    // Fallback: simple hash-based pseudo-embeddings for development
    return texts.map(text => {
      const arr = new Array(dimension).fill(0);
      for (let i = 0; i < text.length; i++) {
        arr[i % dimension] += text.charCodeAt(i) / 1000;
      }
      // Normalize
      const norm = Math.sqrt(arr.reduce((s, v) => s + v * v, 0));
      return arr.map(v => v / (norm || 1));
    });
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${HF_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: texts,
      parameters: { task, dimension },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`HF Embedding API error: ${res.status} ${err}`);
  }

  const data = await res.json();
  // HF returns array of arrays for batch
  return Array.isArray(data) ? data : [data];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method === "GET") {
    return new Response(JSON.stringify({ service: "rag-embed-v2", version: VERSION, providers: Object.keys(PROVIDERS) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const start = Date.now();
  try {
    const { texts, provider = "qwen3-embedding-8b", dimension = 1024, task = "retrieval.passage" } = await req.json();
    if (!texts || !Array.isArray(texts) || texts.length === 0) {
      return new Response(JSON.stringify({ error: "texts array is required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const embeddings = await getEmbeddings(texts, provider, dimension, task);

    return new Response(JSON.stringify({
      embeddings,
      model: provider,
      dimension,
      count: embeddings.length,
      processing_time_ms: Date.now() - start,
      version: VERSION,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
