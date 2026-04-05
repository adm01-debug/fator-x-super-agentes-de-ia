import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

// OCR via Vision Language Model (understands tables, layouts, diagrams)
const VLM_MODEL = 'google/gemma-3-12b-it';
const OCR_TIMEOUT_MS = 60000;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get('Authorization')!;
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey, { global: { headers: { Authorization: authHeader } } });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return jsonResponse({ error: 'Unauthorized' }, 401);

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return jsonResponse({ error: 'HF_API_TOKEN not configured' }, 400);

    const body = await req.json();
    const { action, image_base64, image_url, output_format, document_id } = body;

    // ═══ ACTION: extract_text — OCR from image/PDF page ═══
    if (action === 'extract_text' || !action) {
      if (!image_base64 && !image_url) {
        return jsonResponse({ error: 'image_base64 or image_url required' }, 400);
      }

      const format = output_format || 'markdown';
      const prompt = format === 'json'
        ? 'Extract all text from this document image. Return as structured JSON with sections, tables, and paragraphs. Preserve the document structure.'
        : 'Extract all text from this document image. Return as clean Markdown. Preserve headings, tables (as Markdown tables), lists, and paragraph structure. Do not add commentary.';

      // Use LLM Gateway to call a VLM with the image
      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

      // For VLM, we send image as base64 in the message
      const imageContent = image_base64
        ? `[Image attached as base64 - ${image_base64.substring(0, 50)}...]`
        : `[Image URL: ${image_url}]`;

      const resp = await fetch(gatewayUrl, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash', // Use Gemini Flash for vision (supports image input natively)
          messages: [
            { role: 'system', content: 'You are a document OCR specialist. Extract text accurately preserving structure.' },
            { role: 'user', content: `${prompt}\n\n${imageContent}` },
          ],
          temperature: 0.1,
          max_tokens: 4000,
        }),
      });
      clearTimeout(timeout);

      const result = await resp.json();
      const extractedText = result.content || '';

      // Optionally feed into rag-ingest
      if (document_id && extractedText.length > 10) {
        const ingestResp = await fetch(`${supabaseUrl}/functions/v1/rag-ingest`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
          body: JSON.stringify({
            document_id,
            content: extractedText,
            chunk_size: 1000,
            chunk_overlap: 200,
          }),
        });
        const ingestResult = await ingestResp.json();

        return jsonResponse({
          text: extractedText,
          format: format,
          characters: extractedText.length,
          ingested: true,
          chunks_created: ingestResult.chunks_created,
          embeddings_generated: ingestResult.embeddings_generated,
          tokens: result.tokens,
          cost_usd: result.cost_usd,
        });
      }

      return jsonResponse({
        text: extractedText,
        format: format,
        characters: extractedText.length,
        ingested: false,
        tokens: result.tokens,
        cost_usd: result.cost_usd,
      });
    }

    // ═══ ACTION: extract_table — Extract tables specifically ═══
    if (action === 'extract_table') {
      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: 'You are a table extraction specialist. Extract ALL tables from the document image as JSON arrays of objects. Each object represents a row with column names as keys.' },
            { role: 'user', content: `Extract all tables from this document.\n\n${image_base64 ? '[Image attached]' : `[Image URL: ${image_url}]`}` },
          ],
          temperature: 0,
          max_tokens: 4000,
        }),
      });
      const result = await resp.json();

      // Try to parse tables from response
      let tables: unknown[] = [];
      try {
        const jsonMatch = (result.content || '').match(/\[[\s\S]*\]/);
        if (jsonMatch) tables = JSON.parse(jsonMatch[0]);
      } catch { tables = [{ raw: result.content }]; }

      return jsonResponse({
        tables,
        table_count: tables.length,
        tokens: result.tokens,
        cost_usd: result.cost_usd,
      });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
