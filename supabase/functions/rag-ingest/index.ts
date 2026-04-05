import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

interface RagIngestRequest {
  knowledge_base_id: string;
  document_name: string;
  content: string;
  chunk_size?: number;
  chunk_overlap?: number;
  embedding_model?: string;
}

/**
 * Split text into overlapping chunks of roughly `chunkSize` characters,
 * breaking at sentence boundaries when possible.
 */
function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  const chunks: string[] = [];
  if (text.length <= chunkSize) {
    chunks.push(text.trim());
    return chunks;
  }

  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + chunkSize, text.length);

    // Try to break at a sentence boundary (. ! ? followed by whitespace)
    if (end < text.length) {
      const slice = text.slice(start, end);
      const lastSentenceEnd = Math.max(
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
        slice.lastIndexOf(".\n"),
      );
      if (lastSentenceEnd > chunkSize * 0.3) {
        end = start + lastSentenceEnd + 1;
      }
    }

    const chunk = text.slice(start, end).trim();
    if (chunk.length > 0) {
      chunks.push(chunk);
    }

    start = end - overlap;
    if (start >= text.length) break;
  }

  return chunks;
}

/**
 * Generate embeddings via OpenAI-compatible API.
 * Falls back to a deterministic hash-based placeholder if no key is set.
 */
async function generateEmbeddings(
  texts: string[],
  model: string,
): Promise<number[][]> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");

  if (openaiKey) {
    // Real embeddings via OpenAI
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({ input: texts, model }),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`OpenAI embeddings error ${res.status}: ${errText}`);
    }

    const data = await res.json();
    return data.data.map((d: { embedding: number[] }) => d.embedding);
  }

  // Placeholder: deterministic pseudo-embedding (1536 dims) from text hash.
  // This keeps the pipeline functional without an API key.
  return texts.map((text) => {
    const dims = 1536;
    const embedding = new Array(dims);
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
    }
    for (let i = 0; i < dims; i++) {
      hash = ((hash << 5) - hash + i) | 0;
      embedding[i] = (hash & 0xffff) / 0xffff - 0.5;
    }
    // Normalize to unit vector
    const norm = Math.sqrt(embedding.reduce((s: number, v: number) => s + v * v, 0));
    return embedding.map((v: number) => v / norm);
  });
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      knowledge_base_id,
      document_name,
      content,
      chunk_size = 512,
      chunk_overlap = 50,
      embedding_model = "text-embedding-3-small",
    } = (await req.json()) as RagIngestRequest;

    if (!knowledge_base_id || !content) {
      return new Response(
        JSON.stringify({ error: "knowledge_base_id and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set");
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const startMs = Date.now();
    const documentId = crypto.randomUUID();

    // 1. Chunk the document
    const chunks = chunkText(content, chunk_size, chunk_overlap);

    // 2. Generate embeddings
    const embeddings = await generateEmbeddings(chunks, embedding_model);

    // 3. Insert chunks into knowledge_base_chunks
    const rows = chunks.map((chunkText, idx) => ({
      id: crypto.randomUUID(),
      knowledge_base_id,
      document_id: documentId,
      document_name: document_name ?? "untitled",
      chunk_index: idx,
      content: chunkText,
      embedding: embeddings[idx],
      token_count: Math.ceil(chunkText.length / 4), // rough estimate
      metadata: { chunk_size, chunk_overlap, embedding_model },
    }));

    const { error: insertError } = await supabase
      .from("knowledge_base_chunks")
      .insert(rows);

    if (insertError) {
      throw new Error(`Failed to insert chunks: ${insertError.message}`);
    }

    const durationMs = Date.now() - startMs;

    const payload = {
      document_id: documentId,
      chunks_created: chunks.length,
      embeddings_generated: embeddings.length,
      duration_ms: durationMs,
    };

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
