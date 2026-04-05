import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const OCR_MODEL = 'ibm-granite/granite-vision-3.3-2b';
const OCR_TIMEOUT_MS = 30000;

const OcrInput = z.object({
  action: z.enum(['ocr', 'describe', 'extract_table', 'extract_fields']).default('ocr'),
  image_base64: z.string().min(100).optional(),
  image_url: z.string().url().optional(),
  prompt: z.string().max(2000).optional(),
  fields: z.array(z.string()).optional(),
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
    const rateCheck = checkRateLimit(identifier, RATE_LIMITS.heavy);
    if (!rateCheck.allowed) return createRateLimitResponse(rateCheck);

    const parsed = await parseBody(req, OcrInput);
    if (parsed.error) return parsed.error;
    const { action, image_base64, image_url, prompt, fields } = parsed.data;

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return errorResponse(req, 'HF_API_TOKEN not configured', 503);

    // Build prompt based on action
    let systemPrompt: string;
    switch (action) {
      case 'ocr':
        systemPrompt = 'Extract ALL text from this document image. Preserve the original layout and formatting.';
        break;
      case 'describe':
        systemPrompt = prompt || 'Describe this image in detail.';
        break;
      case 'extract_table':
        systemPrompt = 'Extract all tables from this document image. Return as markdown tables.';
        break;
      case 'extract_fields':
        systemPrompt = `Extract these specific fields from the document: ${(fields || []).join(', ')}. Return as JSON.`;
        break;
    }

    // Prepare image content
    let imageContent: string;
    if (image_base64) {
      imageContent = image_base64;
    } else if (image_url) {
      const resp = await fetch(image_url);
      if (!resp.ok) return errorResponse(req, `Failed to fetch image: ${resp.status}`, 400);
      const buffer = await resp.arrayBuffer();
      imageContent = btoa(String.fromCharCode(...new Uint8Array(buffer)));
    } else {
      return errorResponse(req, 'No image provided', 400);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);

    try {
      const resp = await fetch(`https://router.huggingface.co/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: OCR_MODEL,
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: systemPrompt },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageContent}` } },
            ],
          }],
          max_tokens: 4096,
          temperature: 0.1,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        return errorResponse(req, `OCR API error: ${errText}`, resp.status);
      }

      const result = await resp.json();
      const text = (result as Record<string, unknown[]>).choices?.[0] &&
        ((result as Record<string, Array<Record<string, Record<string, string>>>>).choices[0].message?.content || '');

      return jsonResponse(req, {
        text,
        action,
        model: OCR_MODEL,
      });
    } finally {
      clearTimeout(timeout);
    }

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
