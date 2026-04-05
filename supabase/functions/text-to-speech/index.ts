import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflight, jsonResponse, errorResponse, getCorsHeaders,
  authenticateRequest,
  checkRateLimit, createRateLimitResponse, getRateLimitIdentifier, RATE_LIMITS,
  parseBody, z,
} from "../_shared/mod.ts";

const TTS_MODELS: Record<string, string> = {
  pt: 'facebook/mms-tts-por',
  en: 'facebook/mms-tts-eng',
  es: 'facebook/mms-tts-spa',
};
const TTS_TIMEOUT_MS = 15000;

const TTSInput = z.object({
  text: z.string().min(1).max(5000),
  language: z.enum(['pt', 'en', 'es']).default('pt'),
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

    const parsed = await parseBody(req, TTSInput);
    if (parsed.error) return parsed.error;
    const { text, language } = parsed.data;

    const hfToken = Deno.env.get('HF_API_TOKEN');
    if (!hfToken) return errorResponse(req, 'HF_API_TOKEN not configured', 503);

    const model = TTS_MODELS[language];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TTS_TIMEOUT_MS);

    try {
      const resp = await fetch(`https://router.huggingface.co/hf-inference/models/${model}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ inputs: text }),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!resp.ok) {
        const errText = await resp.text();
        return errorResponse(req, `TTS API error: ${errText}`, resp.status);
      }

      const audioBuffer = await resp.arrayBuffer();
      const cors = getCorsHeaders(req);

      return new Response(audioBuffer, {
        headers: {
          ...cors,
          'Content-Type': 'audio/wav',
          'Content-Length': String(audioBuffer.byteLength),
        },
      });
    } finally {
      clearTimeout(timeout);
    }

  } catch (error: unknown) {
    return errorResponse(req, error instanceof Error ? error.message : 'Internal error', 500);
  }
});
