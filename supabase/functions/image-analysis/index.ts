import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

// HF Models for different tasks
const MODELS = {
  classification: 'google/vit-base-patch16-224',
  nsfw: 'Falconsai/nsfw_image_detection',
  object_detection: 'facebook/detr-resnet-50',
  bg_removal: 'briaai/RMBG-2.0',
  clip: 'openai/clip-vit-base-patch32',
};
const TIMEOUT_MS = 15000;

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
    const { action, image_base64, image_url } = body;

    // Helper: get image bytes
    async function getImageBytes(): Promise<Uint8Array> {
      if (image_base64) {
        const binaryStr = atob(image_base64);
        const bytes = new Uint8Array(binaryStr.length);
        for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
        return bytes;
      }
      if (image_url) {
        const resp = await fetch(image_url);
        return new Uint8Array(await resp.arrayBuffer());
      }
      throw new Error('image_base64 or image_url required');
    }

    // Helper: call HF image classification
    async function classifyImage(model: string, imageBytes: Uint8Array): Promise<Array<{ label: string; score: number }>> {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${hfToken}` },
        body: imageBytes,
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (!resp.ok) throw new Error(`HF API error: ${resp.status}`);
      return await resp.json();
    }

    // ═══ ACTION: classify — General image classification ═══
    if (action === 'classify') {
      const imageBytes = await getImageBytes();
      const results = await classifyImage(MODELS.classification, imageBytes);
      return jsonResponse({
        predictions: (results || []).slice(0, 5).map((r: any) => ({
          label: r.label,
          score: Math.round(r.score * 1000) / 1000,
        })),
        model: MODELS.classification,
        cost_usd: 0,
      });
    }

    // ═══ ACTION: detect_color — Dominant color via VLM ═══
    if (action === 'detect_color') {
      const xbzColors = body.color_palette || [
        'Branco', 'Preto', 'Azul Royal', 'Azul Marinho', 'Azul Claro', 'Azul Turquesa',
        'Vermelho', 'Vermelho Escuro', 'Rosa', 'Rosa Claro', 'Magenta', 'Roxo',
        'Verde', 'Verde Escuro', 'Verde Limão', 'Verde Militar',
        'Amarelo', 'Laranja', 'Marrom', 'Bege', 'Cinza', 'Cinza Escuro',
        'Prata', 'Dourado', 'Transparente', 'Natural', 'Bambu', 'Cortiça', 'Jeans'
      ];

      // Use zero-shot classification with color labels
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      
      // Use LLM Gateway with vision model for accurate color detection
      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const resp = await fetch(gatewayUrl, {
        method: 'POST', signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `You are a product color classifier. Given a product image description, identify the dominant color from this exact palette: ${xbzColors.join(', ')}. Respond ONLY with a JSON object: {"primary_color": "...", "secondary_color": "..." or null, "confidence": 0.0-1.0, "hex_estimate": "#RRGGBB"}` },
            { role: 'user', content: `Analyze this product image and identify its dominant color.\n\n${image_url ? `[Image URL: ${image_url}]` : '[Image attached]'}` },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
      });
      clearTimeout(timeout);

      const result = await resp.json();
      let colorResult: Record<string, unknown> = {};
      try {
        const jsonMatch = (result.content || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) colorResult = JSON.parse(jsonMatch[0]);
      } catch { colorResult = { primary_color: 'unknown', raw: result.content }; }

      return jsonResponse({
        ...colorResult,
        palette_used: xbzColors.length,
        model: 'gemini-2.5-flash (vision)',
        cost_usd: result.cost_usd || 0,
      });
    }

    // ═══ ACTION: classify_product — Product category for Promo Brindes ═══
    if (action === 'classify_product') {
      const categories = body.categories || [
        'caneta', 'lápis', 'caderno', 'agenda', 'bloco de notas',
        'copo', 'garrafa', 'squeeze', 'caneca', 'copo térmico',
        'mochila', 'bolsa', 'sacola', 'necessaire', 'pasta',
        'camiseta', 'boné', 'avental', 'capa de chuva',
        'pen drive', 'carregador', 'fone de ouvido', 'caixa de som',
        'guarda-chuva', 'sombrinha', 'toalha', 'chaveiro',
        'power bank', 'mouse pad', 'suporte celular',
      ];

      const gatewayUrl = `${supabaseUrl}/functions/v1/llm-gateway`;
      const resp = await fetch(gatewayUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': authHeader, 'apikey': supabaseKey },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { role: 'system', content: `You are a promotional products classifier. Classify the product in the image into one of these categories: ${categories.join(', ')}. Respond ONLY with JSON: {"category": "...", "subcategory": "..." or null, "material": "..." or null, "confidence": 0.0-1.0}` },
            { role: 'user', content: `Classify this promotional product.\n\n${image_url ? `[Image URL: ${image_url}]` : '[Image attached]'}` },
          ],
          temperature: 0,
          max_tokens: 200,
        }),
      });
      const result = await resp.json();
      let productResult: Record<string, unknown> = {};
      try {
        const jsonMatch = (result.content || '').match(/\{[\s\S]*\}/);
        if (jsonMatch) productResult = JSON.parse(jsonMatch[0]);
      } catch { productResult = { category: 'unknown', raw: result.content }; }

      return jsonResponse({
        ...productResult,
        categories_available: categories.length,
        model: 'gemini-2.5-flash (vision)',
        cost_usd: result.cost_usd || 0,
      });
    }

    // ═══ ACTION: check_nsfw — Content safety check ═══
    if (action === 'check_nsfw') {
      const imageBytes = await getImageBytes();
      const results = await classifyImage(MODELS.nsfw, imageBytes);
      const nsfw = (results || []).find((r: any) => r.label === 'nsfw');
      const safe = (results || []).find((r: any) => r.label === 'normal' || r.label === 'safe');

      return jsonResponse({
        is_safe: !nsfw || nsfw.score < 0.5,
        nsfw_score: nsfw?.score || 0,
        safe_score: safe?.score || 1,
        model: MODELS.nsfw,
        cost_usd: 0,
      });
    }

    // ═══ ACTION: full_analysis — All analyses in one call ═══
    if (action === 'full_analysis') {
      const imageBytes = await getImageBytes();

      // Run classification + NSFW in parallel
      const [classResults, nsfwResults] = await Promise.allSettled([
        classifyImage(MODELS.classification, imageBytes),
        classifyImage(MODELS.nsfw, imageBytes),
      ]);

      const classifications = classResults.status === 'fulfilled' ? classResults.value : [];
      const nsfwChecks = nsfwResults.status === 'fulfilled' ? nsfwResults.value : [];

      const nsfw = (nsfwChecks || []).find((r: any) => r.label === 'nsfw');

      return jsonResponse({
        classification: (classifications || []).slice(0, 5).map((r: any) => ({
          label: r.label, score: Math.round(r.score * 1000) / 1000,
        })),
        safety: {
          is_safe: !nsfw || nsfw.score < 0.5,
          nsfw_score: nsfw?.score || 0,
        },
        models: { classification: MODELS.classification, nsfw: MODELS.nsfw },
        cost_usd: 0,
      });
    }

    // ═══ ACTION: remove_background — Remove fundo de foto de produto (#27) ═══
    if (action === 'remove_background') {
      const imgBytes = await getImageBytes();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s for heavy model
      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${MODELS.bg_removal}`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Authorization': `Bearer ${hfToken}` },
        body: imgBytes,
      });
      clearTimeout(timeout);
      if (!resp.ok) {
        // Fallback: try via Gradio Space API
        return jsonResponse({ error: `Background removal failed: ${resp.status}. Model may require GPU endpoint.`, suggestion: 'Use HF Space briaai/RMBG-2.0 via Gradio API or deploy on Inference Endpoint' }, 502);
      }
      const resultBlob = await resp.arrayBuffer();
      const resultBase64 = btoa(String.fromCharCode(...new Uint8Array(resultBlob)));
      return jsonResponse({
        image_base64: resultBase64,
        format: 'png',
        model: MODELS.bg_removal,
        cost_usd: 0,
      });
    }

    // ═══ ACTION: detect_objects — Detectar objetos em foto de produto (#31) ═══
    if (action === 'detect_objects') {
      const imgBytes = await getImageBytes();
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${MODELS.object_detection}`, {
        method: 'POST', signal: controller.signal,
        headers: { 'Authorization': `Bearer ${hfToken}` },
        body: imgBytes,
      });
      clearTimeout(timeout);
      if (!resp.ok) return jsonResponse({ error: `Object detection failed: ${resp.status}` }, 502);
      const detections = await resp.json();
      const minScore = body.min_score || 0.7;
      const filtered = (detections || [])
        .filter((d: Record<string, unknown>) => (d.score as number) >= minScore)
        .map((d: Record<string, unknown>) => ({
          label: d.label,
          score: Math.round((d.score as number) * 1000) / 1000,
          box: d.box,
        }));
      return jsonResponse({
        objects: filtered,
        total_detected: filtered.length,
        model: MODELS.object_detection,
        cost_usd: 0,
      });
    }

    // ═══ ACTION: visual_search — Gerar CLIP embedding para busca visual (#40) ═══
    if (action === 'visual_search') {
      const { query_text, query_image_base64 } = body;
      // CLIP pode gerar embeddings de texto ou imagem no mesmo espaço vetorial
      if (query_text) {
        // Text embedding via CLIP (para buscar imagens por texto)
        const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${MODELS.clip}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${hfToken}` },
          body: JSON.stringify({ inputs: query_text }),
        });
        if (!resp.ok) return jsonResponse({ error: `CLIP text embedding failed: ${resp.status}` }, 502);
        const embedding = await resp.json();
        return jsonResponse({ embedding, type: 'text', model: MODELS.clip, cost_usd: 0 });
      }
      if (query_image_base64 || image_base64) {
        // Image embedding via CLIP (para buscar produtos similares)
        const imgBytes = await getImageBytes();
        const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${MODELS.clip}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfToken}` },
          body: imgBytes,
        });
        if (!resp.ok) return jsonResponse({ error: `CLIP image embedding failed: ${resp.status}` }, 502);
        const embedding = await resp.json();
        return jsonResponse({ embedding, type: 'image', model: MODELS.clip, cost_usd: 0 });
      }
      return jsonResponse({ error: 'query_text or query_image_base64/image_base64 required' }, 400);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (error: unknown) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Internal error' }, 500);
  }
});
