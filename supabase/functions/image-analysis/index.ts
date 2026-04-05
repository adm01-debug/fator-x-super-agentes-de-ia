import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const ImageInput = z.object({
  action: z.enum(['analyze', 'classify', 'nsfw_check', 'mockup', 'compare']).default('analyze'),
  image_base64: z.string().min(100).optional(),
  image_url: z.string().url().optional(),
  prompt: z.string().max(2000).optional(),
  categories: z.array(z.string()).optional(),
}).refine(d => d.image_base64 || d.image_url, {
  message: 'Either image_base64 or image_url is required',
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return handleCorsPreflight(req);

  try {
    const auth = await authenticateRequest(req);
    if (auth.error) return auth.error;
    const { user } = auth;

    const identifier = getRateLimitIdentifier(req, user.id);
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.standard);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, ImageInput);
    if (parsed.error) return parsed.error;
    const { action, image_base64, image_url, prompt, categories } = parsed.data;

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return errorResponse(req, 'HF_API_TOKEN not configured', 503);

    let imageBytes: Uint8Array;
    if (image_base64) {
      const raw = atob(image_base64);
      imageBytes = new Uint8Array(raw.length);
      for (let i = 0; i < raw.length; i++) imageBytes[i] = raw.charCodeAt(i);
    } else if (image_url) {
      const resp = await fetch(image_url);
      if (!resp.ok) return errorResponse(req, `Failed to fetch image`, 400);
      imageBytes = new Uint8Array(await resp.arrayBuffer());
    } else {
      return errorResponse(req, 'No image provided', 400);
    }

    // Route to appropriate HF model based on action
    let result: unknown;
    
    switch (action) {
      case 'nsfw_check': {
        const resp = await fetch('https://router.huggingface.co/hf-inference/models/Falconsai/nsfw_image_detection', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfToken}` },
          body: imageBytes,
        });
        result = await resp.json();
        break;
      }
      case 'classify': {
        const model = 'google/vit-base-patch16-224';
        const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfToken}` },
          body: imageBytes,
        });
        result = await resp.json();
        break;
      }
      default: {
        // Vision LLM analysis
        const resp = await fetch('https://router.huggingface.co/v1/chat/completions', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${hfToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'ibm-granite/granite-vision-3.3-2b',
            messages: [{ role: 'user', content: [
              { type: 'text', text: prompt || 'Analyze this image in detail.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image_base64 || btoa(String.fromCharCode(...imageBytes))}` } },
            ]}],
            max_tokens: 2048,
          }),
        });
        const data = await resp.json();
        result = { analysis: (data as Record<string, Array<Record<string, Record<string, string>>>>).choices?.[0]?.message?.content };
        break;
      }
    }

    return jsonResponse(req, { action, result, model_used: action });

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
